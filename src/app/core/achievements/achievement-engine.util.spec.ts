import { FeatureGamificationStats, GamificationStats } from '@core/models/session.model';
import { evaluateNewlyUnlocked } from './achievement-engine.util';
import { AchievementContext } from './achievement.model';

function emptyFeatureStats(
  overrides: Partial<FeatureGamificationStats> = {},
): FeatureGamificationStats {
  return {
    totalAttempts: 0,
    totalCorrect: 0,
    totalWrong: 0,
    sessionsCompleted: 0,
    perfectSessionCount: 0,
    currentPerfectStreak: 0,
    longestPerfectStreak: 0,
    currentDailyStreak: 0,
    longestDailyStreak: 0,
    bestInSessionCorrectStreak: 0,
    completedSessionKeys: {},
    ...overrides,
  };
}

function baseStats(
  overrides: {
    correction?: Partial<FeatureGamificationStats>;
    cloze?: Partial<FeatureGamificationStats>;
    levelup?: Partial<FeatureGamificationStats>;
    unlockedAchievements?: Record<string, string>;
  } = {},
): GamificationStats {
  return {
    correction: emptyFeatureStats(overrides.correction),
    cloze: emptyFeatureStats(overrides.cloze),
    levelup: emptyFeatureStats(overrides.levelup),
    unlockedAchievements: overrides.unlockedAchievements ?? {},
  };
}

const emptyCtx: AchievementContext = {
  clozeAchievement: { done: 0, total: 0 },
  levelUpAchievement: { done: 0, total: 0 },
};

describe('evaluateNewlyUnlocked', () => {
  it('条件を満たさない場合は空配列を返す', () => {
    expect(evaluateNewlyUnlocked(baseStats(), emptyCtx)).toEqual([]);
  });

  it('添削回数10回でcorrection-count-10のみ新規解除される', () => {
    const stats = baseStats({ correction: { totalAttempts: 10 } });
    expect(evaluateNewlyUnlocked(stats, emptyCtx)).toEqual(['correction-count-10']);
  });

  it('既に解除済みの実績は返さない', () => {
    const stats = baseStats({
      correction: { totalAttempts: 10 },
      unlockedAchievements: { 'correction-count-10': '2026-07-16T00:00:00.000Z' },
    });
    expect(evaluateNewlyUnlocked(stats, emptyCtx)).toEqual([]);
  });

  it('穴埋めクイズと穴あきタイピングの統計は独立している', () => {
    const stats = baseStats({ cloze: { totalAttempts: 10 } });
    const result = evaluateNewlyUnlocked(stats, emptyCtx);
    expect(result).toContain('cloze-attempts-10');
    expect(result).not.toContain('levelup-attempts-10');
  });

  it('穴埋めクイズの全日程クリアでcloze-masteryが解除される', () => {
    const ctx: AchievementContext = {
      clozeAchievement: { done: 5, total: 5 },
      levelUpAchievement: { done: 0, total: 0 },
    };
    const result = evaluateNewlyUnlocked(baseStats(), ctx);
    expect(result).toContain('cloze-mastery');
    expect(result).not.toContain('levelup-mastery');
  });

  it('total0件のモード制覇は未解除のまま', () => {
    const result = evaluateNewlyUnlocked(baseStats(), emptyCtx);
    expect(result).not.toContain('cloze-mastery');
    expect(result).not.toContain('levelup-mastery');
  });
});
