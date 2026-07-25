import { CorrectionSession, WritingEvaluation } from '@core/models/session.model';
import {
  cefrToNumber,
  getCategoryTrends,
  getErrorDensityHistory,
  getEvaluationHistory,
  getRecurringMistakes,
  getSessionsWithReviewItems,
  getStudyStats,
  getUnmasteredMistakes,
} from './session-stats.util';
import { DrillProgress, Mistake } from '@core/models/session.model';

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
    grammarScore: 7,
    vocabularyScore: 6,
    contentScore: 7,
    overallScore: 6.5,
    errorDensity: 3,
    grammarCefr: 'B1',
    vocabularyCefr: 'B1',
    contentCefr: 'B1',
    overallCefr: 'B1',
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
      makeSession({
        mistakes: [{ category: '文法', original: 'a', corrected: 'b', explanation: '' }],
      }),
      makeSession({ mistakes: [] }),
      makeSession({
        mistakes: [
          { category: '語彙', original: 'c', corrected: 'd', explanation: '' },
          { category: '文法', original: 'e', corrected: 'f', explanation: '' },
        ],
      }),
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
      makeSession({
        id: '1',
        date: daysAgo(2),
        evaluation: makeEval({ grammarScore: 4, grammarCefr: 'A2' }),
      }),
      makeSession({ id: '2', date: daysAgo(1) }), // evaluation なし
      makeSession({
        id: '3',
        date: daysAgo(0),
        evaluation: makeEval({ grammarScore: 7, grammarCefr: 'B1' }),
      }),
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
    expect(result.map((s) => s.id)).toEqual(['1']);
  });

  it('直近15件に絞らず全期間を対象にする', () => {
    const reviewItem = { sentence: 'a', answer: 'b', hint: '', translation: '', choices: ['b'] };
    const sessions = Array.from({ length: 24 }, (_, i) =>
      makeSession({ id: String(i), reviewItems: [reviewItem] }),
    );
    expect(getSessionsWithReviewItems(sessions).length).toBe(24);
  });
});

// ── ミス傾向タブ向けの集計（改善/悪化トレンド・再発ミス・ミス密度推移・未克服ミス） ──

// n語の英文（ミス密度の分母を制御するため）
function words(n: number): string {
  return Array.from({ length: n }, () => 'word').join(' ');
}

function makeMistake(partial: Partial<Mistake> = {}): Mistake {
  return {
    category: partial.category ?? '文法',
    categoryKey: partial.categoryKey,
    original: partial.original ?? 'a mistake',
    corrected: partial.corrected ?? 'a correction',
    explanation: partial.explanation ?? '',
  };
}

describe('getCategoryTrends', () => {
  // 直近15件 + それ以前5件。直近は100語あたり1件、それ以前は100語あたり2件のミス密度になる。
  function makeTrendSessions(recentMistakes: number, pastMistakes: number): CorrectionSession[] {
    const recent = Array.from({ length: 15 }, (_, i) =>
      makeSession({
        id: `r${i}`,
        original: words(100),
        mistakes: Array.from({ length: recentMistakes }, () => makeMistake()),
      }),
    );
    const past = Array.from({ length: 5 }, (_, i) =>
      makeSession({
        id: `p${i}`,
        original: words(100),
        mistakes: Array.from({ length: pastMistakes }, () => makeMistake()),
      }),
    );
    return [...recent, ...past];
  }

  it('比較対象（16件目以降）が無ければ空配列を返す', () => {
    const sessions = Array.from({ length: 15 }, (_, i) =>
      makeSession({ id: `${i}`, original: words(100), mistakes: [makeMistake()] }),
    );
    expect(getCategoryTrends(sessions)).toEqual([]);
  });

  it('ミス密度が下がっていれば improved と判定する', () => {
    const [trend] = getCategoryTrends(makeTrendSessions(1, 2));
    expect(trend.category).toBe('文法');
    expect(trend.pastDensity).toBeCloseTo(2);
    expect(trend.recentDensity).toBeCloseTo(1);
    expect(trend.direction).toBe('improved');
  });

  it('ミス密度が上がっていれば worsened と判定する', () => {
    const [trend] = getCategoryTrends(makeTrendSessions(2, 1));
    expect(trend.direction).toBe('worsened');
  });

  it('変化がしきい値未満なら flat と判定する', () => {
    const [trend] = getCategoryTrends(makeTrendSessions(1, 1));
    expect(trend.delta).toBeCloseTo(0);
    expect(trend.direction).toBe('flat');
  });

  it('語数0のセッションだけでも例外を投げず密度0として扱う', () => {
    const sessions = Array.from({ length: 20 }, (_, i) =>
      makeSession({ id: `${i}`, original: '', mistakes: [makeMistake()] }),
    );
    const [trend] = getCategoryTrends(sessions);
    expect(trend.recentDensity).toBe(0);
    expect(trend.direction).toBe('flat');
  });

  it('英語表記の旧データも normalizeCategory で日本語カテゴリに統合される', () => {
    const sessions = Array.from({ length: 20 }, (_, i) =>
      makeSession({
        id: `${i}`,
        original: words(100),
        mistakes: [makeMistake({ category: i % 2 === 0 ? 'grammar' : '文法' })],
      }),
    );
    const trends = getCategoryTrends(sessions);
    expect(trends.length).toBe(1);
    expect(trends[0].category).toBe('文法');
  });
});

describe('getRecurringMistakes', () => {
  it('2つ以上の異なる日付に登場したミスだけを返す', () => {
    const sessions = [
      makeSession({
        id: '1',
        date: daysAgo(0),
        mistakes: [makeMistake({ original: 'go to home' })],
      }),
      makeSession({
        id: '2',
        date: daysAgo(10),
        mistakes: [makeMistake({ original: 'Go To Home' })], // 大文字違いは同一ミス扱い
      }),
      makeSession({ id: '3', date: daysAgo(3), mistakes: [makeMistake({ original: 'a apple' })] }),
    ];
    const result = getRecurringMistakes(sessions);
    expect(result.length).toBe(1);
    expect(result[0].dayCount).toBe(2);
    expect(result[0].firstDate).toBe(sessions[1].date);
    expect(result[0].lastDate).toBe(sessions[0].date);
  });

  it('同じ日に繰り返しただけのミスは再発とみなさない', () => {
    const date = daysAgo(1);
    const sessions = [
      makeSession({ id: '1', date, mistakes: [makeMistake({ original: 'a apple' })] }),
      makeSession({ id: '2', date, mistakes: [makeMistake({ original: 'a apple' })] }),
    ];
    expect(getRecurringMistakes(sessions)).toEqual([]);
  });
});

describe('getErrorDensityHistory', () => {
  it('評価付きセッションの errorDensity を日付昇順で返す', () => {
    const sessions = [
      makeSession({ id: '1', date: daysAgo(0), evaluation: makeEval({ errorDensity: 2 }) }),
      makeSession({ id: '2', date: daysAgo(5), evaluation: makeEval({ errorDensity: 6 }) }),
      makeSession({ id: '3', date: daysAgo(2) }), // 評価なしは除外
    ];
    expect(getErrorDensityHistory(sessions).map((h) => h.density)).toEqual([6, 2]);
  });
});

describe('getUnmasteredMistakes', () => {
  const sessions = [
    makeSession({
      id: '1',
      mistakes: [
        makeMistake({ original: 'untouched one' }),
        makeMistake({ original: 'unmastered one' }),
        makeMistake({ original: 'learning one' }),
        makeMistake({ original: 'mastered one' }),
      ],
    }),
  ];
  const progress: Record<string, DrillProgress> = {
    'unmastered one': { correctStreak: 0, everCorrect: false, lastAttemptAt: daysAgo(1) },
    'learning one': { correctStreak: 1, everCorrect: true, lastAttemptAt: daysAgo(1) },
    'mastered one': { correctStreak: 3, everCorrect: true, lastAttemptAt: daysAgo(1) },
  };
  const progressOf = (key: string): DrillProgress | undefined => progress[key];

  it('習熟済みを除外し、未克服→未着手→定着途中の順に並べる', () => {
    const result = getUnmasteredMistakes(sessions, progressOf, 3);
    expect(result.map((m) => m.original)).toEqual([
      'unmastered one',
      'untouched one',
      'learning one',
    ]);
    expect(result.map((m) => m.state)).toEqual(['unmastered', 'untouched', 'learning']);
  });

  it('進捗が全く無ければすべて未着手として返す', () => {
    const result = getUnmasteredMistakes(sessions, () => undefined, 3);
    expect(result.length).toBe(4);
    expect(result.every((m) => m.state === 'untouched')).toBe(true);
  });
});
