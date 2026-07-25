/**
 * @file セッション配列からの統計・集計計算を担う純粋関数群。
 * すべて sessions（CorrectionSession[]）を引数に取るため
 * Angular DI なしに単体テストできる。カテゴリ正規化・CEFR数値化・学習統計・評価推移・頻出ミス・
 * 復習カード集計・レベルアップ対象セッション抽出を提供する。
 * さらにミス傾向タブ向けに、カテゴリ別の改善/悪化トレンド（ミス密度の期間比較）・再発ミス検出・
 * ミス密度推移・未克服ミス抽出（ドリル習熟度と突合）を提供する。
 */
import {
  CorrectionSession,
  DrillProgress,
  Mistake,
  ReviewItem,
  WritingEvaluation,
} from '@core/models/session.model';
import { toDayKey } from '@shared/utils/date.util';

// ドリルの出題元（頻出ミス・復習カード）に使う直近セッション件数。
// 古いセッションのミスは今のレベルではもう犯していないことが多いため、直近分に絞って「今の弱点」を優先出題する。
const RECENT_SESSION_LIMIT = 15;

// ── CEFR レベルの数値化（グラフ描画用）。未知の値は 0 として扱う ────
export const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export function cefrToNumber(level: string): number {
  const idx = CEFR_ORDER.indexOf(level.toUpperCase().trim() as (typeof CEFR_ORDER)[number]);
  return idx === -1 ? 0 : idx + 1;
}

// ミスカテゴリの表記ゆれ正規化（英語表記・過去データの細分化表記 → 日本語カテゴリへ寄せる）。
// プロンプト側で日本語固定リストを指示した後も、過去に保存済みの英語カテゴリのミスが残るため集計側でも正規化する。
const CATEGORY_ALIASES: Record<string, string> = {
  grammar: '文法',
  vocabulary: '語彙',
  'word choice': '語彙',
  'verb/word choice': '語彙',
  spelling: 'スペリング',
  collocation: 'コロケーション',
  'noun/number': '文法',
  'preposition/article': '文法',
  '語法/名詞句の構成': '語法',
  '語順/副詞の位置': '語順',
};
export function normalizeCategory(category: string): string {
  const trimmed = category.trim();
  return CATEGORY_ALIASES[trimmed.toLowerCase()] ?? CATEGORY_ALIASES[trimmed] ?? trimmed;
}

// ── ドリル進捗のキー生成 ─────────────────────────────────────────
// ミスは original を、復習カードは sentence+answer を正規化してキーにする（drill.ts と共有）。
export function normalizeDrillKey(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ── 学習統計型（ダッシュボード表示用） ──────────────────────────────
export interface StudyStats {
  totalSessions: number; // 総添削数
  totalMistakes: number; // 総ミス数
  avgMistakes: number; // 1回あたり平均ミス数（小数1桁）
  currentStreak: number; // 連続学習日数
  last7DaysCount: number; // 直近7日のセッション数
}

// ── ミス統計集計 ─────────────────────────────────────────────────
// カテゴリは normalizeCategory() で正規化してから集計し、英日表記の重複を防ぐ。
export function getMistakeStats(
  sessions: CorrectionSession[],
): { category: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const session of sessions) {
    for (const m of session.mistakes) {
      const category = normalizeCategory(m.category);
      counts[category] = (counts[category] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

// ── 学習統計（streak は日付単位で連続日数を算出） ───────────────────
export function getStudyStats(sessions: CorrectionSession[]): StudyStats {
  const totalSessions = sessions.length;
  const totalMistakes = sessions.reduce((sum, s) => sum + s.mistakes.length, 0);
  const avgMistakes =
    totalSessions === 0 ? 0 : Math.round((totalMistakes / totalSessions) * 10) / 10;

  // セッションが存在する日付（ローカル時刻 YYYY-MM-DD）の集合
  const dayKeys = new Set(sessions.map((s) => toDayKey(s.date)));

  // 連続学習日数: 今日 or 昨日を起点に、連続して遡れる日数を数える
  let currentStreak = 0;
  const cursor = new Date();
  if (!dayKeys.has(toDayKey(cursor.toISOString()))) {
    // 今日まだ未学習なら昨日を起点にする（昨日があれば streak 継続中とみなす）
    cursor.setDate(cursor.getDate() - 1);
  }
  while (dayKeys.has(toDayKey(cursor.toISOString()))) {
    currentStreak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // 直近7日のセッション数
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const last7DaysCount = sessions.filter(
    (s) => new Date(s.date).getTime() >= sevenDaysAgo.getTime(),
  ).length;

  return { totalSessions, totalMistakes, avgMistakes, currentStreak, last7DaysCount };
}

// ── 評価推移: evaluation を持つセッションを日付昇順で返す（同一日付は最新を採用） ─
// スコア推移グラフ・CEFR推移グラフの両方がこの履歴を参照する。
// CEFR は AI の実判定値をそのまま用いる（スコア由来で上書きすると過大評価に戻るため正規化しない）。
export function getEvaluationHistory(
  sessions: CorrectionSession[],
): { date: string; evaluation: WritingEvaluation }[] {
  const byDay = new Map<string, { date: string; evaluation: WritingEvaluation }>();
  for (const s of sessions) {
    if (!s.evaluation) continue;
    const key = toDayKey(s.date);
    const existing = byDay.get(key);
    // 同一日付は date（ISO）が新しい方を採用
    if (!existing || s.date > existing.date) {
      byDay.set(key, { date: s.date, evaluation: s.evaluation });
    }
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// 直近 RECENT_SESSION_LIMIT 件から集計する（今のレベルではもう犯していない古いミスを除外するため）。
export function getFrequentMistakes(
  sessions: CorrectionSession[],
): (Mistake & { count: number })[] {
  const all = sessions.slice(0, RECENT_SESSION_LIMIT).flatMap((s) => s.mistakes);
  const seen = new Map<string, Mistake & { count: number }>();
  for (const m of all) {
    const key = normalizeDrillKey(m.original);
    const existing = seen.get(key);
    if (existing) {
      existing.count++;
    } else {
      seen.set(key, { ...m, count: 1 });
    }
  }
  return [...seen.values()].sort((a, b) => b.count - a.count).slice(0, 20);
}

// ── 復習カード集計: 直近 RECENT_SESSION_LIMIT 件の reviewItems を平坦化して返す（Drill の穴埋めクイズで出題） ─
export function getReviewItems(sessions: CorrectionSession[]): ReviewItem[] {
  return sessions.slice(0, RECENT_SESSION_LIMIT).flatMap((s) => s.reviewItems ?? []);
}

// ── レベルアップ例文を持つセッション一覧: Drill の日付選択画面で使う ─
// 直近 RECENT_SESSION_LIMIT 件には絞らず、全期間の levelUpItems を持つセッションを対象にする
// （日付単位で1セッションを選んでその中の例文を順にたどる仕様のため、古い日付も選択肢に残す）。
// sessions は既に新しい順にソート済みである前提のため、追加のソートは行わない。
export function getSessionsWithLevelUp(sessions: CorrectionSession[]): CorrectionSession[] {
  return sessions.filter((s) => (s.levelUpItems?.length ?? 0) > 0);
}

// ── 復習カードを持つセッション一覧: Drill の穴埋めクイズ・日付選択画面で使う ─
// getSessionsWithLevelUp と同様に直近件数では絞らず、全期間の reviewItems を持つセッションを対象にする
// （日付単位で1セッションを選んでその中のカードを順にたどる仕様のため、古い日付も選択肢に残す）。
// sessions は既に新しい順にソート済みである前提のため、追加のソートは行わない。
export function getSessionsWithReviewItems(sessions: CorrectionSession[]): CorrectionSession[] {
  return sessions.filter((s) => (s.reviewItems?.length ?? 0) > 0);
}

// ── ミス密度（100語あたりのミス数）ユーティリティ ──────────────────
// 学習者が書いた英文は original。空白区切りの語数を書いた量の指標として使う。
function wordCount(session: CorrectionSession): number {
  return session.original.trim().split(/\s+/).filter(Boolean).length;
}

// カテゴリ別の「100語あたりミス数」。語数0（空入力のみ）の区間は密度0として扱う。
function densityByCategory(sessions: CorrectionSession[]): Record<string, number> {
  const totalWords = sessions.reduce((sum, s) => sum + wordCount(s), 0);
  const counts: Record<string, number> = {};
  for (const s of sessions) {
    for (const m of s.mistakes) {
      const category = normalizeCategory(m.category);
      counts[category] = (counts[category] ?? 0) + 1;
    }
  }
  const densities: Record<string, number> = {};
  for (const [category, count] of Object.entries(counts)) {
    densities[category] = totalWords === 0 ? 0 : (count / totalWords) * 100;
  }
  return densities;
}

// ── カテゴリ別 改善/悪化トレンド ────────────────────────────────
// 累計件数は「書いた量」に比例して増えるだけで上達が読み取れないため、100語あたりのミス密度に
// 正規化したうえで「直近 RECENT_SESSION_LIMIT 件」と「それ以前」を比較する。
// 比較対象（それ以前）が存在しない場合は判定不能なので空配列を返す（呼び出し側でセクションごと非表示）。
// delta が ±TREND_FLAT_THRESHOLD 未満の変化は誤差とみなし「横ばい」に寄せる。
export const TREND_FLAT_THRESHOLD = 0.2;

export interface CategoryTrend {
  category: string; // 正規化済み日本語カテゴリ（表示直前に localizedNormalizedCategory で翻訳する）
  recentDensity: number; // 直近区間の100語あたりミス数
  pastDensity: number; // それ以前の区間の100語あたりミス数
  delta: number; // recentDensity - pastDensity（負なら改善）
  direction: 'improved' | 'worsened' | 'flat';
}

export function getCategoryTrends(sessions: CorrectionSession[]): CategoryTrend[] {
  const recent = sessions.slice(0, RECENT_SESSION_LIMIT);
  const past = sessions.slice(RECENT_SESSION_LIMIT);
  if (past.length === 0) return [];

  const recentDensities = densityByCategory(recent);
  const pastDensities = densityByCategory(past);
  const categories = new Set([...Object.keys(recentDensities), ...Object.keys(pastDensities)]);

  return [...categories]
    .map((category) => {
      const recentDensity = recentDensities[category] ?? 0;
      const pastDensity = pastDensities[category] ?? 0;
      const delta = recentDensity - pastDensity;
      const direction: CategoryTrend['direction'] =
        Math.abs(delta) < TREND_FLAT_THRESHOLD ? 'flat' : delta < 0 ? 'improved' : 'worsened';
      return { category, recentDensity, pastDensity, delta, direction };
    })
    .sort((a, b) => b.recentDensity - a.recentDensity);
}

// ── 再発ミス検出 ────────────────────────────────────────────────
// getFrequentMistakes は直近 RECENT_SESSION_LIMIT 件しか見ないため「以前も同じミスをした」という
// 本当の癖を取りこぼす。ここでは全期間を対象に、2つ以上の異なる日付に登場したミスだけを抽出する
// （同じ日に同じミスを繰り返しても癖の証拠にはならないため、件数ではなく登場日数で判定する）。
const RECURRING_LIMIT = 20;

export interface RecurringMistake extends Mistake {
  dayCount: number; // 登場した異なる日付の数
  firstDate: string; // 最初に登場したセッションの date（ISO）
  lastDate: string; // 最後に登場したセッションの date（ISO）
}

export function getRecurringMistakes(sessions: CorrectionSession[]): RecurringMistake[] {
  const grouped = new Map<string, { mistake: Mistake; days: Set<string>; dates: string[] }>();
  for (const s of sessions) {
    const dayKey = toDayKey(s.date);
    for (const m of s.mistakes) {
      const key = normalizeDrillKey(m.original);
      const existing = grouped.get(key);
      if (existing) {
        existing.days.add(dayKey);
        existing.dates.push(s.date);
      } else {
        grouped.set(key, { mistake: m, days: new Set([dayKey]), dates: [s.date] });
      }
    }
  }
  return [...grouped.values()]
    .filter((g) => g.days.size >= 2)
    .map((g) => {
      const sorted = [...g.dates].sort((a, b) => a.localeCompare(b));
      return {
        ...g.mistake,
        dayCount: g.days.size,
        firstDate: sorted[0],
        lastDate: sorted[sorted.length - 1],
      };
    })
    .sort((a, b) => b.dayCount - a.dayCount || b.lastDate.localeCompare(a.lastDate))
    .slice(0, RECURRING_LIMIT);
}

// ── ミス密度（errorDensity）推移: getEvaluationHistory と同じ日単位集約規則で昇順に返す ──
export function getErrorDensityHistory(
  sessions: CorrectionSession[],
): { date: string; density: number }[] {
  return getEvaluationHistory(sessions).map((h) => ({
    date: h.date,
    density: h.evaluation.errorDensity,
  }));
}

// ── 未克服ミス: 頻出ミスをドリル習熟度と突合し、まだ身についていないものだけを残す ──
// 習熟済み（correctStreak >= masteryStreak）は除外し、「未克服 → 未着手 → 定着途中」の順に並べる
// （挑戦したのに正解できていないミスが最も優先度が高いため）。
// DrillProgress は引数（progressOf）で受け取り、この関数自体は DI なしで単体テストできるようにする。
export type MasteryState = 'unmastered' | 'untouched' | 'learning';
const MASTERY_ORDER: Record<MasteryState, number> = { unmastered: 0, untouched: 1, learning: 2 };

export function getUnmasteredMistakes(
  sessions: CorrectionSession[],
  progressOf: (key: string) => DrillProgress | undefined,
  masteryStreak: number,
): (Mistake & { count: number; state: MasteryState })[] {
  const result: (Mistake & { count: number; state: MasteryState })[] = [];
  for (const m of getFrequentMistakes(sessions)) {
    const progress = progressOf(normalizeDrillKey(m.original));
    let state: MasteryState;
    if (!progress) {
      state = 'untouched';
    } else if (!progress.everCorrect) {
      state = 'unmastered';
    } else if (progress.correctStreak < masteryStreak) {
      state = 'learning';
    } else {
      continue; // 習熟済みは表示しない
    }
    result.push({ ...m, state });
  }
  return result.sort(
    (a, b) => MASTERY_ORDER[a.state] - MASTERY_ORDER[b.state] || b.count - a.count,
  );
}
