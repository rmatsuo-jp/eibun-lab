import { vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FirestoreSyncService } from './firestore-sync.service';
import { SessionStoreService } from './session-store.service';
import { AuthService } from '../firebase/auth.service';
import { CorrectionSession } from '@core/models/session.model';

const { getDocsMock, setDocMock } = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
  setDocMock: vi.fn().mockResolvedValue(undefined),
}));

// firebase.init.ts が initializeFirestore 等を実行するため、firebase/firestore は
// 丸ごとモック化する（IndexedDB前提のpersistentLocalCacheはjsdomで動作しないため）。
vi.mock('firebase/firestore', () => ({
  initializeFirestore: () => ({}),
  persistentLocalCache: () => ({}),
  persistentMultipleTabManager: () => ({}),
  collection: (...args: unknown[]) => ({ __col: args }),
  doc: (...args: unknown[]) => ({ __doc: args }),
  getDocs: getDocsMock,
  setDoc: setDocMock,
}));

function makeSession(partial: Partial<CorrectionSession>): CorrectionSession {
  return {
    id: partial.id ?? 'id',
    date: partial.date ?? new Date().toISOString(),
    original: partial.original ?? '',
    corrected: partial.corrected ?? '',
    mistakes: partial.mistakes ?? [],
    ...partial,
  };
}

function cloudSnap(sessions: CorrectionSession[]) {
  return { docs: sessions.map(s => ({ data: () => s })) };
}

// syncFromCloud()のtombstone突き合わせマージロジックを中心に検証する。
// Firestore SDK自体はモック化し、ローカルストア(SessionStoreService)の実体を使う。
describe('FirestoreSyncService', () => {
  let service: FirestoreSyncService;
  let sessionStore: SessionStoreService;

  beforeEach(() => {
    localStorage.clear();
    getDocsMock.mockReset();
    setDocMock.mockClear();
    TestBed.configureTestingModule({
      providers: [
        FirestoreSyncService,
        SessionStoreService,
        { provide: AuthService, useValue: { user: signal(null) } },
      ],
    });
  });

  it('ローカルのみに存在するセッションはそのまま残り、クラウドへpushされる', async () => {
    sessionStore = TestBed.inject(SessionStoreService);
    sessionStore.persist([makeSession({ id: 'local-only' })]);
    getDocsMock.mockResolvedValue(cloudSnap([]));
    service = TestBed.inject(FirestoreSyncService);

    await service.syncFromCloud('uid');

    expect(sessionStore.allSessions().map(s => s.id)).toEqual(['local-only']);
    expect(setDocMock).toHaveBeenCalledTimes(1);
  });

  it('クラウドのみに存在するセッションはローカルへ取り込まれる', async () => {
    sessionStore = TestBed.inject(SessionStoreService);
    getDocsMock.mockResolvedValue(cloudSnap([makeSession({ id: 'cloud-only' })]));
    service = TestBed.inject(FirestoreSyncService);

    await service.syncFromCloud('uid');

    expect(sessionStore.allSessions().map(s => s.id)).toEqual(['cloud-only']);
    // クラウド側とdeleted状態の食い違いがないためpushは発生しない
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('片方でもdeletedならOR結合でdeleted扱いになり、他端末へ伝播するためpushされる', async () => {
    sessionStore = TestBed.inject(SessionStoreService);
    sessionStore.persist([makeSession({ id: 'x', deleted: true })]);
    getDocsMock.mockResolvedValue(cloudSnap([makeSession({ id: 'x', deleted: false })]));
    service = TestBed.inject(FirestoreSyncService);

    await service.syncFromCloud('uid');

    const merged = sessionStore.allSessions().find(s => s.id === 'x');
    expect(merged?.deleted).toBe(true);
    expect(setDocMock).toHaveBeenCalledTimes(1);
  });

  it('ローカル・クラウド双方に同一状態で存在する場合はpushしない', async () => {
    sessionStore = TestBed.inject(SessionStoreService);
    sessionStore.persist([makeSession({ id: 'same' })]);
    getDocsMock.mockResolvedValue(cloudSnap([makeSession({ id: 'same' })]));
    service = TestBed.inject(FirestoreSyncService);

    await service.syncFromCloud('uid');

    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('optionalフィールドがundefinedの場合、toDocData経由でFirestoreへ送るデータから除外される', async () => {
    sessionStore = TestBed.inject(SessionStoreService);
    sessionStore.persist([makeSession({ id: 'a', evaluation: undefined })]);
    getDocsMock.mockResolvedValue(cloudSnap([]));
    service = TestBed.inject(FirestoreSyncService);

    await service.syncFromCloud('uid');

    const sentData = setDocMock.mock.calls[0][1];
    expect('evaluation' in sentData).toBe(false);
  });
});
