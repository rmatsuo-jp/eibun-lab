/**
 * @file セッション永続化の窓口となるリポジトリサービス。
 * 「ローカル保存（SessionStoreService）→ クラウド反映（FirestoreSyncService.pushSessions）」の
 * 組み合わせを syncToCloud() の1箇所に集約し、書き込み系操作の呼び忘れによるクラウド乖離を防ぐ。
 * 設定・ドリル進捗・統計集計は扱わない（それぞれ SettingsStoreService / DrillProgressService /
 * session-stats.util を利用側が直接参照する）。
 */
import { Injectable, inject } from '@angular/core';
import { CorrectionSession } from '@core/models/session.model';
import { FirestoreSyncService } from './firestore-sync.service';
import { SessionStoreService } from './session-store.service';

@Injectable({ providedIn: 'root' })
export class SessionRepositoryService {
  private sessionStore = inject(SessionStoreService);
  private firestoreSync = inject(FirestoreSyncService);

  // 公開ビューは削除済み（tombstone）を除外。表示・集計はすべてこちらを基準にする。
  readonly sessions = this.sessionStore.sessions;

  // ── 書き込み系（ローカル保存 + クラウド push を必ずペアで実行） ──────
  saveSession(session: CorrectionSession): void {
    this.sessionStore.saveSession(session);
    this.syncToCloud([session]);
  }

  deleteSession(id: string): void {
    this.sessionStore.deleteSession(id);
    const target = this.sessionStore.allSessions().find(s => s.id === id);
    if (target) this.syncToCloud([target]);
  }

  importSessions(incoming: CorrectionSession[]): void {
    const added = this.sessionStore.importSessions(incoming);
    this.syncToCloud(added);
  }

  exportSessions(): string {
    return this.sessionStore.exportSessions();
  }

  // ローカル書き込み後のクラウド反映（fire-and-forget）。書き込み系操作を追加する際は必ずこれを呼ぶ。
  private syncToCloud(sessions: CorrectionSession[]): void {
    this.firestoreSync.pushSessions(sessions);
  }
}
