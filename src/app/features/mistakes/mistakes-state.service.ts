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
 * さらに「上達しているか／次に何をすべきか」に答えるためのデータを組み立てる:
 * unmastered（ドリル習熟度と突合した未克服ミス、goToDrill でドリルへ遷移）・recurring（全期間の再発ミス）・
 * aiInsights（保存済みだが未表示だった grammarTendency / studyPlan / cefrRationale を直近数件分集約）・
 * categoryTrends（カテゴリ別のミス密度の期間比較）＋ densityChart（errorDensity 推移のスパークライン）。
 * 学習統計ダッシュボード以外の8セクション（MISTAKE_SECTIONS）は <app-collapsible> で格納/展開でき、
 * その開閉状態は openSections（既定は DEFAULT_OPEN、localStorage に永続化）で一元管理する。
 */
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SessionRepositoryService } from '@core/sessions/session-repository.service';
import { DRILL_MASTERY_STREAK } from '@core/drill/drill-progress.service';
import { DrillProgressSyncService } from '@core/drill/drill-progress-sync.service';
import { BadgeVariant } from '@shared/ui/badge/badge';
import {
  CategoryTrend,
  MasteryState,
  cefrToNumber,
  getCategoryTrends,
  getErrorDensityHistory,
  getEvaluationHistory,
  getFrequentMistakes,
  getMistakeStats,
  getRecurringMistakes,
  getStudyStats,
  getUnmasteredMistakes,
} from '@core/stats/session-stats.util';
import { Mistake, WritingEvaluation } from '@core/models/session.model';
import { I18nService } from '@core/i18n/i18n.service';
import {
  localizedCategory,
  localizedExplanation,
  localizedField,
  localizedNormalizedCategory,
} from '@core/i18n/localized-session.util';
import { readJson, writeJson } from '@shared/utils/local-storage.util';

// 推移グラフの寸法（SVG viewBox）。スコア・CEFR 両グラフで共用する。
const CHART = { w: 300, h: 150, padL: 22, padR: 8, padT: 12, padB: 26 };
// 系列が同値で重なる際に縦方向へずらす量（px）。系列間の見分けやすさのための微小オフセット。
const JITTER_PX = 1.6;

// ミス密度スパークラインの寸法（推移グラフより低い帯）。x座標は xFor() を共用する。
const DENSITY_CHART_H = 60;
const DENSITY_PAD_Y = 8;
// AI診断（文法の癖・学習プラン・CEFR根拠）をまとめて表示する直近セッション件数。
const AI_INSIGHT_LIMIT = 3;

// ── 折りたたみセクション（学習統計ダッシュボード以外の8つ。定義順＝表示順） ──
export const MISTAKE_SECTIONS = [
  'unmastered',
  'recurring',
  'ai',
  'trend',
  'score',
  'cefr',
  'frequent',
  'category',
] as const;
export type MistakeSectionId = (typeof MISTAKE_SECTIONS)[number];

const SECTION_STATE_KEY = 'eibun-lab-mistakes-sections';
// 既定の開閉状態。行動優先の並び順で上位2つ（未克服ミス・再発ミス）だけ展開し、
// 上から順に読めば「今日やるべきこと」がすぐ目に入るようにする。
const DEFAULT_OPEN: Record<MistakeSectionId, boolean> = {
  unmastered: true,
  recurring: true,
  ai: false,
  trend: false,
  score: false,
  cefr: false,
  frequent: false,
  category: false,
};

// 保存値を既定値にマージして読み込む。未知のキー・欠落キー・boolean 以外の値が
// 混ざっていても（旧バージョンの保存値・手動編集）既定値へフォールバックする。
function loadOpenSections(): Record<MistakeSectionId, boolean> {
  const saved = readJson<Partial<Record<MistakeSectionId, unknown>>>(SECTION_STATE_KEY, {});
  const result = { ...DEFAULT_OPEN };
  for (const id of MISTAKE_SECTIONS) {
    if (typeof saved[id] === 'boolean') result[id] = saved[id];
  }
  return result;
}

interface ChartSeries {
  name: string;
  color: string;
  line: string; // polyline points 属性用
  dots: { x: number; y: number }[];
}

// AI が返した自然文フィールドを表示言語で解決した1セッション分の診断。
// 3項目すべてが欠落しているセッションは aiInsights から除外する。
export interface AiInsight {
  date: string;
  grammarTendency?: string;
  studyPlan?: string;
  cefrRationale?: string;
}

@Injectable({ providedIn: 'root' })
export class MistakesState {
  private repository = inject(SessionRepositoryService);
  private i18n = inject(I18nService);
  // ドリル進捗は DrillProgressService を直接ではなく同期サービス経由で読む（唯一の窓口に統一）。
  private drillProgress = inject(DrillProgressSyncService);
  private router = inject(Router);

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

  // ── 折りたたみセクションの開閉状態（学習統計ダッシュボード以外の8セクション） ──
  // 開閉のたびに localStorage へ保存し、次回訪問時も同じ状態で開くようにする。
  private openSections = signal<Record<MistakeSectionId, boolean>>(loadOpenSections());

  isOpen(id: MistakeSectionId): boolean {
    return this.openSections()[id];
  }

  toggleSection(id: MistakeSectionId): void {
    this.openSections.update((current) => {
      const updated = { ...current, [id]: !current[id] };
      writeJson(SECTION_STATE_KEY, updated);
      return updated;
    });
  }

  // ── 1. カテゴリ別 改善/悪化トレンド（比較対象が無ければ空配列＝セクションごと非表示） ──
  categoryTrends = computed(() => getCategoryTrends(this.repository.sessions()));

  // トレンドの方向を示す記号。色分けは mistakes.scss 側で direction をクラス名にして行う。
  trendArrow(direction: 'improved' | 'worsened' | 'flat'): string {
    return direction === 'improved' ? '↓' : direction === 'worsened' ? '↑' : '→';
  }

  trendLabel(direction: CategoryTrend['direction']): string {
    const keys = {
      improved: 'mistakes.improved',
      worsened: 'mistakes.worsened',
      flat: 'mistakes.flat',
    } as const;
    return this.i18n.t(keys[direction]);
  }

  // 密度は小数1桁で十分（100語あたりのミス数）
  formatDensity(value: number): string {
    return value.toFixed(1);
  }

  // ── ミス密度（errorDensity）推移スパークライン。2点以上のときのみ描画 ──
  readonly densityChartH = DENSITY_CHART_H;
  densityHistory = computed(() => getErrorDensityHistory(this.repository.sessions()));

  densityChart = computed<{ line: string; dots: { x: number; y: number }[] } | null>(() => {
    const history = this.densityHistory();
    if (history.length < 2) return null;
    const n = history.length;
    const values = history.map((h) => h.density);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1; // 全点同値でも中央に水平線として描けるようにする
    const innerH = DENSITY_CHART_H - DENSITY_PAD_Y * 2;
    const dots = history.map((h, i) => ({
      x: this.xFor(i, n),
      y: DENSITY_PAD_Y + (1 - (h.density - min) / span) * innerH,
    }));
    return { line: dots.map((d) => `${d.x},${d.y}`).join(' '), dots };
  });

  // ── 2. 未克服ミス（ドリル習熟度と突合。習熟済みは除外） ──
  unmastered = computed(() =>
    getUnmasteredMistakes(
      this.repository.sessions(),
      (key) => this.drillProgress.getDrillProgress(key),
      DRILL_MASTERY_STREAK,
    ),
  );

  // 習熟状態のラベルとバッジ色。未克服（挑戦したが正解できていない）だけ error 色で目立たせる。
  masteryLabel(state: MasteryState): string {
    const keys = {
      unmastered: 'mistakes.stateUnmastered',
      untouched: 'mistakes.stateUntouched',
      learning: 'mistakes.stateLearning',
    } as const;
    return this.i18n.t(keys[state]);
  }

  masteryVariant(state: MasteryState): BadgeVariant {
    return state === 'unmastered' ? 'error' : 'warning';
  }

  goToDrill(): void {
    void this.router.navigate(['/drill']);
  }

  // ── 3. 再発ミス（全期間で2日以上に登場したミス） ──
  recurring = computed(() => getRecurringMistakes(this.repository.sessions()));

  // 表示用の M/D 形式（推移グラフの xAxisLabels と同じ書式）
  shortDate(iso: string): string {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  // ── 4. AI診断の集約（保存済みだが従来このタブでは未表示だった自然文フィールド） ──
  aiInsights = computed<AiInsight[]>(() => {
    const lang = this.i18n.lang();
    return this.repository
      .sessions()
      .slice(0, AI_INSIGHT_LIMIT)
      .map((s) => ({
        date: s.date,
        grammarTendency: localizedField(s.grammarTendency, s.grammarTendencyEn, lang),
        studyPlan: localizedField(s.studyPlan, s.studyPlanEn, lang),
        cefrRationale: localizedField(s.cefrRationale, s.cefrRationaleEn, lang),
      }))
      .filter((i) => i.grammarTendency || i.studyPlan || i.cefrRationale);
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
