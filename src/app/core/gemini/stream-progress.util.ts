/**
 * @file Gemini のストリーミング受信中に「今どこまで進んだか」を 0〜100 の百分率で算出する純粋関数群。
 * プロンプト（prompt.util.ts の SECTIONS）はタグの出力順が固定なので、受信済みテキストに現れた
 * 閉じタグを「確定したマイルストーン」として扱い、その間は受信文字数の比率で補間する。
 * 期待総文字数は過去の成功レスポンス長の中央値（localStorage）を使い、履歴が無い初回は既定値を使う。
 * ストリーム中は 95% で頭打ちにし、100% は呼び出し側が受信完了時にセットする。DIなしで単体テスト可能。
 */
import { readJson, writeJson } from '@shared/utils/local-storage.util';

// ── マイルストーン定義 ───────────────────────────────────────────
// prompt.util.ts の出力順（corrected-text → mistakes → evaluation → level-study-plan →
// levelup → levelup-text → review）が正。順序を変えたらこの配列も追従させること。
export const MILESTONES: readonly (readonly [tag: string, percent: number])[] = [
  ['</corrected-text>', 20],
  ['</mistakes>', 35],
  ['</evaluation>', 45],
  ['</levelup>', 70],
  ['</levelup-text>', 85],
  ['</review>', 95],
];

// ストリーム中に到達できる上限。100% は受信完了後にのみ表示する。
export const MAX_STREAM_PERCENT = 95;

// レスポンス長の履歴が無い初回に使う期待総文字数。
export const DEFAULT_EXPECTED_CHARS = 6000;

const LENGTH_HISTORY_KEY = 'gemini-response-lengths';
const LENGTH_HISTORY_SIZE = 10;

// ── 進捗率の算出 ─────────────────────────────────────────────────
// 「到達済みマイルストーンの％」と「文字数比による推定％」の大きい方を採る。
// マイルストーンは確定情報なので下限として働き、その先はバーが止まって見えないよう文字数比が押し上げる。
export function computeProgress(accumulatedText: string, expectedTotalChars: number): number {
  let milestonePercent = 0;
  for (const [tag, percent] of MILESTONES) {
    if (accumulatedText.includes(tag)) milestonePercent = percent;
  }

  const safeExpected = expectedTotalChars > 0 ? expectedTotalChars : DEFAULT_EXPECTED_CHARS;
  const ratioPercent = (accumulatedText.length / safeExpected) * MAX_STREAM_PERCENT;

  return Math.min(MAX_STREAM_PERCENT, Math.floor(Math.max(milestonePercent, ratioPercent)));
}

// ── 期待総文字数（過去レスポンス長の中央値） ─────────────────────
// 平均でなく中央値を使うのは、極端に長い/短い1回の添削に引きずられないため。
export function getExpectedTotalChars(): number {
  const history = readJson<number[]>(LENGTH_HISTORY_KEY, []).filter(n => typeof n === 'number' && n > 0);
  if (history.length === 0) return DEFAULT_EXPECTED_CHARS;
  return median(history);
}

// 成功したレスポンスの文字数を履歴へ追記する（直近 LENGTH_HISTORY_SIZE 件のみ保持）。
export function recordResponseLength(length: number): void {
  if (length <= 0) return;
  const history = readJson<number[]>(LENGTH_HISTORY_KEY, []).filter(n => typeof n === 'number' && n > 0);
  history.push(length);
  writeJson(LENGTH_HISTORY_KEY, history.slice(-LENGTH_HISTORY_SIZE));
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
