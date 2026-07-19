/**
 * @file 実績（バッジ）の宣言的な一覧のうち、穴埋めクイズ（cloze）分。
 * 累積・連続・パーフェクト系は progress（現在値/しきい値）を持ち、実績一覧ページで
 * 未解除時の進捗表示に使う。制覇系（cloze-mastery）は AchievementContext.masteryProgress['cloze']
 * （そのモードの全日程クリア状況）を参照し、progress は持たない
 * （制覇度の算出にドリル機能側のデータが必要でこの層からは参照できないため。achievement.model.ts参照）。
 * i18n文言は achievements.<id>.title/desc に対応させる。
 */
import { AchievementDef } from '../achievement.model';
import { FEATURE_ID_CLOZE } from '../gamification-feature-id';

export const CLOZE_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'cloze-attempts-10',
    group: FEATURE_ID_CLOZE,
    titleKey: 'achievements.cloze-attempts-10.title',
    descKey: 'achievements.cloze-attempts-10.desc',
    isUnlocked: (s) => (s.features[FEATURE_ID_CLOZE]?.totalAttempts ?? 0) >= 10,
    progress: { target: 10, currentValue: (s) => s.features[FEATURE_ID_CLOZE]?.totalAttempts ?? 0 },
  },
  {
    id: 'cloze-attempts-50',
    group: FEATURE_ID_CLOZE,
    titleKey: 'achievements.cloze-attempts-50.title',
    descKey: 'achievements.cloze-attempts-50.desc',
    isUnlocked: (s) => (s.features[FEATURE_ID_CLOZE]?.totalAttempts ?? 0) >= 50,
    progress: { target: 50, currentValue: (s) => s.features[FEATURE_ID_CLOZE]?.totalAttempts ?? 0 },
  },
  {
    id: 'cloze-attempts-200',
    group: FEATURE_ID_CLOZE,
    titleKey: 'achievements.cloze-attempts-200.title',
    descKey: 'achievements.cloze-attempts-200.desc',
    isUnlocked: (s) => (s.features[FEATURE_ID_CLOZE]?.totalAttempts ?? 0) >= 200,
    progress: {
      target: 200,
      currentValue: (s) => s.features[FEATURE_ID_CLOZE]?.totalAttempts ?? 0,
    },
  },
  {
    id: 'cloze-correct-10',
    group: FEATURE_ID_CLOZE,
    titleKey: 'achievements.cloze-correct-10.title',
    descKey: 'achievements.cloze-correct-10.desc',
    isUnlocked: (s) => (s.features[FEATURE_ID_CLOZE]?.totalCorrect ?? 0) >= 10,
    progress: { target: 10, currentValue: (s) => s.features[FEATURE_ID_CLOZE]?.totalCorrect ?? 0 },
  },
  {
    id: 'cloze-correct-100',
    group: FEATURE_ID_CLOZE,
    titleKey: 'achievements.cloze-correct-100.title',
    descKey: 'achievements.cloze-correct-100.desc',
    isUnlocked: (s) => (s.features[FEATURE_ID_CLOZE]?.totalCorrect ?? 0) >= 100,
    progress: { target: 100, currentValue: (s) => s.features[FEATURE_ID_CLOZE]?.totalCorrect ?? 0 },
  },
  {
    id: 'cloze-correct-500',
    group: FEATURE_ID_CLOZE,
    titleKey: 'achievements.cloze-correct-500.title',
    descKey: 'achievements.cloze-correct-500.desc',
    isUnlocked: (s) => (s.features[FEATURE_ID_CLOZE]?.totalCorrect ?? 0) >= 500,
    progress: { target: 500, currentValue: (s) => s.features[FEATURE_ID_CLOZE]?.totalCorrect ?? 0 },
  },
  {
    id: 'cloze-streak-5',
    group: FEATURE_ID_CLOZE,
    titleKey: 'achievements.cloze-streak-5.title',
    descKey: 'achievements.cloze-streak-5.desc',
    isUnlocked: (s) => (s.features[FEATURE_ID_CLOZE]?.bestInSessionCorrectStreak ?? 0) >= 5,
    progress: {
      target: 5,
      currentValue: (s) => s.features[FEATURE_ID_CLOZE]?.bestInSessionCorrectStreak ?? 0,
    },
  },
  {
    id: 'cloze-streak-10',
    group: FEATURE_ID_CLOZE,
    titleKey: 'achievements.cloze-streak-10.title',
    descKey: 'achievements.cloze-streak-10.desc',
    isUnlocked: (s) => (s.features[FEATURE_ID_CLOZE]?.bestInSessionCorrectStreak ?? 0) >= 10,
    progress: {
      target: 10,
      currentValue: (s) => s.features[FEATURE_ID_CLOZE]?.bestInSessionCorrectStreak ?? 0,
    },
  },
  {
    id: 'cloze-streak-20',
    group: FEATURE_ID_CLOZE,
    titleKey: 'achievements.cloze-streak-20.title',
    descKey: 'achievements.cloze-streak-20.desc',
    isUnlocked: (s) => (s.features[FEATURE_ID_CLOZE]?.bestInSessionCorrectStreak ?? 0) >= 20,
    progress: {
      target: 20,
      currentValue: (s) => s.features[FEATURE_ID_CLOZE]?.bestInSessionCorrectStreak ?? 0,
    },
  },
  {
    id: 'cloze-daily-3',
    group: FEATURE_ID_CLOZE,
    titleKey: 'achievements.cloze-daily-3.title',
    descKey: 'achievements.cloze-daily-3.desc',
    isUnlocked: (s) => (s.features[FEATURE_ID_CLOZE]?.longestDailyStreak ?? 0) >= 3,
    progress: {
      target: 3,
      currentValue: (s) => s.features[FEATURE_ID_CLOZE]?.longestDailyStreak ?? 0,
    },
  },
  {
    id: 'cloze-daily-7',
    group: FEATURE_ID_CLOZE,
    titleKey: 'achievements.cloze-daily-7.title',
    descKey: 'achievements.cloze-daily-7.desc',
    isUnlocked: (s) => (s.features[FEATURE_ID_CLOZE]?.longestDailyStreak ?? 0) >= 7,
    progress: {
      target: 7,
      currentValue: (s) => s.features[FEATURE_ID_CLOZE]?.longestDailyStreak ?? 0,
    },
  },
  {
    id: 'cloze-daily-30',
    group: FEATURE_ID_CLOZE,
    titleKey: 'achievements.cloze-daily-30.title',
    descKey: 'achievements.cloze-daily-30.desc',
    isUnlocked: (s) => (s.features[FEATURE_ID_CLOZE]?.longestDailyStreak ?? 0) >= 30,
    progress: {
      target: 30,
      currentValue: (s) => s.features[FEATURE_ID_CLOZE]?.longestDailyStreak ?? 0,
    },
  },
  {
    id: 'cloze-perfect-1',
    group: FEATURE_ID_CLOZE,
    titleKey: 'achievements.cloze-perfect-1.title',
    descKey: 'achievements.cloze-perfect-1.desc',
    isUnlocked: (s) => (s.features[FEATURE_ID_CLOZE]?.perfectSessionCount ?? 0) >= 1,
    progress: {
      target: 1,
      currentValue: (s) => s.features[FEATURE_ID_CLOZE]?.perfectSessionCount ?? 0,
    },
  },
  {
    id: 'cloze-perfect-5',
    group: FEATURE_ID_CLOZE,
    titleKey: 'achievements.cloze-perfect-5.title',
    descKey: 'achievements.cloze-perfect-5.desc',
    isUnlocked: (s) => (s.features[FEATURE_ID_CLOZE]?.perfectSessionCount ?? 0) >= 5,
    progress: {
      target: 5,
      currentValue: (s) => s.features[FEATURE_ID_CLOZE]?.perfectSessionCount ?? 0,
    },
  },
  {
    id: 'cloze-perfect-streak-3',
    group: FEATURE_ID_CLOZE,
    titleKey: 'achievements.cloze-perfect-streak-3.title',
    descKey: 'achievements.cloze-perfect-streak-3.desc',
    isUnlocked: (s) => (s.features[FEATURE_ID_CLOZE]?.longestPerfectStreak ?? 0) >= 3,
    progress: {
      target: 3,
      currentValue: (s) => s.features[FEATURE_ID_CLOZE]?.longestPerfectStreak ?? 0,
    },
  },
  {
    id: 'cloze-mastery',
    group: FEATURE_ID_CLOZE,
    titleKey: 'achievements.cloze-mastery.title',
    descKey: 'achievements.cloze-mastery.desc',
    isUnlocked: (_s, ctx) => {
      const progress = ctx.masteryProgress[FEATURE_ID_CLOZE] ?? { done: 0, total: 0 };
      return progress.total > 0 && progress.done === progress.total;
    },
  },
];
