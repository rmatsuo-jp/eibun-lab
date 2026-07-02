/**
 * @file クリップボードへのコピーを行う純粋なラッパー関数。
 */

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
