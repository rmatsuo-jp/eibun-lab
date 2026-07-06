/**
 * @file localStorage の読み書きを共通化する純粋ユーティリティ。JSONパース失敗時のフォールバックと、
 * 書き込み失敗（QuotaExceededError 等）の捕捉を一元化する。writeJson は成否を boolean で返す。
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

// 指定キーへ値をJSONとして書き込む。容量超過（QuotaExceededError）等で失敗した場合は
// 例外を握りつぶさず false を返し、呼び出し元がユーザーへの通知を判断できるようにする。
export function writeJson<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`[local-storage] "${key}" の書き込みに失敗しました:`, e);
    return false;
  }
}
