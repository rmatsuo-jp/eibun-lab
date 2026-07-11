/**
 * @file クリップボードへのコピーを行う純粋なラッパー関数。
 */

// navigator.clipboard は secure context (HTTPS/localhost) でのみ利用可能。呼び出し元で try/catch すること。
export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
