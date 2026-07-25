import { DrillProgressService, DRILL_MASTERY_STREAK } from './drill-progress.service';

describe('DrillProgressService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('未着手の問題はgetDrillProgressでundefinedを返す', () => {
    const service = new DrillProgressService();
    expect(service.getDrillProgress('never asked')).toBeUndefined();
  });

  it('正解を重ねると連続正解数が増え、DRILL_MASTERY_STREAKに到達する', () => {
    const service = new DrillProgressService();
    for (let i = 0; i < DRILL_MASTERY_STREAK; i++) {
      service.recordDrillResult('key-a', true);
    }
    expect(service.getDrillProgress('key-a')?.correctStreak).toBe(DRILL_MASTERY_STREAK);
  });

  it('不正解で連続正解数が0にリセットされる', () => {
    const service = new DrillProgressService();
    service.recordDrillResult('key-b', true);
    service.recordDrillResult('key-b', true);
    service.recordDrillResult('key-b', false);
    expect(service.getDrillProgress('key-b')?.correctStreak).toBe(0);
  });

  it('everCorrectは1回でも正解したらtrueになり、以後不正解が続いてもtrueのまま残る', () => {
    const service = new DrillProgressService();
    service.recordDrillResult('key-d', true);
    expect(service.getDrillProgress('key-d')?.everCorrect).toBe(true);

    service.recordDrillResult('key-d', false);
    service.recordDrillResult('key-d', false);
    expect(service.getDrillProgress('key-d')?.everCorrect).toBe(true);
  });

  it('一度も正解していなければeverCorrectはfalse', () => {
    const service = new DrillProgressService();
    service.recordDrillResult('key-e', false);
    expect(service.getDrillProgress('key-e')?.everCorrect).toBe(false);
  });

  it('キーは正規化されて同一問題として扱われる（大文字小文字・前後空白の違いを無視）', () => {
    const service = new DrillProgressService();
    service.recordDrillResult('  Key-C  ', true);
    expect(service.getDrillProgress('key-c')).toBeDefined();
  });

  it('recordDrillResultの結果はlocalStorageに永続化され、再構築後も復元される', () => {
    const writer = new DrillProgressService();
    writer.recordDrillResult('persisted-key', true);

    const reader = new DrillProgressService();
    expect(reader.getDrillProgress('persisted-key')?.correctStreak).toBe(1);
  });

  it('レベルアップ進捗: 未着手セッションは空オブジェクトを返す', () => {
    const service = new DrillProgressService();
    expect(service.getLevelUpProgress('session-1')).toEqual({});
  });

  it('setLevelUpItemProgressで進捗を記録し、getLevelUpProgressで取得できる', () => {
    const service = new DrillProgressService();
    service.setLevelUpItemProgress('session-1', 'item-1', 2, true);

    expect(service.getLevelUpProgress('session-1')).toEqual({
      'item-1': { maskLevel: 2, completed: true },
    });
  });

  it('persist()は渡した内容でallDrillProgress/allLevelUpProgressを完全に置き換える', () => {
    const service = new DrillProgressService();
    service.recordDrillResult('old-key', true);

    service.persist(
      { 'new-key': { correctStreak: 5, lastAttemptAt: new Date().toISOString() } },
      { 'session-x': { 'item-x': { maskLevel: 1, completed: false } } },
      { 'cloze-x': 2 },
    );

    expect(service.allDrillProgress()).toEqual({
      'new-key': { correctStreak: 5, lastAttemptAt: expect.any(String) },
    });
    expect(service.allLevelUpProgress()).toEqual({
      'session-x': { 'item-x': { maskLevel: 1, completed: false } },
    });
  });
});
