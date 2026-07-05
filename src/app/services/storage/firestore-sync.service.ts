/**
 * @file セッションの Firestore 双方向同期を担うサービス。
 * StorageService から切り出した「クラウド同期」専任部分。SessionStoreService の signal を読み書きし、
 * ログイン状態（AuthService）を監視して、ログインした瞬間にクラウドと双方向同期する。
 * 削除は物理削除せず deleted フラグ（tombstone）で表現し、削除も多端末へ伝播させる。
 */
import { effect, Injectable, inject } from '@angular/core';
import {
  collection,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { CorrectionSession } from '../../models/session.model';
import { AuthService } from '../firebase/auth.service';
import { firestore } from '../firebase/firebase.init';
import { SessionStoreService } from './session-store.service';

@Injectable({ providedIn: 'root' })
export class FirestoreSyncService {
  private auth = inject(AuthService);
  private sessionStore = inject(SessionStoreService);

  constructor() {
    // ログイン状態を監視し、ログインした瞬間にクラウドと双方向同期する。
    // ログアウト時（user が null）はローカルキャッシュをそのまま残す。
    effect(() => {
      const user = this.auth.user();
      if (user) {
        this.syncFromCloud(user.uid).catch(err =>
          console.error('[FirestoreSyncService] クラウド同期に失敗:', err)
        );
      }
    });
  }

  // apps/study_english/users/{uid}/sessions/{sessionId} のドキュメント参照を返す。
  // 先頭の apps/study_english は、同一 Firebase プロジェクトに別アプリを追加しても衝突しないための名前空間。
  private sessionDoc(uid: string, sessionId: string) {
    return doc(firestore, 'apps', 'study_english', 'users', uid, 'sessions', sessionId);
  }

  // apps/study_english/users/{uid}/sessions コレクション参照を返す
  private sessionsCol(uid: string) {
    return collection(firestore, 'apps', 'study_english', 'users', uid, 'sessions');
  }

  // Firestore は undefined を受け付けないため、値が undefined の任意フィールド（evaluation / reviewItems / levelUpItems）を
  // フィールドごと除外する。任意フィールドが増えても OPTIONAL_FIELDS に足すだけで対応できる。
  private toDocData(session: CorrectionSession): Record<string, unknown> {
    const OPTIONAL_FIELDS: (keyof CorrectionSession)[] = ['evaluation', 'reviewItems', 'levelUpItems'];
    const data: Record<string, unknown> = { ...session };
    for (const field of OPTIONAL_FIELDS) {
      if (data[field] === undefined) delete data[field];
    }
    return data;
  }

  // セッション保存/削除/インポートの直後に呼び、ログイン中なら該当分だけクラウドへ反映する（fire-and-forget）。
  // 単数・複数どちらの呼び出し元もこのメソッド1本に集約する。
  pushSessions(sessions: CorrectionSession[]): void {
    const uid = this.auth.user()?.uid;
    if (!uid || sessions.length === 0) return;
    Promise.all(
      sessions.map(s => setDoc(this.sessionDoc(uid, s.id), this.toDocData(s)))
    ).catch(err => console.error('[FirestoreSyncService] 一括同期に失敗:', err));
  }

  // ログイン直後に呼ぶ双方向同期（tombstone 対応）:
  //   1. ローカルとクラウドを id で突き合わせ、同一 id は deleted の OR を採用（片方でも削除なら削除）。
  //   2. クラウドと状態が食い違うローカル分（未登録 or deleted 状態の差）をクラウドへ push。
  // これにより、削除した端末の tombstone が他端末へ伝播し、未削除端末からの再 push による復活を防ぐ。
  async syncFromCloud(uid: string): Promise<void> {
    const snap = await getDocs(this.sessionsCol(uid));
    const cloud = snap.docs.map(d => d.data() as CorrectionSession);

    const local = this.sessionStore.allSessions();
    const localById = new Map(local.map(s => [s.id, s]));
    const cloudById = new Map(cloud.map(s => [s.id, s]));

    // 1. union を取り、同一 id は deleted を OR してマージ
    const allIds = new Set([...localById.keys(), ...cloudById.keys()]);
    const merged: CorrectionSession[] = [...allIds].map(id => {
      const l = localById.get(id);
      const c = cloudById.get(id);
      const base = l ?? c!;
      const deleted = Boolean(l?.deleted) || Boolean(c?.deleted);
      return deleted ? { ...base, deleted: true } : { ...base };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    this.sessionStore.persist(merged);

    // 2. クラウドと食い違うローカル分（未登録、または deleted 状態が異なる）を push
    const toPush = merged.filter(s => {
      const c = cloudById.get(s.id);
      return !c || Boolean(c.deleted) !== Boolean(s.deleted);
    });
    await Promise.all(
      toPush.map(s => setDoc(this.sessionDoc(uid, s.id), this.toDocData(s)))
    );
  }
}
