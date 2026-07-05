import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';
import { AuthService } from '../firebase/auth.service';
import { CorrectionSession } from '../../models/session.model';

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

// StorageService は内部サービス（SessionStoreService/FirestoreSyncService/SettingsStoreService/
// DrillProgressService/session-stats.util）への薄いファサード。ここでは委譲が正しく動くことのみ確認し、
// 各集計ロジックの詳細ケースは session-stats.util.spec.ts 側でカバーする。
describe('StorageService（ファサード）', () => {
  let service: StorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        StorageService,
        { provide: AuthService, useValue: { user: signal(null) } },
      ],
    });
    service = TestBed.inject(StorageService);
  });

  it('saveSession したセッションが sessions/統計に反映される', () => {
    service.saveSession(makeSession({ mistakes: [{ category: '文法', original: 'a', corrected: 'b', explanation: '' }] }));
    expect(service.sessions().length).toBe(1);
    expect(service.getStudyStats().totalSessions).toBe(1);
    expect(service.getMistakeStats()).toEqual([{ category: '文法', count: 1 }]);
  });

  it('deleteSession で論理削除され、sessions から除外される', () => {
    service.saveSession(makeSession({ id: 'x' }));
    service.deleteSession('x');
    expect(service.sessions().length).toBe(0);
  });

  it('設定の保存・取得ができる', () => {
    service.saveSettings({ apiKey: 'k', modelPriority: ['m1'], theme: 'light' });
    expect(service.getSettings()).toEqual({ apiKey: 'k', modelPriority: ['m1'], theme: 'light' });
  });

  it('ドリル進捗の記録・取得ができる', () => {
    service.recordDrillResult('foo', true);
    expect(service.getDrillProgress('foo')?.correctStreak).toBe(1);
  });
});
