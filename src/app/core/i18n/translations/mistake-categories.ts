/**
 * @file 翻訳辞書 - mistake categories（ミスカテゴリラベル）セクション。
 * ja/en を同一キーごとにペアで定義し、`./index.ts` でマージされ TRANSLATIONS を構成する。
 */

// ── mistake categories ──
export const mistakeCategories = {
  ja: {
    'mistake.category.grammar': '文法',
    'mistake.category.vocabulary': '語彙',
    'mistake.category.spelling': 'スペリング',
    'mistake.category.collocation': 'コロケーション',
    'mistake.category.usage': '語法',
    'mistake.category.syntax': '構文',
    'mistake.category.word-order': '語順',
  },
  en: {
    'mistake.category.grammar': 'Grammar',
    'mistake.category.vocabulary': 'Vocabulary',
    'mistake.category.spelling': 'Spelling',
    'mistake.category.collocation': 'Collocation',
    'mistake.category.usage': 'Usage',
    'mistake.category.syntax': 'Syntax',
    'mistake.category.word-order': 'Word Order',
  },
} as const;
