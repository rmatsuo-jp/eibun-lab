/**
 * @file ユニットテスト実行前に読み込まれるグローバルセットアップ。
 * jsdomにはwindow.matchMediaが実装されていないため、app.ts等のデスクトップ判定コードが
 * 動くようにダミー実装を補う。
 */
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
