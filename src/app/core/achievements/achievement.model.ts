/**
 * @file 実績（バッジ）の型定義。実績は対象機能（添削／穴埋めクイズ／穴あきタイピング）ごとに分類する。
 * AchievementDef.isUnlocked は GamificationStats（該当グループの FeatureGamificationStats を参照）と
 * AchievementContext（モード制覇判定用の集計）を受け取り、解除条件を満たすか判定する純粋関数。
 * 実際の定義一覧は achievement-definitions.ts、判定ロジックは achievement-engine.util.ts に置く。
 */
import { GamificationStats } from '@core/models/session.model';

// ── AchievementId: 実績の一意なID（i18nキーの achievements.<id>.title/desc にも対応） ─────
export type AchievementId =
  // 添削
  | 'correction-count-10'
  | 'correction-count-50'
  | 'correction-count-200'
  | 'correction-daily-3'
  | 'correction-daily-7'
  | 'correction-daily-30'
  // 穴埋めクイズ
  | 'cloze-attempts-10'
  | 'cloze-attempts-50'
  | 'cloze-attempts-200'
  | 'cloze-correct-10'
  | 'cloze-correct-100'
  | 'cloze-correct-500'
  | 'cloze-streak-5'
  | 'cloze-streak-10'
  | 'cloze-streak-20'
  | 'cloze-daily-3'
  | 'cloze-daily-7'
  | 'cloze-daily-30'
  | 'cloze-perfect-1'
  | 'cloze-perfect-5'
  | 'cloze-perfect-streak-3'
  | 'cloze-mastery'
  // 穴あきタイピング
  | 'levelup-attempts-10'
  | 'levelup-attempts-50'
  | 'levelup-attempts-200'
  | 'levelup-correct-10'
  | 'levelup-correct-100'
  | 'levelup-correct-500'
  | 'levelup-streak-5'
  | 'levelup-streak-10'
  | 'levelup-streak-20'
  | 'levelup-daily-3'
  | 'levelup-daily-7'
  | 'levelup-daily-30'
  | 'levelup-perfect-1'
  | 'levelup-perfect-5'
  | 'levelup-perfect-streak-3'
  | 'levelup-mastery';

// 実績の分類軸＝対象機能（性質軸は持たない）。
export type AchievementGroup = 'correction' | 'cloze' | 'levelup';

// モード制覇（cloze-mastery/levelup-mastery）判定に使う、日程横断の達成数/全体数
// （DrillState.clozeAchievement/levelUpAchievement と同じ形）。
export interface AchievementContext {
  clozeAchievement: { done: number; total: number };
  levelUpAchievement: { done: number; total: number };
}

export interface AchievementDef {
  id: AchievementId;
  group: AchievementGroup;
  titleKey: string; // i18nキー
  descKey: string; // i18nキー
  isUnlocked(stats: GamificationStats, ctx: AchievementContext): boolean;
  // 未解除時の「現在値/しきい値」表示用（実績一覧ページ）。制覇系（mastery）は達成度の算出に
  // ドリル機能側のデータ（DrillProgressSyncService、features/drill 専有）が必要でこの層からは
  // 参照できないため、progress を持たず一覧側ではロック表示のみ行う。
  progress?: { target: number; currentValue(stats: GamificationStats): number };
}
