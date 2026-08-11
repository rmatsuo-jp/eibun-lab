import { vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GamificationSyncService } from './gamification-sync.service';
import { GamificationStatsService } from './gamification-stats.service';
import { AuthService } from '@core/firebase/auth.service';
import { FEATURE_ID_CLOZE } from './gamification-feature-id';
import { FeatureGamificationStats, GamificationStats } from '@core/models/session.model';
import { toDayKey } from '@shared/utils/date.util';

const { getDocMock, setDocMock } = vi.hoisted(() => ({
  getDocMock: vi.fn(),
  setDocMock: vi.fn().mockResolvedValue(undefined),
}));

// drill-progress-sync.service.spec.ts と同じ理由（firebase.init.ts が jsdom で動かない）で
// firebase/firestore を丸ごとモック化する。
vi.mock('firebase/firestore', () => ({
  initializeFirestore: () => ({}),
  persistentLocalCache: () => ({}),
  persistentMultipleTabManager: () => ({}),
  doc: (...args: unknown[]) => ({ __doc: args }),
  getDoc: getDocMock,
  setDoc: setDocMock,
}));

function cloudDoc(data: unknown) {
  return { exists: () => data !== undefined, data: () => data };
}

function featureStats(partial: Partial<FeatureGamificationStats> = {}): FeatureGamificationStats {
  return {
    totalAttempts: 0,
    totalCorrect: 0,
    totalWrong: 0,
    sessionsCompleted: 0,
    perfectSessionCount: 0,
    currentPerfectStreak: 0,
    longestPerfectStreak: 0,
    currentDailyStreak: 0,
    longestDailyStreak: 0,
    bestInSessionCorrectStreak: 0,
    completedSessionKeys: {},
    ...partial,
  };
}

function cloudStats(partial: Partial<GamificationStats> = {}): GamificationStats {
  return {
    features: { [FEATURE_ID_CLOZE]: featureStats() },
    unlockedAchievements: {},
    ...partial,
  };
}

describe('GamificationSyncService', () => {
  let service: GamificationSyncService;
  let store: GamificationStatsService;
  let user = signal<{ uid: string } | null>(null);

  beforeEach(() => {
    localStorage.clear();
    getDocMock.mockReset();
    setDocMock.mockClear().mockResolvedValue(undefined);
    user = signal<{ uid: string } | null>(null);
    TestBed.configureTestingModule({
      providers: [
        GamificationSyncService,
        GamificationStatsService,
        { provide: AuthService, useValue: { user } },
      ],
    });
    store = TestBed.inject(GamificationStatsService);
    service = TestBed.inject(GamificationSyncService);
  });

  describe('totalXp（累積経験値）', () => {
    it('addXpはローカルへ委譲しつつクラウドへpushする', () => {
      user.set({ uid: 'uid' });
      service.addXp(30);

      expect(store.allStats().totalXp).toBe(30);
      expect(setDocMock).toHaveBeenCalledTimes(1);
    });

    it('マージでは大きい方を採用する', async () => {
      store.addXp(120);
      getDocMock.mockResolvedValue(cloudDoc(cloudStats({ totalXp: 400 })));

      await service.syncFromCloud('uid');
      expect(store.allStats().totalXp).toBe(400);
    });

    it('totalXpを持たない旧形状のクラウドドキュメントでも壊れない', async () => {
      store.addXp(75);
      getDocMock.mockResolvedValue(cloudDoc(cloudStats()));

      await service.syncFromCloud('uid');
      expect(store.allStats().totalXp).toBe(75);
    });
  });

  describe('dailyMissions（デイリーミッション）のマージ', () => {
    const today = toDayKey(new Date().toISOString());

    it('日付キーが違う場合は新しい方を丸ごと採用する（前日ぶんの進捗を持ち越さない）', async () => {
      // ローカルは今日ぶん、クラウドは前日ぶん。
      store.recordMissionMetric('answers', 3);
      const localMissionIds = store.dailyMissions().missionIds;

      getDocMock.mockResolvedValue(
        cloudDoc(
          cloudStats({
            dailyMissions: {
              dayKey: '2000-01-01',
              missionIds: ['answer-5'],
              progress: { 'answer-5': 999 },
              completed: { 'answer-5': true },
            },
          }),
        ),
      );

      await service.syncFromCloud('uid');

      const merged = store.allStats().dailyMissions!;
      expect(merged.dayKey).toBe(today);
      expect(merged.missionIds).toEqual(localMissionIds);
      // 前日ぶんの進捗・達成済みは一切混ざらない
      expect(merged.progress['answer-5']).not.toBe(999);
      expect(merged.completed['answer-5']).toBeUndefined();
    });

    it('日付キーが同じ場合はミッション別に大きい方を採り、達成済みは和集合になる', async () => {
      store.recordMissionMetric('answers', 2);
      const state = store.dailyMissions();
      const [first, second] = state.missionIds;

      getDocMock.mockResolvedValue(
        cloudDoc(
          cloudStats({
            dailyMissions: {
              dayKey: state.dayKey,
              missionIds: state.missionIds,
              progress: { [first]: 99 },
              completed: { [second]: true },
            },
          }),
        ),
      );

      await service.syncFromCloud('uid');

      const merged = store.allStats().dailyMissions!;
      expect(merged.dayKey).toBe(state.dayKey);
      expect(merged.progress[first]).toBe(99); // クラウド側が大きい
      expect(merged.completed[second]).toBe(true); // クラウド側の達成済みが取り込まれる
    });

    it('片側にしか無い場合はある方をそのまま採用する', async () => {
      // ローカルには dailyMissions が無い状態でクラウドのみ持つ
      getDocMock.mockResolvedValue(
        cloudDoc(
          cloudStats({
            dailyMissions: {
              dayKey: today,
              missionIds: ['correct-5'],
              progress: { 'correct-5': 4 },
              completed: {},
            },
          }),
        ),
      );

      await service.syncFromCloud('uid');

      expect(store.allStats().dailyMissions).toEqual({
        dayKey: today,
        missionIds: ['correct-5'],
        progress: { 'correct-5': 4 },
        completed: {},
      });
    });

    it('dailyMissionsを持たない旧形状のクラウドドキュメントでも壊れない', async () => {
      store.recordMissionMetric('answers', 1);
      getDocMock.mockResolvedValue(cloudDoc(cloudStats()));

      await service.syncFromCloud('uid');
      expect(store.allStats().dailyMissions?.dayKey).toBe(today);
    });
  });

  describe('recordSessionComplete の重複排除', () => {
    it('初回はtrue、同じsessionKeyの2回目はfalseを返す', () => {
      expect(service.recordSessionComplete(FEATURE_ID_CLOZE, 'cloze-s1', true)).toBe(true);
      expect(service.recordSessionComplete(FEATURE_ID_CLOZE, 'cloze-s1', true)).toBe(false);
    });
  });
});
