/**
 * @file セッション（CorrectionSession）のローカル永続化を担うサービス。
 * StorageService から切り出した「LocalStorageへのCRUD」専任部分。Firestore同期は firestore-sync.service.ts が
 * このサービスの signal を読み書きすることで担当し、ここではクラウドの存在を意識しない。
 * _sessions は tombstone（deleted=true）も含む全件の源泉。localStorage / Firestore と一致する。
 * 公開の sessions は削除済みを除外したビューで、表示・集計はすべてこちらを基準にする。
 */
import { computed, Injectable, signal } from '@angular/core';
import { CorrectionSession } from '../../models/session.model';

const SESSIONS_KEY = 'correction_sessions';

@Injectable({ providedIn: 'root' })
export class SessionStoreService {
  // _sessions は tombstone（deleted=true）も含む全件の源泉。localStorage / Firestore と一致する。
  private _sessions = signal<CorrectionSession[]>(this.loadFromStorage());
  // 公開ビューは削除済みを除外。表示・集計はすべてこちらを基準にする。
  readonly sessions = computed(() => this._sessions().filter(s => !s.deleted));

  // tombstone を含む全件（Firestore同期がローカル/クラウドの突き合わせに使う）。
  readonly allSessions = this._sessions;

  private loadFromStorage(): CorrectionSession[] {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as CorrectionSession[];
    } catch {
      return [];
    }
  }

  persist(sessions: CorrectionSession[]): void {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    this._sessions.set(sessions);
  }

  saveSession(session: CorrectionSession): void {
    this.persist([session, ...this._sessions()]);
  }

  // 物理削除せず deleted フラグを立てる（tombstone）。これによりクラウド側へ削除を伝播でき、
  // 他端末の syncFromCloud で「削除済み」として反映され、再 push による復活を防ぐ。
  deleteSession(id: string): void {
    const updated = this._sessions().map(s =>
      s.id === id ? { ...s, deleted: true } : s
    );
    this.persist(updated);
  }

  importSessions(incoming: CorrectionSession[]): CorrectionSession[] {
    const existing = this._sessions();
    const existingIds = new Set(existing.map(s => s.id));
    const added = incoming.filter(s => !existingIds.has(s.id));
    const merged = [...existing, ...added]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    this.persist(merged);
    return added;
  }

  exportSessions(): string {
    return JSON.stringify(this.sessions(), null, 2);
  }
}
