/**
 * @file セッションの Firestore 双方向同期を担うサービス。
 * セッション永続化のうち「クラウド同期」専任部分。SessionStoreService の signal を読み書きし、
 * ログイン状態（AuthService）を監視して、ログインした瞬間にクラウドと双方向同期する。
 * 削除は物理削除せず deleted フラグ（tombstone）で表現し、削除も多端末へ伝播させる。
 * mistakes/reviewItems/levelUpItems は配列要素自身にも optional フィールド（explanationEn 等）を
 * 持つため、トップレベルだけでなく配列要素内の undefined キーも stripUndefinedShallow() で除去する。
 * 同期エラー signal・ログイン監視・push の成否ハンドリングは CloudSyncBase（core/sync）から継承する。
 * push に失敗したセッションは pendingPush に保持し、オンライン復帰（window の online イベント）時に
 * 自動で再送する（この再送キューの出し入れは runPush() のフックで行う）。
 */
import { Injectable, inject } from '@angular/core';
import { getDocs, setDoc } from 'firebase/firestore';
import { CorrectionSession } from '@core/models/session.model';
import { userCol, userDoc } from '@core/firebase/firestore-paths';
import { CloudSyncBase } from '@core/sync/cloud-sync.base';
import { stripUndefinedShallow } from '@core/sync/strip-undefined.util';
import { SessionStoreService } from './session-store.service';

// 同期失敗時にユーザーへ見せるメッセージ（ローカル保存は成功している旨を必ず添える）。
const SYNC_ERROR_MESSAGE = '学習履歴のクラウド同期に失敗しました。ローカルには保存されています。';

// CorrectionSession の任意（optional）フィールド一覧。Firestore は undefined を受け付けないため、
// toDocData() で undefined のフィールドを除外するのに使う。
// OptionalKeys<CorrectionSession> は model 側の optional フィールド集合を型レベルで導出したもの。
// OPTIONAL_FIELDS_MAP のキーがこれと過不足あると tsc がコンパイルエラーにするため、
// session.model.ts への optional フィールド追加/削除を「ここへの追加忘れ」ごとビルドで検知できる。
type OptionalKeys<T> = { [K in keyof T]-?: undefined extends T[K] ? K : never }[keyof T];
const OPTIONAL_FIELDS_MAP: Record<OptionalKeys<CorrectionSession>, true> = {
  correctedText: true,
  correctedEn: true,
  grammarNotes: true,
  grammarNotesEn: true,
  naturalExpressions: true,
  naturalExpressionsEn: true,
  grammarTendency: true,
  grammarTendencyEn: true,
  cefrRationale: true,
  cefrRationaleEn: true,
  studyPlan: true,
  studyPlanEn: true,
  evaluation: true,
  reviewItems: true,
  levelUpItems: true,
  levelUpText: true,
  deleted: true,
  model: true,
};
const OPTIONAL_FIELDS = Object.keys(OPTIONAL_FIELDS_MAP) as (keyof CorrectionSession)[];

@Injectable({ providedIn: 'root' })
export class FirestoreSyncService extends CloudSyncBase {
  private sessionStore = inject(SessionStoreService);

  // push に失敗したセッションID。オンライン復帰時にこの分だけ再送する。
  private pendingPushIds = new Set<string>();

  constructor() {
    super('FirestoreSyncService', SYNC_ERROR_MESSAGE);
    this.initCloudSync();

    // オフライン中に失敗した push は、オンライン復帰時に自動で再送する。
    window.addEventListener('online', () => this.retryPendingPush());
  }

  // pendingPushIds に溜まっているセッションを、ローカルの最新状態で再送する。
  private retryPendingPush(): void {
    if (this.pendingPushIds.size === 0) return;
    const ids = this.pendingPushIds;
    const sessions = this.sessionStore.allSessions().filter((s) => ids.has(s.id));
    if (sessions.length > 0) this.pushSessions(sessions);
  }

  // apps/eibun_lab/users/{uid}/sessions/{sessionId} のドキュメント参照を返す（パス組み立ては firestore-paths）。
  private sessionDoc(uid: string, sessionId: string) {
    return userDoc(uid, 'sessions', sessionId);
  }

  // apps/eibun_lab/users/{uid}/sessions コレクション参照を返す
  private sessionsCol(uid: string) {
    return userCol(uid, 'sessions');
  }

  // Firestore は undefined を受け付けないため、値が undefined の任意フィールドをフィールドごと除外する。
  // 任意フィールドが増えてもモジュール先頭の OPTIONAL_FIELDS_MAP に足すだけで対応できる（型で強制）。
  // spec からの直接検証用に internal 公開（外部からの呼び出しは想定しない）。
  toDocData(session: CorrectionSession): Record<string, unknown> {
    const data: Record<string, unknown> = { ...session };
    for (const field of OPTIONAL_FIELDS) {
      if (data[field] === undefined) delete data[field];
    }
    if (data['mistakes'])
      data['mistakes'] = (data['mistakes'] as Record<string, unknown>[]).map(stripUndefinedShallow);
    if (data['reviewItems'])
      data['reviewItems'] = (data['reviewItems'] as Record<string, unknown>[]).map(
        stripUndefinedShallow,
      );
    if (data['levelUpItems'])
      data['levelUpItems'] = (data['levelUpItems'] as Record<string, unknown>[]).map(
        stripUndefinedShallow,
      );
    return data;
  }

  // セッション保存/削除/インポートの直後に呼び、ログイン中なら該当分だけクラウドへ反映する（fire-and-forget）。
  // 単数・複数どちらの呼び出し元もこのメソッド1本に集約する。
  pushSessions(sessions: CorrectionSession[]): void {
    const uid = this.auth.user()?.uid;
    if (!uid || sessions.length === 0) return;
    this.runPush(
      Promise.all(sessions.map((s) => setDoc(this.sessionDoc(uid, s.id), this.toDocData(s)))),
      {
        onSuccess: () => {
          for (const s of sessions) this.pendingPushIds.delete(s.id);
        },
        onFailure: () => {
          for (const s of sessions) this.pendingPushIds.add(s.id);
        },
      },
    );
  }

  // ログイン直後に呼ぶ双方向同期（tombstone 対応）:
  //   1. ローカルとクラウドを id で突き合わせ、同一 id は deleted の OR を採用（片方でも削除なら削除）。
  //   2. クラウドと状態が食い違うローカル分（未登録 or deleted 状態の差）をクラウドへ push。
  // これにより、削除した端末の tombstone が他端末へ伝播し、未削除端末からの再 push による復活を防ぐ。
  async syncFromCloud(uid: string): Promise<void> {
    const snap = await getDocs(this.sessionsCol(uid));
    const cloud = snap.docs.map((d) => d.data() as CorrectionSession);

    const local = this.sessionStore.allSessions();
    const localById = new Map(local.map((s) => [s.id, s]));
    const cloudById = new Map(cloud.map((s) => [s.id, s]));

    // 1. union を取り、同一 id は deleted を OR してマージ
    const allIds = new Set([...localById.keys(), ...cloudById.keys()]);
    const merged: CorrectionSession[] = [...allIds]
      .map((id) => {
        const l = localById.get(id);
        const c = cloudById.get(id);
        const base = l ?? c!;
        const deleted = Boolean(l?.deleted) || Boolean(c?.deleted);
        return deleted ? { ...base, deleted: true } : { ...base };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    this.sessionStore.persist(merged);

    // 2. クラウドと食い違うローカル分（未登録、または deleted 状態が異なる）を push
    const toPush = merged.filter((s) => {
      const c = cloudById.get(s.id);
      return !c || Boolean(c.deleted) !== Boolean(s.deleted);
    });
    await Promise.all(toPush.map((s) => setDoc(this.sessionDoc(uid, s.id), this.toDocData(s))));
  }
}
