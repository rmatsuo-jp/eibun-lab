import { vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SessionRepositoryService } from './session-repository.service';
import { FirestoreSyncService } from './firestore-sync.service';
import { AuthService } from '../firebase/auth.service';
import { CorrectionSession } from '@core/models/session.model';

// テスト用セッション生成ヘルパ
function makeSession(partial: Partial<CorrectionSession>): CorrectionSession {
  return {
    id: partial.id ?? Math.random().toString(),
    date: partial.date ?? new Date().toISOString(),
    original: partial.original ?? '',
    corrected: partial.corrected ?? '',
    mistakes: partial.mistakes ?? [],
    evaluation: partial.evaluation,
  };
}

// SessionRepositoryService は「ローカル保存（SessionStore）→ クラウド push（FirestoreSync）」を
// 1箇所に集約したリポジトリ。ここではローカル反映と、書き込み系操作ごとに pushSessions が
// 1回だけ呼ばれることを確認する。統計ロジックは session-stats.util.spec.ts 側でカバーする。
describe('SessionRepositoryService', () => {
  let service: SessionRepositoryService;
  let pushSessions: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    pushSessions = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        SessionRepositoryService,
        { provide: FirestoreSyncService, useValue: { pushSessions } },
        { provide: AuthService, useValue: { user: signal(null) } },
      ],
    });
    service = TestBed.inject(SessionRepositoryService);
  });

  it('saveSession したセッションが sessions に反映され、クラウドへ1回 push される', () => {
    const session = makeSession({ id: 'a' });
    service.saveSession(session);
    expect(service.sessions().length).toBe(1);
    expect(pushSessions).toHaveBeenCalledTimes(1);
    expect(pushSessions).toHaveBeenCalledWith([session]);
  });

  it('deleteSession で論理削除され、tombstone がクラウドへ push される', () => {
    service.saveSession(makeSession({ id: 'x' }));
    pushSessions.mockClear();
    service.deleteSession('x');
    expect(service.sessions().length).toBe(0);
    expect(pushSessions).toHaveBeenCalledTimes(1);
    expect(pushSessions.mock.calls[0][0][0]).toMatchObject({ id: 'x', deleted: true });
  });

  it('importSessions は新規分のみ追加し、その分だけクラウドへ push される', () => {
    const existing = makeSession({ id: 'dup' });
    service.saveSession(existing);
    pushSessions.mockClear();
    const fresh = makeSession({ id: 'new' });
    service.importSessions([existing, fresh]);
    expect(service.sessions().length).toBe(2);
    expect(pushSessions).toHaveBeenCalledTimes(1);
    expect(pushSessions).toHaveBeenCalledWith([fresh]);
  });

  it('exportSessions は削除済みを除いた JSON を返す', () => {
    service.saveSession(makeSession({ id: 'keep' }));
    service.saveSession(makeSession({ id: 'gone' }));
    service.deleteSession('gone');
    const exported = JSON.parse(service.exportSessions()) as CorrectionSession[];
    expect(exported.map(s => s.id)).toEqual(['keep']);
  });
});
