/**
 * @file セッション（CorrectionSession）のローカル永続化を担うサービス。
 * セッション永続化のうち「LocalStorageへのCRUD」専任部分。SessionRepositoryService から利用される。Firestore同期は firestore-sync.service.ts が
 * このサービスの signal を読み書きすることで担当し、ここではクラウドの存在を意識しない。
 * _sessions は tombstone（deleted=true）も含む全件の源泉。localStorage / Firestore と一致する。
 * 公開の sessions は削除済みを除外したビューで、表示・集計はすべてこちらを基準にする。
 * localStorage への書き込み失敗（容量超過等）は persist() で検知し、alert でユーザーに通知する。
 * 別タブによる localStorage 変更は storage イベントで検知し、_sessions を再読込して追随する。
 */
import { computed, Injectable, signal } from '@angular/core';
import { CorrectionSession } from '@core/models/session.model';
import { readJson, writeJson } from '@shared/utils/local-storage.util';

const SESSIONS_KEY = 'correction_sessions';

@Injectable({ providedIn: 'root' })
export class SessionStoreService {
  // ── 状態管理（signal） ─────────────────────────────────────────
  // _sessions は tombstone（deleted=true）も含む全件の源泉。localStorage / Firestore と一致する。
  private _sessions = signal<CorrectionSession[]>(this.loadFromStorage());
  // 公開ビューは削除済みを除外。表示・集計はすべてこちらを基準にする。
  readonly sessions = computed(() => this._sessions().filter(s => !s.deleted));

  // tombstone を含む全件（Firestore同期がローカル/クラウドの突き合わせに使う）。
  readonly allSessions = this._sessions;

  constructor() {
    // 別タブが localStorage を書き換えても現タブの signal は古いままなので、
    // storage イベント（仕様上「他タブの変更時のみ」発火する）で再読込して追随する。
    // これをしないと、現タブの次回 persist() が別タブの保存・削除を古い配列で上書きして消してしまう。
    // リスナー内は signal の再読込のみで、Firestore push 等の副作用は起こさない（タブ間の連鎖を防ぐ）。
    window.addEventListener('storage', (event) => {
      if (event.key === SESSIONS_KEY) {
        this._sessions.set(this.loadFromStorage());
      }
    });
  }

  // ── 読み込み ───────────────────────────────────────────────────
  private loadFromStorage(): CorrectionSession[] {
    return readJson<CorrectionSession[]>(SESSIONS_KEY, []);
  }

  // ── 書き込み系（保存・論理削除） ───────────────────────────────
  persist(sessions: CorrectionSession[]): void {
    // 書き込み失敗（localStorage 容量超過等）はユーザーに即通知する。signal は更新するため
    // 画面上は保存されたように見えるが、リロードで消えることを伝えてエクスポートを促す。
    if (!writeJson(SESSIONS_KEY, sessions)) {
      alert(
        'ブラウザの保存容量が上限に達したため、セッションを保存できませんでした。\n' +
          '履歴ページから古いセッションを削除するか、エクスポートでバックアップしてください。'
      );
    }
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

  // ── インポート/エクスポート ────────────────────────────────────
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
