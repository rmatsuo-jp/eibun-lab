/**
 * @file 実績の新規解除判定。signal状態に依存しない純粋関数のみを置き、単体テスト可能にする
 * （core/quiz/quiz.util.ts と同様の方針）。
 */
import { GamificationStats } from '@core/models/session.model';
import { ACHIEVEMENTS } from './achievement-definitions';
import { AchievementContext, AchievementId } from './achievement.model';

// 現在の統計・集計から、まだ unlockedAchievements に含まれていない実績IDのうち
// 新たに条件を満たしたものを返す。
export function evaluateNewlyUnlocked(
  stats: GamificationStats,
  ctx: AchievementContext,
): AchievementId[] {
  return ACHIEVEMENTS.filter(
    (def) => !(def.id in stats.unlockedAchievements) && def.isUnlocked(stats, ctx),
  ).map((def) => def.id);
}
