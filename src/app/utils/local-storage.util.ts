/**
 * @file localStorage の読み書きを共通化する純粋ユーティリティ。JSONパース失敗時のフォールバックを一元化する。
 */

// 指定キーの値をJSONとして読み込む。存在しない/パース失敗時は fallback を返す。
export function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// 指定キーへ値をJSONとして書き込む。
export function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}
