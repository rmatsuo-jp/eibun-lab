import { vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DrillProgressSyncService } from './drill-progress-sync.service';
import { DrillProgressService } from './drill-progress.service';
import { AuthService } from '@core/firebase/auth.service';

const { getDocMock, setDocMock } = vi.hoisted(() => ({
  getDocMock: vi.fn(),
  setDocMock: vi.fn().mockResolvedValue(undefined),
}));

// firebase.init.ts が initializeFirestore 等を実行するため、firebase/firestore は
// 丸ごとモック化する（IndexedDB前提のpersistentLocalCacheはjsdomで動作しないため）。
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

// DrillProgressSyncService はローカル(DrillProgressService)への委譲 + Firestore push/pull を
// ペアで行う。syncError signalへの成功/失敗反映と、新しさ比較によるマージロジックを検証する。
describe('DrillProgressSyncService', () => {
  let service: DrillProgressSyncService;
  let store: DrillProgressService;
  let user = signal<{ uid: string } | null>(null);

  beforeEach(() => {
    localStorage.clear();
    getDocMock.mockReset();
    setDocMock.mockClear().mockResolvedValue(undefined);
    user = signal<{ uid: string } | null>(null);
    TestBed.configureTestingModule({
      providers: [
        DrillProgressSyncService,
        DrillProgressService,
        { provide: AuthService, useValue: { user } },
      ],
    });
    store = TestBed.inject(DrillProgressService);
    service = TestBed.inject(DrillProgressSyncService);
  });

  it('recordDrillResult はローカルへ委譲しつつクラウドへpushする', () => {
    user.set({ uid: 'uid' });
    service.recordDrillResult('some sentence', true);

    expect(store.getDrillProgress('some sentence')?.correctStreak).toBe(1);
    expect(setDocMock).toHaveBeenCalledTimes(1);
  });

  it('setLevelUpItemProgress はローカルへ委譲しつつクラウドへpushする', () => {
    user.set({ uid: 'uid' });
    service.setLevelUpItemProgress('session-1', 'item-1', 2, false);

    expect(store.getLevelUpProgress('session-1')).toEqual({
      'item-1': { maskLevel: 2, completed: false },
    });
    expect(setDocMock).toHaveBeenCalledTimes(1);
  });

  it('pushProgress(setDoc)が失敗した場合、syncErrorに日本語メッセージがセットされる', async () => {
    user.set({ uid: 'uid' });
    setDocMock.mockRejectedValueOnce(new Error('network error'));

    service.recordDrillResult('key', true);
    await vi.waitFor(() => {
      expect(service.syncError()).toBe(
        'ドリル進捗のクラウド同期に失敗しました。ローカルには保存されています。',
      );
    });
  });

  it('pushProgress成功時はsyncErrorがnullにリセットされる', async () => {
    user.set({ uid: 'uid' });
    setDocMock.mockRejectedValueOnce(new Error('fail once'));
    service.recordDrillResult('key', true);
    await vi.waitFor(() => expect(service.syncError()).not.toBeNull());

    setDocMock.mockResolvedValueOnce(undefined);
    service.recordDrillResult('key', true);
    await vi.waitFor(() => expect(service.syncError()).toBeNull());
  });

  it('syncFromCloud失敗時はsyncErrorにメッセージがセットされる（ログイン時のeffect経由）', async () => {
    getDocMock.mockRejectedValue(new Error('offline'));

    user.set({ uid: 'uid' });

    await vi.waitFor(() => {
      expect(service.syncError()).toBe(
        'ドリル進捗のクラウド同期に失敗しました。ローカルには保存されています。',
      );
    });
  });

  it('syncFromCloud成功時、drillProgressはlastAttemptAtが新しい方をマージ採用する', async () => {
    store.recordDrillResult('local-newer', true); // ローカル側が新しい lastAttemptAt を持つ
    const cloudData = {
      drillProgress: {
        'local-newer': { correctStreak: 99, lastAttemptAt: '2000-01-01T00:00:00.000Z' },
        'cloud-only': { correctStreak: 1, lastAttemptAt: '2024-01-01T00:00:00.000Z' },
      },
      levelUpProgress: {},
    };
    getDocMock.mockResolvedValue(cloudDoc(cloudData));

    await service.syncFromCloud('uid');

    expect(store.getDrillProgress('local-newer')?.correctStreak).toBe(1); // ローカルの値が優先される
    expect(store.getDrillProgress('cloud-only')?.correctStreak).toBe(1); // クラウドのみの値は取り込まれる
  });

  it('syncFromCloud成功時、correctCount/attemptCountは大きい方を採用する（新しい方で上書きしない）', async () => {
    store.recordDrillResult('shared', true); // ローカル: 1/1、かつ lastAttemptAt はローカルが新しい
    const cloudData = {
      drillProgress: {
        shared: {
          correctStreak: 3,
          correctCount: 5,
          attemptCount: 8,
          lastAttemptAt: '2000-01-01T00:00:00.000Z',
        },
      },
      levelUpProgress: {},
    };
    getDocMock.mockResolvedValue(cloudDoc(cloudData));

    await service.syncFromCloud('uid');

    expect(store.getDrillProgress('shared')?.correctStreak).toBe(1); // ストリークはローカル（新しい方）
    expect(store.getDrillProgress('shared')?.correctCount).toBe(5); // カウンタは大きい方
    expect(store.getDrillProgress('shared')?.attemptCount).toBe(8);
  });

  it('syncFromCloud成功時、levelUpProgressはmaskLevelが大きい方をマージ採用する', async () => {
    store.setLevelUpItemProgress('s1', 'item', 1, false);
    const cloudData = {
      drillProgress: {},
      levelUpProgress: {
        s1: { item: { maskLevel: 3, completed: true } },
      },
    };
    getDocMock.mockResolvedValue(cloudDoc(cloudData));

    await service.syncFromCloud('uid');

    expect(store.getLevelUpProgress('s1')).toEqual({ item: { maskLevel: 3, completed: true } });
  });
});
