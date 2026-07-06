import { scoreToCefr, computeOverallScore, buildEvaluation } from './evaluation.util';

describe('scoreToCefr', () => {
  it('各帯域の境界値を正しいCEFRに対応させる', () => {
    expect(scoreToCefr(10)).toBe('C2');
    expect(scoreToCefr(9.0)).toBe('C2');
    expect(scoreToCefr(8.5)).toBe('C1');
    expect(scoreToCefr(8.0)).toBe('C1');
    expect(scoreToCefr(6.5)).toBe('B2');
    expect(scoreToCefr(5.0)).toBe('B1');
    expect(scoreToCefr(3.5)).toBe('A2');
    expect(scoreToCefr(3.0)).toBe('A1');
    expect(scoreToCefr(0)).toBe('A1');
  });
});

describe('computeOverallScore', () => {
  it('3観点平均を0.5刻みに丸める', () => {
    expect(computeOverallScore(7, 6, 7)).toBe(6.5); // 平均6.67→6.5
    expect(computeOverallScore(8, 8, 8)).toBe(8);
    expect(computeOverallScore(7.5, 6, 7)).toBe(7); // 平均6.83→7.0
  });

  it('0〜10にクランプする', () => {
    expect(computeOverallScore(10, 10, 10)).toBe(10);
    expect(computeOverallScore(0, 0, 0)).toBe(0);
  });
});

describe('buildEvaluation', () => {
  it('総合スコアは常にコード算出し、CEFRはAI値があれば優先採用する', () => {
    const ev = buildEvaluation({
      grammarScore: 7.5, vocabularyScore: 6.0, contentScore: 7.0, errorDensity: 3.5,
      grammarCefr: 'B1', vocabularyCefr: 'A2', contentCefr: 'B1', overallCefr: 'B1',
    });
    expect(ev.overallScore).toBe(7); // 平均6.83→7.0（コード算出）
    // AI値をそのまま採用（scoreToCefr の換算 B2 などにはしない）
    expect(ev.grammarCefr).toBe('B1');
    expect(ev.vocabularyCefr).toBe('A2');
    expect(ev.contentCefr).toBe('B1');
    expect(ev.overallCefr).toBe('B1');
    expect(ev.errorDensity).toBe(3.5);
  });

  it('CEFRが欠落した場合はスコアからフォールバック算出する', () => {
    const ev = buildEvaluation({ grammarScore: 7.5, vocabularyScore: 6.0, contentScore: 7.0, errorDensity: 3.5 });
    expect(ev.grammarCefr).toBe('B2');   // 7.5→B2
    expect(ev.vocabularyCefr).toBe('B1'); // 6.0→B1
    expect(ev.contentCefr).toBe('B2');   // 7.0→B2
    expect(ev.overallCefr).toBe('B2');   // overall 7.0→B2
  });
});
