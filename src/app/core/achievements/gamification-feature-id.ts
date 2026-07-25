/**
 * @file GamificationStats.features / AchievementContext.masteryProgress のキーに使う featureId 文字列定数。
 * 型としては任意の string を受け付ける汎用マップだが、現在使用する3つのfeatureIdをtypoなく参照できるよう
 * ここに定数化する。新しいゲーミフィケーション対象機能を追加する場合は、ここに定数を1つ追加し
 * gamification-stats.service.ts の initialStats()・achievement-definitions/ に新しいファイルを追加するだけでよい。
 */
export const FEATURE_ID_CORRECTION = 'correction';
export const FEATURE_ID_CLOZE = 'cloze';
export const FEATURE_ID_LEVELUP = 'levelup';
