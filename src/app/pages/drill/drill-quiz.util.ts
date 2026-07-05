/**
 * @file Drill ページの出題ロジックのうち、コンポーネントの signal 状態に依存しない純粋関数を切り出したもの。
 * 重み付きシャッフル・回答文字列の正規化・マスク順生成・マスク対象インデックス計算を提供し、
 * drill.ts はこれらを呼び出すだけにすることでファイルサイズと責務を減らす。DIなしで単体テスト可能。
 */

// ── 重み付きシャッフル: weight * Math.random() の降順ソートで、頻出・未習熟の問題ほど手前に出やすくしつつ、
// 完全な固定順にはならないよう毎回ランダム性を持たせる（軽量な重み付きシャッフル）。
export function shuffleByWeight<T extends { weight: number }>(source: T[]): T[] {
  return source
    .map(q => ({ q, score: q.weight * Math.random() }))
    .sort((a, b) => b.score - a.score)
    .map(({ q }) => q);
}

// 回答文字列の正規化（大文字小文字・前後空白・末尾句読点・連続空白の差異を吸収して比較する）。
export function normalizeAnswer(s: string): string {
  return s.toLowerCase().trim().replace(/[.!?,;:'"]+$/g, '').replace(/\s+/g, ' ');
}

// ── マスクする単語の優先順を、文字列から決定的に生成する ─────────
// 同じ文なら常に同じ並びになるため、隠す順序自体は保存せずいつでも再現できる（保存するのは maskLevel のみ）。
// シンプルな文字列ハッシュを種にした mulberry32 で疑似乱数列を作り、Fisher–Yates でシャッフルする。
export function buildHideOrder(seedText: string, length: number): number[] {
  let h = 0;
  for (let i = 0; i < seedText.length; i++) {
    h = (Math.imul(31, h) + seedText.charCodeAt(i)) | 0;
  }
  let state = h >>> 0 || 1;
  const rand = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const order = Array.from({ length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// 現在の maskLevel で隠れている単語インデックスの集合を返す。
export function maskedIndices(hideOrder: number[], wordCount: number, maxLevel: number, level: number): Set<number> {
  const hiddenCount = Math.round((wordCount * level) / maxLevel);
  return new Set(hideOrder.slice(0, hiddenCount));
}
