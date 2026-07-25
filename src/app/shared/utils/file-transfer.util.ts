/**
 * @file JSONファイルのダウンロード／読み込みに伴うブラウザAPI定型処理をまとめたヘルパー。
 * practice / history が同じ Blob→anchor クリックや FileReader の手続きを複製していたのを1箇所へ集約する。
 * ダイアログ表示（alert/confirm）や解析結果の扱いは呼び出し側（コンポーネント）の責務として残す。
 */

/**
 * 文字列を JSON ファイルとしてダウンロードさせる。
 * 一時的な anchor 要素をクリックし、生成した ObjectURL は必ず解放する。
 */
export function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * <input type="file"> の change イベントから選択ファイルをテキストとして読み込み、onText へ渡す。
 * 読み込み後は input の value をリセットし、同じファイルを続けて選び直せるようにする。
 * ファイルが選ばれていない場合（キャンセル）は何もしない。
 */
export function readTextFile(event: Event, onText: (text: string) => void): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    onText(reader.result as string);
    input.value = '';
  };
  reader.readAsText(file);
}
