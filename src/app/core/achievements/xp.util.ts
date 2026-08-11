/**
 * @file 経験値（XP）とラボレベルの純粋な算出ロジック。signal・永続化には依存しない。
 * 経験値は対象機能（添削／穴埋めクイズ／穴あきタイピング）をまたいだ単一の累積値で、
 * GamificationStats.totalXp として保存する（機能別には持たない。session.model.ts 参照）。
 * 「ラボレベル」という呼称は、CEFR を一段階上げる意味で予約済みの「レベルアップ」
 * （LevelUpItem／穴あきタイピング）と混同しないための用語上の区別（docs/glossary.md 参照）。
 */

// ── 付与量 ────────────────────────────────────────────────
// 不正解でも少量入るのは、間違えた回のプレイも前進として扱い挑戦を促すため。
export const XP_CORRECT = 10;
export const XP_WRONG = 2;
export const XP_MASTERED = 50; // 穴あきタイピングで1文を習熟した
export const XP_PERFECT_SESSION = 30; // 1回のプレイをパーフェクトで終えた
export const XP_MISSION = 40; // デイリーミッションを1件達成した
export const XP_STREAK_BONUS = 5; // 連続正解が5の倍数に到達した回のボーナス

// 1問の解答で得られる経験値。連続正解が5の倍数に達した回だけボーナスを上乗せする。
export function xpForAnswer(correct: boolean, streak: number): number {
  if (!correct) return XP_WRONG;
  const bonus = streak > 0 && streak % 5 === 0 ? XP_STREAK_BONUS : 0;
  return XP_CORRECT + bonus;
}

// ── ラボレベルの曲線 ──────────────────────────────────────
// レベル L に到達するのに必要な累積経験値: cumulative(L) = 50 * L * (L - 1)
//   Lv1=0 / Lv2=100 / Lv3=300 / Lv4=600 / Lv5=1000 …（1レベルごとに必要量が100ずつ増える）
export function cumulativeXpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

// 累積経験値からラボレベルを求める（cumulative の逆関数）。最低値は 1。
export function labLevelFromXp(xp: number): number {
  if (xp <= 0) return 1;
  return Math.floor((1 + Math.sqrt(1 + xp / 12.5)) / 2);
}

// 現在のラボレベルと、そのレベル内での進捗（分子・分母）を返す。プログレスバー表示用。
export function levelProgress(xp: number): { level: number; inLevel: number; needed: number } {
  const safeXp = Math.max(0, xp);
  const level = labLevelFromXp(safeXp);
  const base = cumulativeXpForLevel(level);
  const next = cumulativeXpForLevel(level + 1);
  return { level, inLevel: safeXp - base, needed: next - base };
}
