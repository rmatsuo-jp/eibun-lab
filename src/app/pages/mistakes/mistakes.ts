/**
 * @file ミス傾向分析ページ。
 * StorageService の sessions signal から computed() でリアクティブに学習統計・ミス統計・評価推移を集計し、
 * 統計ダッシュボード（streak等）・スコア推移グラフ・CEFR推移グラフ・頻度バー・頻出ミスリストを表示する。
 * 推移グラフの横軸は添削日付（M/D形式、両グラフ共通の xAxisLabels で描画。点数が多い場合は間引く）。
 * 推移グラフの各系列は同値で重なった際も見分けられるよう縦方向に微小オフセット(JITTER_PX)を付与し、
 * 凡例クリックで highlightedSeries を切り替えて対象系列を強調表示できる。
 */
import { Component, computed, inject, signal } from '@angular/core';
import { StorageService, cefrToNumber } from '../../services/storage/storage.service';
import { Mistake, WritingEvaluation } from '../../models/session.model';

// 推移グラフの寸法（SVG viewBox）。スコア・CEFR 両グラフで共用する。
const CHART = { w: 300, h: 150, padL: 22, padR: 8, padT: 12, padB: 26 };
// 系列が同値で重なる際に縦方向へずらす量（px）。系列間の見分けやすさのための微小オフセット。
const JITTER_PX = 1.6;

interface ChartSeries {
  name: string;
  color: string;
  line: string;                                // polyline points 属性用
  dots: { x: number; y: number }[];
}

@Component({
  selector: 'app-mistakes',
  templateUrl: './mistakes.html',
  styleUrl: './mistakes.scss',
})
export class Mistakes {
  private storage = inject(StorageService);

  // ── 派生状態（computed） ──────────────────────────────────────────
  studyStats = computed(() => this.storage.getStudyStats());
  stats = computed(() => this.storage.getMistakeStats());
  maxCount = computed(() => this.stats()[0]?.count ?? 1);
  frequent = computed(() => this.storage.getFrequentMistakes() as (Mistake & { count: number })[]);
  evalHistory = computed(() => this.storage.getEvaluationHistory());

  readonly chartBox = CHART;

  // 凡例クリックで強調表示する系列名（null なら全系列を通常表示）
  highlightedSeries = signal<string | null>(null);

  toggleHighlight(name: string): void {
    this.highlightedSeries.update(current => (current === name ? null : name));
  }

  // y軸グリッド（スコア 0〜10）
  readonly scoreLevels = [
    { label: '10', y: this.yForScore(10) },
    { label: '5', y: this.yForScore(5) },
    { label: '0', y: this.yForScore(0) },
  ];
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
    const build = (name: string, color: string, seriesIndex: number, pick: (e: WritingEvaluation) => number): ChartSeries => {
      const offset = (seriesIndex - 1.5) * JITTER_PX;
      const dots = history.map((h, i) => ({ x: this.xFor(i, n), y: this.yForScore(pick(h.evaluation)) + offset }));
      return { name, color, line: dots.map(d => `${d.x},${d.y}`).join(' '), dots };
    };
    return [
      build('総合', '#60a5fa', 0, e => e.overallScore),
      build('文法', '#a78bfa', 1, e => e.grammarScore),
      build('語彙', '#34d399', 2, e => e.vocabularyScore),
      build('内容', '#f59e0b', 3, e => e.contentScore),
    ];
  });

  // ── CEFR 推移グラフ用の4系列（総合・文法・語彙・内容。暫定CEFRを数値化、2点以上のときのみ描画） ──
  cefrChart = computed<ChartSeries[]>(() => {
    const history = this.evalHistory();
    if (history.length < 2) return [];
    const n = history.length;
    const build = (name: string, color: string, seriesIndex: number, pick: (e: WritingEvaluation) => string): ChartSeries => {
      const offset = (seriesIndex - 1.5) * JITTER_PX;
      const dots = history.map((h, i) => ({ x: this.xFor(i, n), y: this.yForCefr(cefrToNumber(pick(h.evaluation))) + offset }));
      return { name, color, line: dots.map(d => `${d.x},${d.y}`).join(' '), dots };
    };
    return [
      build('総合', '#60a5fa', 0, e => e.overallCefr),
      build('文法', '#a78bfa', 1, e => e.grammarCefr),
      build('語彙', '#34d399', 2, e => e.vocabularyCefr),
      build('内容', '#f59e0b', 3, e => e.contentCefr),
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
    const indices = n <= MAX
      ? history.map((_, i) => i)
      : Array.from({ length: MAX }, (_, k) => Math.round((k / (MAX - 1)) * (n - 1)));
    return [...new Set(indices)].map(i => {
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

  // スコア値（0〜10）を SVG の y 座標に変換
  private yForScore(score: number): number {
    const innerH = CHART.h - CHART.padT - CHART.padB;
    const clamped = Math.max(0, Math.min(10, score));
    return CHART.padT + (1 - clamped / 10) * innerH;
  }

  // CEFR レベル値（1〜6）を SVG の y 座標に変換
  private yForCefr(level: number): number {
    const innerH = CHART.h - CHART.padT - CHART.padB;
    const clamped = Math.max(1, Math.min(6, level));
    return CHART.padT + (1 - (clamped - 1) / 5) * innerH;
  }
}
