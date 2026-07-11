/**
 * @file ミス傾向分析ページの状態・集計ロジックを保持するシングルトンサービス。
 * SessionRepositoryService の sessions signal から computed() + session-stats.util（純粋関数）で
 * リアクティブに学習統計・ミス統計・評価推移を集計し、
 * 統計ダッシュボード（streak等）・スコア推移グラフ・CEFR推移グラフ・頻度バー・頻出ミスリストの
 * 表示データを組み立てる（DOM操作を伴わないため mistakes.ts から分離、practice-state.service.ts と同じ設計）。
 * スコア推移グラフのY軸は scoreDomain（実データの範囲±パディングを0.5刻みで丸めた範囲）に応じて動的にズームし、
 * 4〜6点付近にスコアが集中していても起伏が見やすくなるようにしている（CEFR推移グラフは1〜6固定のまま）。
 * 推移グラフの横軸は添削日付（M/D形式、両グラフ共通の xAxisLabels で描画。点数が多い場合は間引く）。
 * 推移グラフの各系列は同値で重なった際も見分けられるよう縦方向に微小オフセット(JITTER_PX)を付与し、
 * 凡例クリックで highlightedSeries を切り替えて対象系列を強調表示できる。
 * グラフ系列名・カテゴリ表示・ミス説明は i18n.lang() に追随する（core/i18n の翻訳・localized-session.util 参照）。
 * カテゴリ別集計（stats）は session-stats.util 側で正規化済みの日本語カテゴリ文字列のまま集計し、
 * 表示直前にだけ localizedNormalizedCategory() で翻訳する（集計キーを表示文字列にすると言語切替でグラフが割れるため）。
 */
import { Injectable, computed, inject, signal } from '@angular/core';
import { SessionRepositoryService } from '@core/sessions/session-repository.service';
import {
  cefrToNumber,
  getEvaluationHistory,
  getFrequentMistakes,
  getMistakeStats,
  getStudyStats,
} from '@core/stats/session-stats.util';
import { Mistake, WritingEvaluation } from '@core/models/session.model';
import { I18nService } from '@core/i18n/i18n.service';
import {
  localizedCategory,
  localizedExplanation,
  localizedNormalizedCategory,
} from '@core/i18n/localized-session.util';

// 推移グラフの寸法（SVG viewBox）。スコア・CEFR 両グラフで共用する。
const CHART = { w: 300, h: 150, padL: 22, padR: 8, padT: 12, padB: 26 };
// 系列が同値で重なる際に縦方向へずらす量（px）。系列間の見分けやすさのための微小オフセット。
const JITTER_PX = 1.6;

interface ChartSeries {
  name: string;
  color: string;
  line: string; // polyline points 属性用
  dots: { x: number; y: number }[];
}

@Injectable({ providedIn: 'root' })
export class MistakesState {
  private repository = inject(SessionRepositoryService);
  private i18n = inject(I18nService);

  categoryLabel(categoryJa: string): string {
    return localizedNormalizedCategory(categoryJa, this.i18n);
  }

  mistakeCategoryLabel(m: Mistake): string {
    return localizedCategory(m, this.i18n);
  }

  mistakeExplanation(m: Mistake): string {
    return localizedExplanation(m, this.i18n.lang());
  }

  // ── 派生状態（computed）: sessions signal を純粋関数に渡して集計する ──
  studyStats = computed(() => getStudyStats(this.repository.sessions()));
  stats = computed(() => getMistakeStats(this.repository.sessions()));
  maxCount = computed(() => this.stats()[0]?.count ?? 1);
  frequent = computed(
    () => getFrequentMistakes(this.repository.sessions()) as (Mistake & { count: number })[],
  );
  evalHistory = computed(() => getEvaluationHistory(this.repository.sessions()));

  readonly chartBox = CHART;

  // 凡例クリックで強調表示する系列名（null なら全系列を通常表示）
  highlightedSeries = signal<string | null>(null);

  toggleHighlight(name: string): void {
    this.highlightedSeries.update((current) => (current === name ? null : name));
  }

  // スコアグラフのY軸表示範囲。データの実際のスコア帯（多くは4〜6点付近に集中）に合わせて
  // 動的にズームすることで、0〜10固定スケールでは潰れて見えていた起伏を視認しやすくする。
  scoreDomain = computed<{ min: number; max: number }>(() => {
    const history = this.evalHistory();
    const values = history.flatMap((h) => [
      h.evaluation.overallScore,
      h.evaluation.grammarScore,
      h.evaluation.vocabularyScore,
      h.evaluation.contentScore,
    ]);
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
  });

  // y軸グリッド（スコア）。scoreDomain の範囲を4段階に等分して表示する。
  scoreLevels = computed<{ label: string; y: number }[]>(() => {
    const domain = this.scoreDomain();
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const value = domain.max - ((domain.max - domain.min) * i) / steps;
      const rounded = Math.round(value * 10) / 10;
      return { label: `${rounded}`, y: this.yForScore(rounded, domain) };
    });
  });
  // y軸グリッド（CEFRレベル 1=A1 〜 6=C2。6段階すべてを表示し位置を明確にする）
  readonly cefrLevels = [
    { label: 'C2', y: this.yForCefr(6) },
    { label: 'C1', y: this.yForCefr(5) },
    { label: 'B2', y: this.yForCefr(4) },
    { label: 'B1', y: this.yForCefr(3) },
    { label: 'A2', y: this.yForCefr(2) },
    { label: 'A1', y: this.yForCefr(1) },
  ];

  // x座標（履歴の i 番目）。系列構築で共用。
  private xFor(i: number, n: number): number {
    const innerW = CHART.w - CHART.padL - CHART.padR;
    return n === 1 ? CHART.padL : CHART.padL + (i / (n - 1)) * innerW;
  }

  // ── スコア推移グラフ用の4系列（2点以上のときのみ描画） ───────────────
  scoreChart = computed<ChartSeries[]>(() => {
    const history = this.evalHistory();
    if (history.length < 2) return [];
    const n = history.length;
    const domain = this.scoreDomain();
    const build = (
      name: string,
      color: string,
      seriesIndex: number,
      pick: (e: WritingEvaluation) => number,
    ): ChartSeries => {
      const offset = (seriesIndex - 1.5) * JITTER_PX;
      const dots = history.map((h, i) => ({
        x: this.xFor(i, n),
        y: this.yForScore(pick(h.evaluation), domain) + offset,
      }));
      return { name, color, line: dots.map((d) => `${d.x},${d.y}`).join(' '), dots };
    };
    return [
      build(this.i18n.t('practice.evalOverall'), '#60a5fa', 0, (e) => e.overallScore),
      build(this.i18n.t('practice.evalGrammar'), '#a78bfa', 1, (e) => e.grammarScore),
      build(this.i18n.t('practice.evalVocabulary'), '#34d399', 2, (e) => e.vocabularyScore),
      build(this.i18n.t('practice.evalContent'), '#f59e0b', 3, (e) => e.contentScore),
    ];
  });

  // ── CEFR 推移グラフ用の4系列（総合・文法・語彙・内容。暫定CEFRを数値化、2点以上のときのみ描画） ──
  cefrChart = computed<ChartSeries[]>(() => {
    const history = this.evalHistory();
    if (history.length < 2) return [];
    const n = history.length;
    const build = (
      name: string,
      color: string,
      seriesIndex: number,
      pick: (e: WritingEvaluation) => string,
    ): ChartSeries => {
      const offset = (seriesIndex - 1.5) * JITTER_PX;
      const dots = history.map((h, i) => ({
        x: this.xFor(i, n),
        y: this.yForCefr(cefrToNumber(pick(h.evaluation))) + offset,
      }));
      return { name, color, line: dots.map((d) => `${d.x},${d.y}`).join(' '), dots };
    };
    return [
      build(this.i18n.t('practice.evalOverall'), '#60a5fa', 0, (e) => e.overallCefr),
      build(this.i18n.t('practice.evalGrammar'), '#a78bfa', 1, (e) => e.grammarCefr),
      build(this.i18n.t('practice.evalVocabulary'), '#34d399', 2, (e) => e.vocabularyCefr),
      build(this.i18n.t('practice.evalContent'), '#f59e0b', 3, (e) => e.contentCefr),
    ];
  });

  // ── 横軸の日付ラベル（両グラフ共通。2点以上のときのみ。最大5個に間引く） ──
  readonly xAxisLabelY = CHART.h - 6;
  xAxisLabels = computed<{ x: number; label: string; anchor: string }[]>(() => {
    const history = this.evalHistory();
    if (history.length < 2) return [];
    const n = history.length;
    // 表示するインデックスを選定（n<=5なら全点、それ超は先頭・末尾＋等間隔で計5点）
    const MAX = 5;
    const indices =
      n <= MAX
        ? history.map((_, i) => i)
        : Array.from({ length: MAX }, (_, k) => Math.round((k / (MAX - 1)) * (n - 1)));
    return [...new Set(indices)].map((i) => {
      const d = new Date(history[i].date);
      return {
        x: this.xFor(i, n),
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        anchor: i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle',
      };
    });
  });

  barWidth(count: number): string {
    return `${Math.round((count / this.maxCount()) * 100)}%`;
  }

  // スコア値を SVG の y 座標に変換。domain（scoreDomain の範囲）に対する相対位置でマッピングする
  private yForScore(score: number, domain: { min: number; max: number }): number {
    const innerH = CHART.h - CHART.padT - CHART.padB;
    const clamped = Math.max(domain.min, Math.min(domain.max, score));
    const ratio = (clamped - domain.min) / (domain.max - domain.min);
    return CHART.padT + (1 - ratio) * innerH;
  }

  // CEFR レベル値（1〜6）を SVG の y 座標に変換
  private yForCefr(level: number): number {
    const innerH = CHART.h - CHART.padT - CHART.padB;
    const clamped = Math.max(1, Math.min(6, level));
    return CHART.padT + (1 - (clamped - 1) / 5) * innerH;
  }
}
