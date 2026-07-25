import {
  buildCefrLevels,
  buildDensityChart,
  buildScoreLevels,
  buildSeries,
  buildXAxisLabels,
  CHART,
  computeScoreDomain,
  JITTER_PX,
  xFor,
  yForCefr,
  yForScore,
} from './mistakes-chart.util';

describe('xFor', () => {
  it('1点だけなら左端に置く（0除算を避ける）', () => {
    expect(xFor(0, 1)).toBe(CHART.padL);
  });

  it('先頭は左端、末尾は右端に置く', () => {
    expect(xFor(0, 5)).toBe(CHART.padL);
    expect(xFor(4, 5)).toBe(CHART.w - CHART.padR);
  });

  it('等間隔に配置する', () => {
    const gaps = [1, 2, 3].map((i) => xFor(i, 5) - xFor(i - 1, 5));
    expect(gaps[0]).toBeCloseTo(gaps[1]);
    expect(gaps[1]).toBeCloseTo(gaps[2]);
  });
});

describe('yForScore', () => {
  const domain = { min: 4, max: 8 };

  it('domain の上端が上、下端が下になる（SVG は y が下向き）', () => {
    expect(yForScore(8, domain)).toBe(CHART.padT);
    expect(yForScore(4, domain)).toBe(CHART.h - CHART.padB);
  });

  it('domain 外の値は上下端にクランプする', () => {
    expect(yForScore(99, domain)).toBe(yForScore(8, domain));
    expect(yForScore(-99, domain)).toBe(yForScore(4, domain));
  });
});

describe('yForCefr', () => {
  it('C2(6) が上端、A1(1) が下端', () => {
    expect(yForCefr(6)).toBe(CHART.padT);
    expect(yForCefr(1)).toBe(CHART.h - CHART.padB);
  });

  it('1〜6 の範囲外はクランプする', () => {
    expect(yForCefr(0)).toBe(yForCefr(1));
    expect(yForCefr(9)).toBe(yForCefr(6));
  });
});

describe('computeScoreDomain', () => {
  it('データが無ければ 0〜10 の既定レンジを返す', () => {
    expect(computeScoreDomain([])).toEqual({ min: 0, max: 10 });
  });

  it('実データ範囲に0.5のパディングを足して0.5刻みで丸める', () => {
    expect(computeScoreDomain([5, 7])).toEqual({ min: 4.5, max: 7.5 });
  });

  it('全点同値でも最低1点分の幅を確保する', () => {
    const domain = computeScoreDomain([6, 6]);
    expect(domain.max - domain.min).toBeGreaterThanOrEqual(1);
  });

  it('0〜10 の範囲を超えない', () => {
    const domain = computeScoreDomain([0, 10]);
    expect(domain.min).toBe(0);
    expect(domain.max).toBe(10);
  });
});

describe('buildScoreLevels / buildCefrLevels', () => {
  it('スコアのグリッドは上端から下端まで5本', () => {
    const levels = buildScoreLevels({ min: 4, max: 8 });
    expect(levels).toHaveLength(5);
    expect(levels[0].label).toBe('8');
    expect(levels[4].label).toBe('4');
    expect(levels[0].y).toBeLessThan(levels[4].y);
  });

  it('CEFRのグリッドは C2〜A1 の6段階', () => {
    expect(buildCefrLevels().map((l) => l.label)).toEqual(['C2', 'C1', 'B2', 'B1', 'A2', 'A1']);
  });
});

describe('buildSeries', () => {
  const history = [{ v: 1 }, { v: 2 }, { v: 3 }];
  const specs = [
    { name: 'a', color: '#000', pick: (h: { v: number }) => h.v },
    { name: 'b', color: '#fff', pick: (h: { v: number }) => h.v },
  ];
  const identity = (v: number) => v;

  it('2点未満は描画しない', () => {
    expect(buildSeries([{ v: 1 }], specs, identity)).toEqual([]);
    expect(buildSeries([], specs, identity)).toEqual([]);
  });

  it('polyline 文字列と dots が対応する', () => {
    const [series] = buildSeries(history, specs, identity);
    expect(series.dots).toHaveLength(3);
    expect(series.line).toBe(series.dots.map((d) => `${d.x},${d.y}`).join(' '));
  });

  it('同値の系列でも JITTER で縦にずれる（重なりを見分けるため）', () => {
    const [first, second] = buildSeries(history, specs, identity);
    expect(second.dots[0].y - first.dots[0].y).toBeCloseTo(JITTER_PX);
  });

  it('JITTER は系列群の中心を基準に対称にかかる', () => {
    const [first, second] = buildSeries(history, specs, identity);
    expect(first.dots[0].y + second.dots[0].y).toBeCloseTo(history[0].v * 2);
  });
});

describe('buildDensityChart', () => {
  it('2点未満は null を返す', () => {
    expect(buildDensityChart([1])).toBeNull();
  });

  it('値が大きいほど上（yが小さい）に来る', () => {
    const chart = buildDensityChart([1, 5]);
    expect(chart!.dots[1].y).toBeLessThan(chart!.dots[0].y);
  });

  it('全点同値でも水平線として描ける（0除算しない）', () => {
    const chart = buildDensityChart([3, 3, 3]);
    expect(chart!.dots.every((d) => Number.isFinite(d.y))).toBe(true);
    expect(chart!.dots[0].y).toBe(chart!.dots[2].y);
  });
});

describe('buildXAxisLabels', () => {
  const iso = (day: number) => `2026-01-${String(day).padStart(2, '0')}T00:00:00.000Z`;
  const label = (s: string) => s.slice(8, 10);

  it('2点未満は空配列', () => {
    expect(buildXAxisLabels([iso(1)], label)).toEqual([]);
  });

  it('5点以下なら全点にラベルを付ける', () => {
    const labels = buildXAxisLabels([1, 2, 3].map(iso), label);
    expect(labels.map((l) => l.label)).toEqual(['01', '02', '03']);
  });

  it('5点を超えたら先頭・末尾を含む5点に間引く', () => {
    const labels = buildXAxisLabels(
      Array.from({ length: 20 }, (_, i) => iso(i + 1)),
      label,
    );
    expect(labels).toHaveLength(5);
    expect(labels[0].label).toBe('01');
    expect(labels[4].label).toBe('20');
  });

  it('両端のラベルは内側に寄せ、中間は中央揃えにする', () => {
    const labels = buildXAxisLabels([1, 2, 3].map(iso), label);
    expect(labels.map((l) => l.anchor)).toEqual(['start', 'middle', 'end']);
  });
});
