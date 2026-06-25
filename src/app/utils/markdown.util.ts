/**
 * @file Markdown を安全な HTML 文字列へ変換する純粋関数。
 * Gemini 応答（信頼境界外）を marked で HTML 化したうえで DOMPurify でサニタイズし、
 * <script> や onerror 等のイベントハンドラ・javascript: スキームを除去する。
 * 各ページはこの戻り値を DomSanitizer.bypassSecurityTrustHtml() に渡す。
 */
import DOMPurify from 'dompurify';
import { marked } from 'marked';

// ── Markdown → サニタイズ済み HTML 文字列 ───────────────────────────
export function renderSafeMarkdown(markdown: string): string {
  const rawHtml = marked.parse(markdown) as string;
  return DOMPurify.sanitize(rawHtml);
}
