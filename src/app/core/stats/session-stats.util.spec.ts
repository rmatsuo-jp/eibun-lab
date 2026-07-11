import { CorrectionSession, WritingEvaluation } from '@core/models/session.model';
import { cefrToNumber, getEvaluationHistory, getSessionsWithReviewItems, getStudyStats } from './session-stats.util';

// テスト用セッション生成ヘルパ
function makeSession(partial: Partial<CorrectionSession>): CorrectionSession {
  return {
    id: partial.id ?? Math.random().toString(),
    date: partial.date ?? new Date().toISOString(),
    original: partial.original ?? '',
    corrected: partial.corrected ?? '',
    mistakes: partial.mistakes ?? [],
    evaluation: partial.evaluation,
    reviewItems: partial.reviewItems,
  };
}

// テスト用 WritingEvaluation 生成ヘルパ（overall系を基準に最小指定）
function makeEval(overrides: Partial<WritingEvaluation> = {}): WritingEvaluation {
  return {
    grammarScore: 7, vocabularyScore: 6, contentScore: 7, overallScore: 6.5, errorDensity: 3,
    grammarCefr: 'B1', vocabularyCefr: 'B1', contentCefr: 'B1', overallCefr: 'B1',
    ...overrides,
  };
}

// n 日前の ISO 文字列
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

describe('cefrToNumber', () => {
  it('CEFR レベルを 1〜6 に変換する', () => {
    expect(cefrToNumber('A1')).toBe(1);
    expect(cefrToNumber('b1')).toBe(3);
    expect(cefrToNumber('C2')).toBe(6);
  });

  it('未知の値は 0 を返す', () => {
    expect(cefrToNumber('X9')).toBe(0);
    expect(cefrToNumber('')).toBe(0);
  });
});

describe('getStudyStats', () => {
  it('セッションが無いときはゼロ値を返す', () => {
    const s = getStudyStats([]);
    expect(s.totalSessions).toBe(0);
    expect(s.totalMistakes).toBe(0);
    expect(s.avgMistakes).toBe(0);
    expect(s.currentStreak).toBe(0);
  });

  it('総数・平均ミス数を集計する', () => {
    const sessions = [
      makeSession({ mistakes: [{ category: '文法', original: 'a', corrected: 'b', explanation: '' }] }),
      makeSession({ mistakes: [] }),
      makeSession({ mistakes: [{ category: '語彙', original: 'c', corrected: 'd', explanation: '' }, { category: '文法', original: 'e', corrected: 'f', explanation: '' }] }),
    ];
    const s = getStudyStats(sessions);
    expect(s.totalSessions).toBe(3);
    expect(s.totalMistakes).toBe(3);
    expect(s.avgMistakes).toBe(1); // 3 / 3
  });

  it('今日・昨日・一昨日の連続学習で streak=3 になる', () => {
    const sessions = [
      makeSession({ id: '1', date: daysAgo(0) }),
      makeSession({ id: '2', date: daysAgo(1) }),
      makeSession({ id: '3', date: daysAgo(2) }),
    ];
    expect(getStudyStats(sessions).currentStreak).toBe(3);
  });

  it('間が空くと streak は途切れる', () => {
    const sessions = [
      makeSession({ id: '1', date: daysAgo(0) }),
      makeSession({ id: '2', date: daysAgo(3) }),
    ];
    expect(getStudyStats(sessions).currentStreak).toBe(1);
  });
});

describe('getEvaluationHistory', () => {
  it('evaluation を持つセッションのみ日付昇順で返す', () => {
    const sessions = [
      makeSession({ id: '1', date: daysAgo(2), evaluation: makeEval({ grammarScore: 4, grammarCefr: 'A2' }) }),
      makeSession({ id: '2', date: daysAgo(1) }), // evaluation なし
      makeSession({ id: '3', date: daysAgo(0), evaluation: makeEval({ grammarScore: 7, grammarCefr: 'B1' }) }),
    ];
    const hist = getEvaluationHistory(sessions);
    expect(hist.length).toBe(2);
    expect(hist[0].evaluation.grammarScore).toBe(4); // 古い方が先頭
    expect(hist[1].evaluation.grammarScore).toBe(7);
  });
});

describe('getSessionsWithReviewItems', () => {
  it('reviewItems を持つセッションのみ返す', () => {
    const reviewItem = { sentence: 'a', answer: 'b', hint: '', translation: '', choices: ['b'] };
    const sessions = [
      makeSession({ id: '1', reviewItems: [reviewItem] }),
      makeSession({ id: '2', reviewItems: [] }),
      makeSession({ id: '3' }), // reviewItems なし
    ];
    const result = getSessionsWithReviewItems(sessions);
    expect(result.map(s => s.id)).toEqual(['1']);
  });
});
