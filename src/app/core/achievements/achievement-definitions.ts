/**
 * @file 実績（バッジ）の宣言的な一覧。対象機能（添削・穴埋めクイズ・穴あきタイピング）ごとに分類する。
 * 穴埋めクイズ／穴あきタイピングは同じ4系統（累積・連続・パーフェクト・制覇）構成を持つが、
 * 参照する統計（GamificationStats.cloze / .levelup）が独立しているため、
 * 一方だけプレイしても他方の実績条件は進まない。
 * 「制覇」は文法カテゴリ別ではなく、そのモードの全日程クリアで判定する
 * （ReviewItemに文法カテゴリ情報がないため）。i18n文言は achievements.<id>.title/desc に対応させる。
 * 累積・連続・パーフェクト系は progress（現在値/しきい値）を持ち、実績一覧ページで
 * 未解除時の進捗表示に使う。制覇系は progress を持たない（理由は achievement.model.ts 参照）。
 */
import { AchievementDef } from './achievement.model';

// ── 添削 ──────────────────────────────────────────────────────
const CORRECTION_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'correction-count-10',
    group: 'correction',
    titleKey: 'achievements.correction-count-10.title',
    descKey: 'achievements.correction-count-10.desc',
    isUnlocked: (s) => s.correction.totalAttempts >= 10,
    progress: { target: 10, currentValue: (s) => s.correction.totalAttempts },
  },
  {
    id: 'correction-count-50',
    group: 'correction',
    titleKey: 'achievements.correction-count-50.title',
    descKey: 'achievements.correction-count-50.desc',
    isUnlocked: (s) => s.correction.totalAttempts >= 50,
    progress: { target: 50, currentValue: (s) => s.correction.totalAttempts },
  },
  {
    id: 'correction-count-200',
    group: 'correction',
    titleKey: 'achievements.correction-count-200.title',
    descKey: 'achievements.correction-count-200.desc',
    isUnlocked: (s) => s.correction.totalAttempts >= 200,
    progress: { target: 200, currentValue: (s) => s.correction.totalAttempts },
  },
  {
    id: 'correction-daily-3',
    group: 'correction',
    titleKey: 'achievements.correction-daily-3.title',
    descKey: 'achievements.correction-daily-3.desc',
    isUnlocked: (s) => s.correction.longestDailyStreak >= 3,
    progress: { target: 3, currentValue: (s) => s.correction.longestDailyStreak },
  },
  {
    id: 'correction-daily-7',
    group: 'correction',
    titleKey: 'achievements.correction-daily-7.title',
    descKey: 'achievements.correction-daily-7.desc',
    isUnlocked: (s) => s.correction.longestDailyStreak >= 7,
    progress: { target: 7, currentValue: (s) => s.correction.longestDailyStreak },
  },
  {
    id: 'correction-daily-30',
    group: 'correction',
    titleKey: 'achievements.correction-daily-30.title',
    descKey: 'achievements.correction-daily-30.desc',
    isUnlocked: (s) => s.correction.longestDailyStreak >= 30,
    progress: { target: 30, currentValue: (s) => s.correction.longestDailyStreak },
  },
];

// ── 穴埋めクイズ ──────────────────────────────────────────────
const CLOZE_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'cloze-attempts-10',
    group: 'cloze',
    titleKey: 'achievements.cloze-attempts-10.title',
    descKey: 'achievements.cloze-attempts-10.desc',
    isUnlocked: (s) => s.cloze.totalAttempts >= 10,
    progress: { target: 10, currentValue: (s) => s.cloze.totalAttempts },
  },
  {
    id: 'cloze-attempts-50',
    group: 'cloze',
    titleKey: 'achievements.cloze-attempts-50.title',
    descKey: 'achievements.cloze-attempts-50.desc',
    isUnlocked: (s) => s.cloze.totalAttempts >= 50,
    progress: { target: 50, currentValue: (s) => s.cloze.totalAttempts },
  },
  {
    id: 'cloze-attempts-200',
    group: 'cloze',
    titleKey: 'achievements.cloze-attempts-200.title',
    descKey: 'achievements.cloze-attempts-200.desc',
    isUnlocked: (s) => s.cloze.totalAttempts >= 200,
    progress: { target: 200, currentValue: (s) => s.cloze.totalAttempts },
  },
  {
    id: 'cloze-correct-10',
    group: 'cloze',
    titleKey: 'achievements.cloze-correct-10.title',
    descKey: 'achievements.cloze-correct-10.desc',
    isUnlocked: (s) => s.cloze.totalCorrect >= 10,
    progress: { target: 10, currentValue: (s) => s.cloze.totalCorrect },
  },
  {
    id: 'cloze-correct-100',
    group: 'cloze',
    titleKey: 'achievements.cloze-correct-100.title',
    descKey: 'achievements.cloze-correct-100.desc',
    isUnlocked: (s) => s.cloze.totalCorrect >= 100,
    progress: { target: 100, currentValue: (s) => s.cloze.totalCorrect },
  },
  {
    id: 'cloze-correct-500',
    group: 'cloze',
    titleKey: 'achievements.cloze-correct-500.title',
    descKey: 'achievements.cloze-correct-500.desc',
    isUnlocked: (s) => s.cloze.totalCorrect >= 500,
    progress: { target: 500, currentValue: (s) => s.cloze.totalCorrect },
  },
  {
    id: 'cloze-streak-5',
    group: 'cloze',
    titleKey: 'achievements.cloze-streak-5.title',
    descKey: 'achievements.cloze-streak-5.desc',
    isUnlocked: (s) => s.cloze.bestInSessionCorrectStreak >= 5,
    progress: { target: 5, currentValue: (s) => s.cloze.bestInSessionCorrectStreak },
  },
  {
    id: 'cloze-streak-10',
    group: 'cloze',
    titleKey: 'achievements.cloze-streak-10.title',
    descKey: 'achievements.cloze-streak-10.desc',
    isUnlocked: (s) => s.cloze.bestInSessionCorrectStreak >= 10,
    progress: { target: 10, currentValue: (s) => s.cloze.bestInSessionCorrectStreak },
  },
  {
    id: 'cloze-streak-20',
    group: 'cloze',
    titleKey: 'achievements.cloze-streak-20.title',
    descKey: 'achievements.cloze-streak-20.desc',
    isUnlocked: (s) => s.cloze.bestInSessionCorrectStreak >= 20,
    progress: { target: 20, currentValue: (s) => s.cloze.bestInSessionCorrectStreak },
  },
  {
    id: 'cloze-daily-3',
    group: 'cloze',
    titleKey: 'achievements.cloze-daily-3.title',
    descKey: 'achievements.cloze-daily-3.desc',
    isUnlocked: (s) => s.cloze.longestDailyStreak >= 3,
    progress: { target: 3, currentValue: (s) => s.cloze.longestDailyStreak },
  },
  {
    id: 'cloze-daily-7',
    group: 'cloze',
    titleKey: 'achievements.cloze-daily-7.title',
    descKey: 'achievements.cloze-daily-7.desc',
    isUnlocked: (s) => s.cloze.longestDailyStreak >= 7,
    progress: { target: 7, currentValue: (s) => s.cloze.longestDailyStreak },
  },
  {
    id: 'cloze-daily-30',
    group: 'cloze',
    titleKey: 'achievements.cloze-daily-30.title',
    descKey: 'achievements.cloze-daily-30.desc',
    isUnlocked: (s) => s.cloze.longestDailyStreak >= 30,
    progress: { target: 30, currentValue: (s) => s.cloze.longestDailyStreak },
  },
  {
    id: 'cloze-perfect-1',
    group: 'cloze',
    titleKey: 'achievements.cloze-perfect-1.title',
    descKey: 'achievements.cloze-perfect-1.desc',
    isUnlocked: (s) => s.cloze.perfectSessionCount >= 1,
    progress: { target: 1, currentValue: (s) => s.cloze.perfectSessionCount },
  },
  {
    id: 'cloze-perfect-5',
    group: 'cloze',
    titleKey: 'achievements.cloze-perfect-5.title',
    descKey: 'achievements.cloze-perfect-5.desc',
    isUnlocked: (s) => s.cloze.perfectSessionCount >= 5,
    progress: { target: 5, currentValue: (s) => s.cloze.perfectSessionCount },
  },
  {
    id: 'cloze-perfect-streak-3',
    group: 'cloze',
    titleKey: 'achievements.cloze-perfect-streak-3.title',
    descKey: 'achievements.cloze-perfect-streak-3.desc',
    isUnlocked: (s) => s.cloze.longestPerfectStreak >= 3,
    progress: { target: 3, currentValue: (s) => s.cloze.longestPerfectStreak },
  },
  {
    id: 'cloze-mastery',
    group: 'cloze',
    titleKey: 'achievements.cloze-mastery.title',
    descKey: 'achievements.cloze-mastery.desc',
    isUnlocked: (_s, ctx) =>
      ctx.clozeAchievement.total > 0 && ctx.clozeAchievement.done === ctx.clozeAchievement.total,
  },
];

// ── 穴あきタイピング ──────────────────────────────────────────
const LEVELUP_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'levelup-attempts-10',
    group: 'levelup',
    titleKey: 'achievements.levelup-attempts-10.title',
    descKey: 'achievements.levelup-attempts-10.desc',
    isUnlocked: (s) => s.levelup.totalAttempts >= 10,
    progress: { target: 10, currentValue: (s) => s.levelup.totalAttempts },
  },
  {
    id: 'levelup-attempts-50',
    group: 'levelup',
    titleKey: 'achievements.levelup-attempts-50.title',
    descKey: 'achievements.levelup-attempts-50.desc',
    isUnlocked: (s) => s.levelup.totalAttempts >= 50,
    progress: { target: 50, currentValue: (s) => s.levelup.totalAttempts },
  },
  {
    id: 'levelup-attempts-200',
    group: 'levelup',
    titleKey: 'achievements.levelup-attempts-200.title',
    descKey: 'achievements.levelup-attempts-200.desc',
    isUnlocked: (s) => s.levelup.totalAttempts >= 200,
    progress: { target: 200, currentValue: (s) => s.levelup.totalAttempts },
  },
  {
    id: 'levelup-correct-10',
    group: 'levelup',
    titleKey: 'achievements.levelup-correct-10.title',
    descKey: 'achievements.levelup-correct-10.desc',
    isUnlocked: (s) => s.levelup.totalCorrect >= 10,
    progress: { target: 10, currentValue: (s) => s.levelup.totalCorrect },
  },
  {
    id: 'levelup-correct-100',
    group: 'levelup',
    titleKey: 'achievements.levelup-correct-100.title',
    descKey: 'achievements.levelup-correct-100.desc',
    isUnlocked: (s) => s.levelup.totalCorrect >= 100,
    progress: { target: 100, currentValue: (s) => s.levelup.totalCorrect },
  },
  {
    id: 'levelup-correct-500',
    group: 'levelup',
    titleKey: 'achievements.levelup-correct-500.title',
    descKey: 'achievements.levelup-correct-500.desc',
    isUnlocked: (s) => s.levelup.totalCorrect >= 500,
    progress: { target: 500, currentValue: (s) => s.levelup.totalCorrect },
  },
  {
    id: 'levelup-streak-5',
    group: 'levelup',
    titleKey: 'achievements.levelup-streak-5.title',
    descKey: 'achievements.levelup-streak-5.desc',
    isUnlocked: (s) => s.levelup.bestInSessionCorrectStreak >= 5,
    progress: { target: 5, currentValue: (s) => s.levelup.bestInSessionCorrectStreak },
  },
  {
    id: 'levelup-streak-10',
    group: 'levelup',
    titleKey: 'achievements.levelup-streak-10.title',
    descKey: 'achievements.levelup-streak-10.desc',
    isUnlocked: (s) => s.levelup.bestInSessionCorrectStreak >= 10,
    progress: { target: 10, currentValue: (s) => s.levelup.bestInSessionCorrectStreak },
  },
  {
    id: 'levelup-streak-20',
    group: 'levelup',
    titleKey: 'achievements.levelup-streak-20.title',
    descKey: 'achievements.levelup-streak-20.desc',
    isUnlocked: (s) => s.levelup.bestInSessionCorrectStreak >= 20,
    progress: { target: 20, currentValue: (s) => s.levelup.bestInSessionCorrectStreak },
  },
  {
    id: 'levelup-daily-3',
    group: 'levelup',
    titleKey: 'achievements.levelup-daily-3.title',
    descKey: 'achievements.levelup-daily-3.desc',
    isUnlocked: (s) => s.levelup.longestDailyStreak >= 3,
    progress: { target: 3, currentValue: (s) => s.levelup.longestDailyStreak },
  },
  {
    id: 'levelup-daily-7',
    group: 'levelup',
    titleKey: 'achievements.levelup-daily-7.title',
    descKey: 'achievements.levelup-daily-7.desc',
    isUnlocked: (s) => s.levelup.longestDailyStreak >= 7,
    progress: { target: 7, currentValue: (s) => s.levelup.longestDailyStreak },
  },
  {
    id: 'levelup-daily-30',
    group: 'levelup',
    titleKey: 'achievements.levelup-daily-30.title',
    descKey: 'achievements.levelup-daily-30.desc',
    isUnlocked: (s) => s.levelup.longestDailyStreak >= 30,
    progress: { target: 30, currentValue: (s) => s.levelup.longestDailyStreak },
  },
  {
    id: 'levelup-perfect-1',
    group: 'levelup',
    titleKey: 'achievements.levelup-perfect-1.title',
    descKey: 'achievements.levelup-perfect-1.desc',
    isUnlocked: (s) => s.levelup.perfectSessionCount >= 1,
    progress: { target: 1, currentValue: (s) => s.levelup.perfectSessionCount },
  },
  {
    id: 'levelup-perfect-5',
    group: 'levelup',
    titleKey: 'achievements.levelup-perfect-5.title',
    descKey: 'achievements.levelup-perfect-5.desc',
    isUnlocked: (s) => s.levelup.perfectSessionCount >= 5,
    progress: { target: 5, currentValue: (s) => s.levelup.perfectSessionCount },
  },
  {
    id: 'levelup-perfect-streak-3',
    group: 'levelup',
    titleKey: 'achievements.levelup-perfect-streak-3.title',
    descKey: 'achievements.levelup-perfect-streak-3.desc',
    isUnlocked: (s) => s.levelup.longestPerfectStreak >= 3,
    progress: { target: 3, currentValue: (s) => s.levelup.longestPerfectStreak },
  },
  {
    id: 'levelup-mastery',
    group: 'levelup',
    titleKey: 'achievements.levelup-mastery.title',
    descKey: 'achievements.levelup-mastery.desc',
    isUnlocked: (_s, ctx) =>
      ctx.levelUpAchievement.total > 0 &&
      ctx.levelUpAchievement.done === ctx.levelUpAchievement.total,
  },
];

export const ACHIEVEMENTS: AchievementDef[] = [
  ...CORRECTION_ACHIEVEMENTS,
  ...CLOZE_ACHIEVEMENTS,
  ...LEVELUP_ACHIEVEMENTS,
];
