import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DrillLevelUpState, perfectCountKey } from './drill-levelup-state';
import { SessionRepositoryService } from '@core/sessions/session-repository.service';
import { DrillProgressSyncService } from '@core/drill/drill-progress-sync.service';
import { CorrectionSession, LevelUpItem, LevelUpItemProgress } from '@core/models/session.model';
import { I18nService } from '@core/i18n/i18n.service';
import { normalizeDrillKey } from '@core/stats/session-stats.util';

// DrillProgressSyncService の簡易インメモリ実装（Firestore同期を経由しないテストダブル）。
class FakeDrillProgressSync {
  private levelUp = new Map<string, Record<string, LevelUpItemProgress>>();
  private perfectCounts = new Map<string, number>();

  getLevelUpProgress(sessionId: string) {
    return this.levelUp.get(sessionId) ?? {};
  }

  setLevelUpItemProgress(
    sessionId: string,
    itemKey: string,
    maskLevel: number,
    completed: boolean,
  ) {
    const existing = this.levelUp.get(sessionId) ?? {};
    this.levelUp.set(sessionId, { ...existing, [itemKey]: { maskLevel, completed } });
  }

  getPerfectCount(sessionKey: string) {
    return this.perfectCounts.get(sessionKey) ?? 0;
  }

  incrementPerfectCount(sessionKey: string) {
    this.perfectCounts.set(sessionKey, (this.perfectCounts.get(sessionKey) ?? 0) + 1);
  }
}

function makeItem(leveledUp: string): LevelUpItem {
  return { original: 'orig', leveledUp, translation: '訳', keyPhrases: [] };
}

function makeSession(id: string, sentences: string[]): CorrectionSession {
  return {
    id,
    date: '2026-01-01T00:00:00.000Z',
    original: '',
    corrected: '',
    mistakes: [],
    levelUpItems: sentences.map(makeItem),
  };
}

function setup(sessions: CorrectionSession[]) {
  const fakeSync = new FakeDrillProgressSync();
  TestBed.configureTestingModule({
    providers: [
      DrillLevelUpState,
      { provide: SessionRepositoryService, useValue: { sessions: signal(sessions) } },
      { provide: DrillProgressSyncService, useValue: fakeSync },
      { provide: I18nService, useValue: { lang: () => 'ja', t: (k: string) => k } },
    ],
  });
  return { state: TestBed.inject(DrillLevelUpState), fakeSync };
}

// 該当セッションの全文を完了済みにする。
function completeAll(fakeSync: FakeDrillProgressSync, session: CorrectionSession) {
  for (const item of session.levelUpItems ?? []) {
    fakeSync.setLevelUpItemProgress(session.id, normalizeDrillKey(item.leveledUp), 3, true);
  }
}

describe('DrillLevelUpState', () => {
  describe('progressForSession / isSessionComplete', () => {
    it('完了済みの文だけを done として数える', () => {
      const session = makeSession('s1', ['He goes to school.', 'She reads a book.']);
      const { state, fakeSync } = setup([session]);
      expect(state.progressForSession(session)).toEqual({ done: 0, total: 2 });

      fakeSync.setLevelUpItemProgress('s1', normalizeDrillKey('He goes to school.'), 3, true);
      expect(state.progressForSession(session)).toEqual({ done: 1, total: 2 });
      expect(state.isSessionComplete(session)).toBe(false);

      completeAll(fakeSync, session);
      expect(state.isSessionComplete(session)).toBe(true);
    });

    it('levelUpItems が空のセッションは完了扱いにしない', () => {
      const session = makeSession('empty', []);
      const { state } = setup([session]);
      expect(state.isSessionComplete(session)).toBe(false);
    });
  });

  describe('パーフェクト達成数の訪問単位ガード', () => {
    const session = () => makeSession('s1', ['He goes to school.']);

    it('ノーミスの訪問では1回だけ加算する（同一訪問中の再判定では増えない）', () => {
      const s = session();
      const { state, fakeSync } = setup([s]);
      state.startVisit();

      state.recordPerfectVisit('s1');
      state.recordPerfectVisit('s1');
      expect(fakeSync.getPerfectCount(perfectCountKey('s1'))).toBe(1);
    });

    it('訪問中に一度でも不正解があれば加算しない', () => {
      const s = session();
      const { state, fakeSync } = setup([s]);
      state.startVisit();

      state.noteVisitMistake();
      state.recordPerfectVisit('s1');
      expect(fakeSync.getPerfectCount(perfectCountKey('s1'))).toBe(0);
    });

    it('startVisit でガードがリセットされ、次の訪問では再び加算できる', () => {
      const s = session();
      const { state, fakeSync } = setup([s]);

      state.startVisit();
      state.recordPerfectVisit('s1');
      state.startVisit();
      state.recordPerfectVisit('s1');
      expect(fakeSync.getPerfectCount(perfectCountKey('s1'))).toBe(2);
    });

    it('不正解のあった訪問の後でも、startVisit 後のノーミス訪問なら加算される', () => {
      const s = session();
      const { state, fakeSync } = setup([s]);

      state.startVisit();
      state.noteVisitMistake();
      state.recordPerfectVisit('s1');
      state.startVisit();
      state.recordPerfectVisit('s1');
      expect(fakeSync.getPerfectCount(perfectCountKey('s1'))).toBe(1);
    });

    it('perfectCountForSession が加算結果を読み出せる（保存キーが一致する）', () => {
      const s = session();
      const { state } = setup([s]);
      state.startVisit();
      state.recordPerfectVisit('s1');
      expect(state.perfectCountForSession(s)).toBe(1);
    });
  });

  describe('savedMaskLevel / masteredCountFor / progressForItem', () => {
    it('保存済み進捗から maskLevel と完了状態を復元する', () => {
      const s = makeSession('s1', ['He goes to school.']);
      const { state, fakeSync } = setup([s]);
      const [quizItem] = state.buildQuizItems(s);

      expect(state.savedMaskLevel('s1', quizItem)).toBe(0);
      expect(state.progressForItem(quizItem, 's1')).toEqual({ maskLevel: 0, completed: false });

      fakeSync.setLevelUpItemProgress('s1', quizItem.key, 2, false);
      expect(state.savedMaskLevel('s1', quizItem)).toBe(2);
      expect(state.progressForItem(quizItem, 's1')).toEqual({ maskLevel: 2, completed: false });

      fakeSync.setLevelUpItemProgress('s1', quizItem.key, 3, true);
      expect(state.masteredCountFor('s1')).toBe(1);
    });

    it('sessionId が null なら未着手として扱う（サンプル出題中）', () => {
      const s = makeSession('s1', ['He goes to school.']);
      const { state } = setup([s]);
      const [quizItem] = state.buildQuizItems(s);
      expect(state.savedMaskLevel(null, quizItem)).toBe(0);
      expect(state.progressForItem(quizItem, null)).toEqual({ maskLevel: 0, completed: false });
    });
  });

  describe('maskedSentence', () => {
    it('maskLevel 0 では原文をそのまま返す', () => {
      const s = makeSession('s1', ['He goes to school.']);
      const { state } = setup([s]);
      const [quizItem] = state.buildQuizItems(s);
      expect(state.maskedSentence(quizItem, 0)).toBe('He goes to school.');
    });

    it('マスクされた単語は文字数分の下線になり、語末の句読点は残る（桁揃えのため）', () => {
      const s = makeSession('s1', ['He goes to school.']);
      const { state } = setup([s]);
      const [quizItem] = state.buildQuizItems(s);
      const masked = state.maskedSentence(quizItem, quizItem.maxLevel);
      expect(masked).toBe('__ ____ __ ______.');
      expect(masked.length).toBe('He goes to school.'.length);
    });
  });

  describe('levelUpAchievement', () => {
    it('未着手なら done は0、total は全セッションの文数の合計', () => {
      const a = makeSession('a', ['He goes to school.']);
      const b = makeSession('b', ['She reads a book.', 'They play tennis.']);
      const { state } = setup([a, b]);
      expect(state.levelUpAchievement()).toEqual({ done: 0, total: 3 });
    });

    it('完了済みのセッションを done に合算する', () => {
      const a = makeSession('a', ['He goes to school.']);
      const b = makeSession('b', ['She reads a book.', 'They play tennis.']);
      const { state, fakeSync } = setup([a, b]);
      // levelUpAchievement は sessions signal にのみ依存する computed のため、
      // 進捗を書き込んでから初回評価する（進捗の書き込み自体は再計算のトリガーにならない）。
      completeAll(fakeSync, a);
      expect(state.levelUpAchievement()).toEqual({ done: 1, total: 3 });
    });
  });
});
