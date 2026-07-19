/**
 * @file 実績（バッジ）の宣言的な一覧のうち、添削（correction）分。
 * 累積・連続系は progress（現在値/しきい値）を持ち、実績一覧ページで未解除時の進捗表示に使う。
 * i18n文言は achievements.<id>.title/desc に対応させる。
 */
import { AchievementDef } from '../achievement.model';
import { FEATURE_ID_CORRECTION } from '../gamification-feature-id';

export const CORRECTION_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'correction-count-10',
    group: FEATURE_ID_CORRECTION,
    titleKey: 'achievements.correction-count-10.title',
    descKey: 'achievements.correction-count-10.desc',
    isUnlocked: (s) => (s.features[FEATURE_ID_CORRECTION]?.totalAttempts ?? 0) >= 10,
    progress: {
      target: 10,
      currentValue: (s) => s.features[FEATURE_ID_CORRECTION]?.totalAttempts ?? 0,
    },
  },
  {
    id: 'correction-count-50',
    group: FEATURE_ID_CORRECTION,
    titleKey: 'achievements.correction-count-50.title',
    descKey: 'achievements.correction-count-50.desc',
    isUnlocked: (s) => (s.features[FEATURE_ID_CORRECTION]?.totalAttempts ?? 0) >= 50,
    progress: {
      target: 50,
      currentValue: (s) => s.features[FEATURE_ID_CORRECTION]?.totalAttempts ?? 0,
    },
  },
  {
    id: 'correction-count-200',
    group: FEATURE_ID_CORRECTION,
    titleKey: 'achievements.correction-count-200.title',
    descKey: 'achievements.correction-count-200.desc',
    isUnlocked: (s) => (s.features[FEATURE_ID_CORRECTION]?.totalAttempts ?? 0) >= 200,
    progress: {
      target: 200,
      currentValue: (s) => s.features[FEATURE_ID_CORRECTION]?.totalAttempts ?? 0,
    },
  },
  {
    id: 'correction-daily-3',
    group: FEATURE_ID_CORRECTION,
    titleKey: 'achievements.correction-daily-3.title',
    descKey: 'achievements.correction-daily-3.desc',
    isUnlocked: (s) => (s.features[FEATURE_ID_CORRECTION]?.longestDailyStreak ?? 0) >= 3,
    progress: {
      target: 3,
      currentValue: (s) => s.features[FEATURE_ID_CORRECTION]?.longestDailyStreak ?? 0,
    },
  },
  {
    id: 'correction-daily-7',
    group: FEATURE_ID_CORRECTION,
    titleKey: 'achievements.correction-daily-7.title',
    descKey: 'achievements.correction-daily-7.desc',
    isUnlocked: (s) => (s.features[FEATURE_ID_CORRECTION]?.longestDailyStreak ?? 0) >= 7,
    progress: {
      target: 7,
      currentValue: (s) => s.features[FEATURE_ID_CORRECTION]?.longestDailyStreak ?? 0,
    },
  },
  {
    id: 'correction-daily-30',
    group: FEATURE_ID_CORRECTION,
    titleKey: 'achievements.correction-daily-30.title',
    descKey: 'achievements.correction-daily-30.desc',
    isUnlocked: (s) => (s.features[FEATURE_ID_CORRECTION]?.longestDailyStreak ?? 0) >= 30,
    progress: {
      target: 30,
      currentValue: (s) => s.features[FEATURE_ID_CORRECTION]?.longestDailyStreak ?? 0,
    },
  },
];
