/**
 * @file ミス傾向分析ページの状態・集計ロジックを保持するシングルトンサービス。
 * SessionRepositoryService の sessions signal から computed() + session-stats.util（純粋関数）で
 * リアクティブに学習統計・ミス統計・評価推移を集計し、
 * 統計ダッシュボード（streak等）・スコア推移グラフ・CEFR推移グラフ・頻度バー・頻出ミスリストの
 * 表示データを組み立てる（DOM操作を伴わないため mistakes.ts から分離、practice-state.service.ts と同じ設計）。
 * 3つのグラフ（スコア推移・CEFR推移・ミス密度スパークライン）のSVG座標計算そのものは
 * mistakes-chart.util.ts（純粋関数）が持ち、ここは signal から入力を組み立てて渡す computed に徹する。
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
import { formatShortDate } from '@shared/utils/date.util';
import {
  buildCefrLevels,
  buildDensityChart,
  buildScoreLevels,
  buildSeries,
  buildXAxisLabels,
  CHART,
  ChartSeries,
  computeScoreDomain,
  DENSITY_CHART_H,
  ScoreDomain,
  SeriesSpec,
  yForCefr,
  yForScore,
} from './mistakes-chart.util';

// AI診断（文法の癖・学習プラン・CEFR根拠）をまとめて表示する直近セッション件数。
const AI_INSIGHT_LIMIT = 3;

// 推移グラフ4系列の表示色（総合・文法・語彙・内容の順。スコア／CEFR 両グラフで共用）。
const SERIES_COLORS = ['#60a5fa', '#a78bfa', '#34d399', '#f59e0b'];

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

  // スコアグラフのY軸表示範囲（算出は mistakes-chart.util の computeScoreDomain）。
  scoreDomain = computed<ScoreDomain>(() =>
    computeScoreDomain(
      this.evalHistory().flatMap((h) => [
        h.evaluation.overallScore,
        h.evaluation.grammarScore,
        h.evaluation.vocabularyScore,
        h.evaluation.contentScore,
      ]),
    ),
  );

  // y軸グリッド（スコアは scoreDomain 依存で動的、CEFR は 1〜6 固定）
  scoreLevels = computed(() => buildScoreLevels(this.scoreDomain()));
  readonly cefrLevels = buildCefrLevels();

  // 4系列（総合・文法・語彙・内容）の表示名は i18n.lang() に追随する。
  // 値の取り出し方だけをスコア／CEFR で差し替え、座標計算は buildSeries に任せる。
  private seriesSpecs(
    picks: ((e: WritingEvaluation) => number)[],
  ): SeriesSpec<{ evaluation: WritingEvaluation }>[] {
    const names = [
      this.i18n.t('practice.evalOverall'),
      this.i18n.t('practice.evalGrammar'),
      this.i18n.t('practice.evalVocabulary'),
      this.i18n.t('practice.evalContent'),
    ];
    return picks.map((pick, i) => ({
      name: names[i],
      color: SERIES_COLORS[i],
      pick: (item) => pick(item.evaluation),
    }));
  }

  // ── スコア推移グラフ用の4系列（2点以上のときのみ描画） ───────────────
  scoreChart = computed<ChartSeries[]>(() => {
    const domain = this.scoreDomain();
    return buildSeries(
      this.evalHistory(),
      this.seriesSpecs([
        (e) => e.overallScore,
        (e) => e.grammarScore,
        (e) => e.vocabularyScore,
        (e) => e.contentScore,
      ]),
      (value) => yForScore(value, domain),
    );
  });

  // ── CEFR 推移グラフ用の4系列（総合・文法・語彙・内容。暫定CEFRを数値化、2点以上のときのみ描画） ──
  cefrChart = computed<ChartSeries[]>(() =>
    buildSeries(
      this.evalHistory(),
      this.seriesSpecs([
        (e) => cefrToNumber(e.overallCefr),
        (e) => cefrToNumber(e.grammarCefr),
        (e) => cefrToNumber(e.vocabularyCefr),
        (e) => cefrToNumber(e.contentCefr),
      ]),
      yForCefr,
    ),
  );

  // ── 横軸の日付ラベル（両グラフ共通。2点以上のときのみ。最大5個に間引く） ──
  readonly xAxisLabelY = CHART.h - 6;
  xAxisLabels = computed(() =>
    buildXAxisLabels(
      this.evalHistory().map((h) => h.date),
      formatShortDate,
    ),
  );

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

  densityChart = computed(() => buildDensityChart(this.densityHistory().map((h) => h.density)));

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

  // 表示用の M/D 形式（推移グラフの xAxisLabels と同じ書式を shared/utils から共用）
  shortDate(iso: string): string {
    return formatShortDate(iso);
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
}
