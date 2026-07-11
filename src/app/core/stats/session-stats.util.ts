/**
 * @file セッション配列からの統計・集計計算を担う純粋関数群。
 * すべて sessions（CorrectionSession[]）を引数に取るため
 * Angular DI なしに単体テストできる。カテゴリ正規化・CEFR数値化・学習統計・評価推移・頻出ミス・
 * 復習カード集計・レベルアップ対象セッション抽出を提供する。
 */
import { CorrectionSession, Mistake, ReviewItem, WritingEvaluation } from '@core/models/session.model';
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
  'grammar': '文法',
  'vocabulary': '語彙',
  'word choice': '語彙',
  'verb/word choice': '語彙',
  'spelling': 'スペリング',
  'collocation': 'コロケーション',
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
  totalSessions: number;     // 総添削数
  totalMistakes: number;     // 総ミス数
  avgMistakes: number;       // 1回あたり平均ミス数（小数1桁）
  currentStreak: number;     // 連続学習日数
  last7DaysCount: number;    // 直近7日のセッション数
}

// ── ミス統計集計 ─────────────────────────────────────────────────
// カテゴリは normalizeCategory() で正規化してから集計し、英日表記の重複を防ぐ。
export function getMistakeStats(sessions: CorrectionSession[]): { category: string; count: number }[] {
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
  const avgMistakes = totalSessions === 0
    ? 0
    : Math.round((totalMistakes / totalSessions) * 10) / 10;

  // セッションが存在する日付（ローカル時刻 YYYY-MM-DD）の集合
  const dayKeys = new Set(sessions.map(s => toDayKey(s.date)));

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
    s => new Date(s.date).getTime() >= sevenDaysAgo.getTime()
  ).length;

  return { totalSessions, totalMistakes, avgMistakes, currentStreak, last7DaysCount };
}

// ── 評価推移: evaluation を持つセッションを日付昇順で返す（同一日付は最新を採用） ─
// スコア推移グラフ・CEFR推移グラフの両方がこの履歴を参照する。
// CEFR は AI の実判定値をそのまま用いる（スコア由来で上書きすると過大評価に戻るため正規化しない）。
export function getEvaluationHistory(sessions: CorrectionSession[]): { date: string; evaluation: WritingEvaluation }[] {
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
export function getFrequentMistakes(sessions: CorrectionSession[]): (Mistake & { count: number })[] {
  const all = sessions.slice(0, RECENT_SESSION_LIMIT).flatMap(s => s.mistakes);
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
  return [...seen.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

// ── 復習カード集計: 直近 RECENT_SESSION_LIMIT 件の reviewItems を平坦化して返す（Drill の穴埋め復習で出題） ─
export function getReviewItems(sessions: CorrectionSession[]): ReviewItem[] {
  return sessions.slice(0, RECENT_SESSION_LIMIT).flatMap(s => s.reviewItems ?? []);
}

// ── レベルアップ例文を持つセッション一覧: Drill の日付選択画面で使う ─
// 直近 RECENT_SESSION_LIMIT 件には絞らず、全期間の levelUpItems を持つセッションを対象にする
// （日付単位で1セッションを選んでその中の例文を順にたどる仕様のため、古い日付も選択肢に残す）。
// sessions は既に新しい順にソート済みである前提のため、追加のソートは行わない。
export function getSessionsWithLevelUp(sessions: CorrectionSession[]): CorrectionSession[] {
  return sessions.filter(s => (s.levelUpItems?.length ?? 0) > 0);
}

// ── 復習カードを持つセッション一覧: Drill の穴埋め復習・日付選択画面で使う ─
// getReviewItems と同じ RECENT_SESSION_LIMIT 件のスライスを対象にする（今のレベルではもう
// 犯していない古いミス由来のカードを除外し、「今の弱点」を優先出題する方針を日付選択でも踏襲する）。
export function getSessionsWithReviewItems(sessions: CorrectionSession[]): CorrectionSession[] {
  return sessions.slice(0, RECENT_SESSION_LIMIT).filter(s => (s.reviewItems?.length ?? 0) > 0);
}
