/**
 * @file 英文プレーンテキストを文単位に分割し改行を挿入する純粋関数。
 */
// ── 文単位の改行挿入 ──────────────────────────────
export function insertSentenceBreaks(text: string): string {
  return text
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z"'])/)
    .join('\n\n');
}
