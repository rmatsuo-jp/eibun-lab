/**
 * @file ミス傾向ページの推移グラフ（スコア・CEFR・ミス密度スパークライン）の
 * SVG 座標計算を担う純粋関数群。
 * signal も DI も持たず、履歴配列と系列定義だけを受け取って polyline/dots/軸ラベルを組み立てる。
 * MistakesState はここへ入力を渡す computed の薄い層に徹する（幾何計算をテスト可能にするための分離）。
 * スコアグラフのY軸は scoreDomain（実データの範囲±パディングを0.5刻みで丸めた範囲）で動的にズームし、
 * CEFRグラフは 1〜6 固定。系列が同値で重なっても見分けられるよう縦方向へ JITTER_PX の微小オフセットを付ける。
 */

// ── 寸法定数 ──────────────────────────────────────────────────────
/** 推移グラフの寸法（SVG viewBox）。スコア・CEFR 両グラフで共用する。 */
export const CHART = { w: 300, h: 150, padL: 22, padR: 8, padT: 12, padB: 26 };
/** 系列が同値で重なる際に縦方向へずらす量（px）。系列間の見分けやすさのための微小オフセット。 */
export const JITTER_PX = 1.6;
/** ミス密度スパークラインの寸法（推移グラフより低い帯）。x座標は xFor() を共用する。 */
export const DENSITY_CHART_H = 60;
const DENSITY_PAD_Y = 8;
/** 横軸に表示する日付ラベルの最大個数（超える分は等間隔に間引く）。 */
const MAX_X_LABELS = 5;

export interface ChartSeries {
  name: string;
  color: string;
  line: string; // polyline points 属性用
  dots: { x: number; y: number }[];
}

export interface ScoreDomain {
  min: number;
  max: number;
}

/** 1系列の定義（表示名・色・値の取り出し方）。系列の並び順が JITTER のオフセット順になる。 */
export interface SeriesSpec<T> {
  name: string;
  color: string;
  pick: (item: T) => number;
}

// ── 座標変換 ──────────────────────────────────────────────────────
/** x座標（履歴の i 番目 / 全 n 点）。3グラフすべてで共用する。 */
export function xFor(i: number, n: number): number {
  const innerW = CHART.w - CHART.padL - CHART.padR;
  return n === 1 ? CHART.padL : CHART.padL + (i / (n - 1)) * innerW;
}

/** スコア値を SVG の y 座標に変換。domain に対する相対位置でマッピングする。 */
export function yForScore(score: number, domain: ScoreDomain): number {
  const innerH = CHART.h - CHART.padT - CHART.padB;
  const clamped = Math.max(domain.min, Math.min(domain.max, score));
  const ratio = (clamped - domain.min) / (domain.max - domain.min);
  return CHART.padT + (1 - ratio) * innerH;
}

/** CEFR レベル値（1〜6）を SVG の y 座標に変換。 */
export function yForCefr(level: number): number {
  const innerH = CHART.h - CHART.padT - CHART.padB;
  const clamped = Math.max(1, Math.min(6, level));
  return CHART.padT + (1 - (clamped - 1) / 5) * innerH;
}

// ── Y軸レンジ・グリッド ─────────────────────────────────────────────
/**
 * スコアグラフのY軸表示範囲。データの実際のスコア帯（多くは4〜6点付近に集中）に合わせて
 * 動的にズームすることで、0〜10固定スケールでは潰れて見えていた起伏を視認しやすくする。
 */
export function computeScoreDomain(values: number[]): ScoreDomain {
  if (values.length === 0) return { min: 0, max: 10 };
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // 上下に0.5点のパディングを持たせてから、データが0.5刻みであることに合わせて0.5単位で丸める
  const min = Math.max(0, Math.floor((rawMin - 0.5) * 2) / 2);
  const max = Math.min(10, Math.ceil((rawMax + 0.5) * 2) / 2);
  // 全データが同値に近い場合でも最低1点分の幅を確保する
  if (max - min < 1) {
    return { min: Math.max(0, min - 0.5), max: Math.min(10, max + 0.5) };
  }
  return { min, max };
}

/** y軸グリッド（スコア）。domain の範囲を4段階に等分して表示する。 */
export function buildScoreLevels(domain: ScoreDomain): { label: string; y: number }[] {
  const steps = 4;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const value = domain.max - ((domain.max - domain.min) * i) / steps;
    const rounded = Math.round(value * 10) / 10;
    return { label: `${rounded}`, y: yForScore(rounded, domain) };
  });
}

/** y軸グリッド（CEFRレベル 1=A1 〜 6=C2。6段階すべてを表示し位置を明確にする）。 */
export function buildCefrLevels(): { label: string; y: number }[] {
  return [
    { label: 'C2', y: yForCefr(6) },
    { label: 'C1', y: yForCefr(5) },
    { label: 'B2', y: yForCefr(4) },
    { label: 'B1', y: yForCefr(3) },
    { label: 'A2', y: yForCefr(2) },
    { label: 'A1', y: yForCefr(1) },
  ];
}

// ── 系列の組み立て ────────────────────────────────────────────────
/**
 * 履歴と系列定義から polyline 用の系列配列を組み立てる（2点未満は描画せず空配列）。
 * toY は系列ごとに取り出した値を y 座標へ変換する関数（スコアは domain 依存、CEFR は固定スケール）。
 */
export function buildSeries<T>(
  history: T[],
  specs: SeriesSpec<T>[],
  toY: (value: number) => number,
): ChartSeries[] {
  if (history.length < 2) return [];
  const n = history.length;
  // 系列数の中央を基準に ±JITTER_PX ずつずらし、同値で重なった系列を見分けられるようにする。
  const center = (specs.length - 1) / 2;
  return specs.map((spec, seriesIndex) => {
    const offset = (seriesIndex - center) * JITTER_PX;
    const dots = history.map((item, i) => ({
      x: xFor(i, n),
      y: toY(spec.pick(item)) + offset,
    }));
    return {
      name: spec.name,
      color: spec.color,
      line: dots.map((d) => `${d.x},${d.y}`).join(' '),
      dots,
    };
  });
}

/** ミス密度スパークライン。全点が同値でも中央に水平線として描けるようにする（2点未満は null）。 */
export function buildDensityChart(
  values: number[],
): { line: string; dots: { x: number; y: number }[] } | null {
  if (values.length < 2) return null;
  const n = values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerH = DENSITY_CHART_H - DENSITY_PAD_Y * 2;
  const dots = values.map((value, i) => ({
    x: xFor(i, n),
    y: DENSITY_PAD_Y + (1 - (value - min) / span) * innerH,
  }));
  return { line: dots.map((d) => `${d.x},${d.y}`).join(' '), dots };
}

/**
 * 横軸の日付ラベル（両グラフ共通。2点未満は空配列）。
 * n が MAX_X_LABELS 以下なら全点、超える場合は先頭・末尾を含む等間隔の5点に間引く。
 */
export function buildXAxisLabels(
  dates: string[],
  formatLabel: (iso: string) => string,
): { x: number; label: string; anchor: string }[] {
  if (dates.length < 2) return [];
  const n = dates.length;
  const indices =
    n <= MAX_X_LABELS
      ? dates.map((_, i) => i)
      : Array.from({ length: MAX_X_LABELS }, (_, k) =>
          Math.round((k / (MAX_X_LABELS - 1)) * (n - 1)),
        );
  return [...new Set(indices)].map((i) => ({
    x: xFor(i, n),
    label: formatLabel(dates[i]),
    anchor: i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle',
  }));
}
