/**
 * @file Firestore のドキュメント／コレクション参照を組み立てる共通ヘルパー。
 * 全データは apps/eibun_lab/users/{uid} 配下に置く。先頭の apps/eibun_lab は、同一 Firebase
 * プロジェクトへ別アプリを追加しても衝突しないための名前空間。
 * 同期サービス（sessions / drillProgress / gamification）はこのヘルパー経由でのみパスを組み立て、
 * パス文字列を各サービスへ散らばらせない。
 */
import { collection, doc } from 'firebase/firestore';
import { firestore } from './firebase.init';

// ── ユーザーデータの名前空間（全同期サービス共通の接頭辞） ─────────────
const APP_NAMESPACE = ['apps', 'eibun_lab', 'users'] as const;

/** apps/eibun_lab/users/{uid}/{...segments} のドキュメント参照を返す（segments は奇数個）。 */
export function userDoc(uid: string, ...segments: string[]) {
  return doc(firestore, ...APP_NAMESPACE, uid, ...segments);
}

/** apps/eibun_lab/users/{uid}/{...segments} のコレクション参照を返す（segments は偶数個）。 */
export function userCol(uid: string, ...segments: string[]) {
  return collection(firestore, ...APP_NAMESPACE, uid, ...segments);
}
