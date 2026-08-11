import { DAILY_MISSIONS, DAILY_MISSION_COUNT, findMission, pickMissionsFor } from './daily-mission';

describe('daily-mission', () => {
  describe('pickMissionsFor', () => {
    it('同じ日付キーなら常に同じ3件・同じ並びを返す（決定論）', () => {
      const a = pickMissionsFor('2026-08-11').map((m) => m.id);
      const b = pickMissionsFor('2026-08-11').map((m) => m.id);
      expect(a).toEqual(b);
      expect(a.length).toBe(DAILY_MISSION_COUNT);
    });

    it('返す3件は重複しない', () => {
      for (const dayKey of ['2026-01-01', '2026-08-11', '2027-12-31']) {
        const ids = pickMissionsFor(dayKey).map((m) => m.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    });

    it('返すのはカタログに存在する定義のみ', () => {
      const catalogIds = new Set(DAILY_MISSIONS.map((m) => m.id));
      for (const mission of pickMissionsFor('2026-08-11')) {
        expect(catalogIds.has(mission.id)).toBe(true);
      }
    });

    it('日付が変われば組み合わせも変わる（全日程が同一にはならない）', () => {
      const combos = new Set<string>();
      for (let day = 1; day <= 28; day++) {
        const dayKey = `2026-08-${String(day).padStart(2, '0')}`;
        combos.add(
          pickMissionsFor(dayKey)
            .map((m) => m.id)
            .join(','),
        );
      }
      expect(combos.size).toBeGreaterThan(1);
    });

    it('日付キーが空でも壊れず、規定件数を返す', () => {
      expect(pickMissionsFor('').length).toBe(DAILY_MISSION_COUNT);
    });

    it('カタログはDAILY_MISSION_COUNT件以上ある（下回ると出題が薄くなる）', () => {
      expect(DAILY_MISSIONS.length).toBeGreaterThanOrEqual(DAILY_MISSION_COUNT);
    });
  });

  describe('findMission', () => {
    it('存在するidは定義を返し、存在しないidはundefinedを返す', () => {
      expect(findMission(DAILY_MISSIONS[0].id)).toEqual(DAILY_MISSIONS[0]);
      expect(findMission('no-such-mission')).toBeUndefined();
    });
  });
});
