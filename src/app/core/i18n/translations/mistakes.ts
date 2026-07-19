/**
 * @file 翻訳辞書 - mistakes（ミス傾向）セクション。
 * ja/en を同一キーごとにペアで定義し、`./index.ts` でマージされ TRANSLATIONS を構成する。
 */

// ── mistakes（ミス傾向） ──
export const mistakes = {
  ja: {
    'mistakes.title': 'ミス傾向',
    'mistakes.empty1': 'まだデータがありません。',
    'mistakes.empty2': '添削を重ねるとミスのパターンが分析されます。',
    'mistakes.streak': '連続学習日数',
    'mistakes.totalSessions': '総添削数',
    'mistakes.totalMistakes': '総ミス数',
    'mistakes.avgMistakes': '平均ミス/回',
    'mistakes.last7Days': '直近7日',
    'mistakes.scoreTrend': 'スコア推移（10点満点）',
    'mistakes.cefrTrend': 'CEFRレベル推移',
    'mistakes.chartNote': '推移を表示するには、評価付きの添削が2回以上必要です。',
    'mistakes.categoryCount': 'カテゴリ別ミス件数',
    'mistakes.frequent': 'よく間違える表現',
    'mistakes.repeatCount': '{count}回',
  },
  en: {
    'mistakes.title': 'Mistake Trends',
    'mistakes.empty1': 'No data yet.',
    'mistakes.empty2': 'Mistake patterns will be analyzed as you correct more writing.',
    'mistakes.streak': 'Study streak (days)',
    'mistakes.totalSessions': 'Total corrections',
    'mistakes.totalMistakes': 'Total mistakes',
    'mistakes.avgMistakes': 'Avg mistakes/session',
    'mistakes.last7Days': 'Last 7 days',
    'mistakes.scoreTrend': 'Score Trend (out of 10)',
    'mistakes.cefrTrend': 'CEFR Level Trend',
    'mistakes.chartNote': 'At least 2 evaluated corrections are needed to show a trend.',
    'mistakes.categoryCount': 'Mistakes by Category',
    'mistakes.frequent': 'Frequently Mistaken Expressions',
    'mistakes.repeatCount': '{count} times',
  },
} as const;
