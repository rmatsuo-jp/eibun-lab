/**
 * @file Firebase SDK の初期化。アプリ全体で 1 度だけ initializeApp() を実行し、
 * Auth と Firestore のインスタンスを生成して共有する。
 * Firestore はオフライン書き込みに耐えるため persistentLocalCache（IndexedDB）を有効化する。
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { environment } from '../../../environments/environment';

// ── 初期化（モジュール読み込み時に 1 度だけ実行される） ──────────────
const app = initializeApp(environment.firebase);

// ── 認証インスタンス（Google SSO で使用） ─────────────────────────
export const auth = getAuth(app);

// ── Firestore インスタンス（オフラインキャッシュ有効。複数タブ対応） ─
export const firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
