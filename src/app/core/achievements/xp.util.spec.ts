import {
  XP_CORRECT,
  XP_STREAK_BONUS,
  XP_WRONG,
  cumulativeXpForLevel,
  labLevelFromXp,
  levelProgress,
  xpForAnswer,
} from './xp.util';

describe('xp.util', () => {
  describe('xpForAnswer', () => {
    it('不正解でも少量の経験値が入る', () => {
      expect(xpForAnswer(false, 0)).toBe(XP_WRONG);
    });

    it('正解は基本量、連続正解が5の倍数の回だけボーナスが乗る', () => {
      expect(xpForAnswer(true, 1)).toBe(XP_CORRECT);
      expect(xpForAnswer(true, 4)).toBe(XP_CORRECT);
      expect(xpForAnswer(true, 5)).toBe(XP_CORRECT + XP_STREAK_BONUS);
      expect(xpForAnswer(true, 6)).toBe(XP_CORRECT);
      expect(xpForAnswer(true, 10)).toBe(XP_CORRECT + XP_STREAK_BONUS);
    });

    it('連続正解0の正解（起こらない想定）ではボーナスが乗らない', () => {
      expect(xpForAnswer(true, 0)).toBe(XP_CORRECT);
    });
  });

  describe('labLevelFromXp', () => {
    it('曲線の境界でレベルが上がる（Lv2=100, Lv3=300, Lv4=600, Lv5=1000）', () => {
      expect(labLevelFromXp(0)).toBe(1);
      expect(labLevelFromXp(99)).toBe(1);
      expect(labLevelFromXp(100)).toBe(2);
      expect(labLevelFromXp(299)).toBe(2);
      expect(labLevelFromXp(300)).toBe(3);
      expect(labLevelFromXp(599)).toBe(3);
      expect(labLevelFromXp(600)).toBe(4);
      expect(labLevelFromXp(1000)).toBe(5);
    });

    it('負値でも1を返す', () => {
      expect(labLevelFromXp(-50)).toBe(1);
    });

    it('経験値が増えてもレベルは下がらない（単調非減少）', () => {
      let prev = labLevelFromXp(0);
      for (let xp = 0; xp <= 5000; xp += 17) {
        const level = labLevelFromXp(xp);
        expect(level).toBeGreaterThanOrEqual(prev);
        prev = level;
      }
    });

    it('cumulativeXpForLevel の境界と往復で一致する', () => {
      for (let level = 1; level <= 20; level++) {
        expect(labLevelFromXp(cumulativeXpForLevel(level))).toBe(level);
        expect(labLevelFromXp(cumulativeXpForLevel(level + 1) - 1)).toBe(level);
      }
    });
  });

  describe('levelProgress', () => {
    it('レベル内の進捗を分子・分母で返す', () => {
      expect(levelProgress(0)).toEqual({ level: 1, inLevel: 0, needed: 100 });
      expect(levelProgress(50)).toEqual({ level: 1, inLevel: 50, needed: 100 });
      expect(levelProgress(100)).toEqual({ level: 2, inLevel: 0, needed: 200 });
      expect(levelProgress(250)).toEqual({ level: 2, inLevel: 150, needed: 200 });
    });

    it('inLevelは常に0以上needed未満に収まる', () => {
      for (let xp = 0; xp <= 3000; xp += 7) {
        const { inLevel, needed } = levelProgress(xp);
        expect(inLevel).toBeGreaterThanOrEqual(0);
        expect(inLevel).toBeLessThan(needed);
      }
    });
  });
});
