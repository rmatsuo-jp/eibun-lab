/**
 * @file Google SSO 認証を担うサービス。
 * Firebase Auth の onAuthStateChanged を signal に流し込み、ログイン状態をリアクティブに公開する。
 * login()（Google: popup→redirect フォールバック）・logout() を提供する。同期処理は StorageService 側が user signal を監視して実行する。
 */
import { Injectable, signal } from '@angular/core';
import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from './firebase.init';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // ── ログイン状態（読み取り専用 signal で公開） ───────────────────
  private _user = signal<User | null>(null);
  readonly user = this._user.asReadonly();

  // 初回の認証状態解決が済んだか（起動直後のちらつき防止に利用可能）
  private _ready = signal(false);
  readonly ready = this._ready.asReadonly();

  constructor() {
    // Firebase 管理外で発火するコールバックを signal に反映する（NgZone 不要）
    onAuthStateChanged(auth, user => {
      this._user.set(user);
      this._ready.set(true);
    });
    // リダイレクト方式でログインした場合、戻ってきた際に結果を回収する
    // （状態反映自体は onAuthStateChanged が担当。ここはエラー検知のため）
    getRedirectResult(auth).catch(err =>
      console.error('[AuthService] リダイレクトログインの結果取得に失敗:', err)
    );
  }

  // ── ログイン（Google） ────────────────────────────────────────────
  // まず popup を試し、ブロック／PWA非対応で失敗したら redirect にフォールバックする。
  // （インストール済みモバイルPWA・iOS では popup が使えないことが多いため）
  async login(): Promise<void> {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.warn('[AuthService] popup ログイン失敗、redirect に切替:', err);
      await signInWithRedirect(auth, provider);
    }
  }

  // ── ログアウト ────────────────────────────────────────────────────
  async logout(): Promise<void> {
    await signOut(auth);
  }
}
