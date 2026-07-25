/**
 * @file 日時フォーマット用の純粋関数群。
 */

// ── エクスポートファイル名用タイムスタンプ ──────────────────────────
/** ローカル時刻を YYMMDDhhmm 形式の文字列にする（ダウンロードファイル名に使用）。 */
export function formatTimestampForFilename(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yy = pad(date.getFullYear() % 100);
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${yy}${mm}${dd}${hh}${mi}`;
}

// ── 表示用フォーマット ────────────────────────────────────────────
/** ISO日時をローカル時刻の M/D 形式にする（推移グラフの横軸・一覧の日付表示で共用）。 */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 「2026年1月1日(木)」相当の完全表記。履歴一覧とカレンダーの日付見出しで共用する。 */
export const FULL_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
};

/**
 * 表示言語（'en' なら en-US、それ以外は ja-JP）で日付をロケール整形する。
 * 履歴一覧・カレンダーの見出しなど、言語切替に追随させたい日付表示で共用する。
 * shared 層は core/i18n の Lang 型に依存できないため、言語コードは文字列で受け取る。
 */
export function formatLocaleDate(
  date: Date | string,
  lang: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'ja-JP', options);
}

// ── 日付キー正規化（streak集計・カレンダー表示で共用） ───────────────
/** ISO日時をローカル時刻の YYYY-MM-DD キーに正規化する。 */
export function toDayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
