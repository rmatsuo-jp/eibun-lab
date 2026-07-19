/**
 * @file 翻訳辞書 - quiz（drill・waiting-quiz 共用）セクション。
 * ja/en を同一キーごとにペアで定義し、`./index.ts` でマージされ TRANSLATIONS を構成する。
 */

// ── quiz（drill・waiting-quiz 共用） ──
export const quiz = {
  ja: {
    'quiz.cloze.badge': '穴埋め',
    'quiz.waiting.duringLoading': '添削中に復習しましょう',
    'quiz.waiting.sampleNote':
      'サンプル問題です。添削を行うとご自身の弱点に基づいた問題が出題されます。',
    'quiz.waiting.correct': '正解！',
    'quiz.waiting.wrong': '不正解 — 正解: {answer}',
    'quiz.waiting.next': '次の問題',
  },
  en: {
    'quiz.cloze.badge': 'Cloze',
    'quiz.waiting.duringLoading': 'Review while your writing is corrected',
    'quiz.waiting.sampleNote':
      'This is a sample question. Once you submit a correction, questions will be based on your own weak points.',
    'quiz.waiting.correct': 'Correct!',
    'quiz.waiting.wrong': 'Incorrect — answer: {answer}',
    'quiz.waiting.next': 'Next question',
  },
} as const;
