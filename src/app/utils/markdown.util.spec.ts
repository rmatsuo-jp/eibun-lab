import { renderSafeMarkdown } from './markdown.util';

describe('renderSafeMarkdown', () => {
  // 通常の Markdown は HTML 化される
  it('Markdown を HTML へ変換する', () => {
    const html = renderSafeMarkdown('**bold**');
    expect(html).toContain('<strong>bold</strong>');
  });

  // <script> は除去される
  it('script タグを除去する', () => {
    const html = renderSafeMarkdown('hello <script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert(1)');
  });

  // img の onerror など危険なイベントハンドラは除去される
  it('onerror イベントハンドラを除去する', () => {
    const html = renderSafeMarkdown('<img src=x onerror="alert(1)">');
    expect(html).not.toContain('onerror');
  });

  // javascript: スキームのリンクは無害化される
  it('javascript: スキームを除去する', () => {
    const html = renderSafeMarkdown('[x](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
  });
});
