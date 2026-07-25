/**
 * @file UI 文言の日英翻訳辞書のエントリポイント。セクションごとに分割された各ファイル
 * （common/practice/quiz/mistake-categories/history/mistakes/drill/achievements/settings）の
 * ja/en を統合し、`TRANSLATIONS` と `TranslationKey` を構成する。ja を正典としてキー集合を定義し、
 * en には同じキー集合を TypeScript の型チェックで強制する（en 側のキー欠落はコンパイルエラーになる）。
 * キーはドット区切りの平坦なフラット構造（例: 'nav.practice'）。I18nService.t() から参照する。
 * `{name}` 形式のプレースホルダは I18nService.t() が置換する。
 */
import { Lang } from '../lang.model';
import { achievements } from './achievements';
import { common } from './common';
import { drill } from './drill';
import { history } from './history';
import { mistakeCategories } from './mistake-categories';
import { mistakes } from './mistakes';
import { practice } from './practice';
import { quiz } from './quiz';
import { settings } from './settings';

// ── merge ──
const ja = {
  ...common.ja,
  ...practice.ja,
  ...quiz.ja,
  ...mistakeCategories.ja,
  ...history.ja,
  ...mistakes.ja,
  ...drill.ja,
  ...achievements.ja,
  ...settings.ja,
} as const;

type TranslationKey = keyof typeof ja;

const en: Record<TranslationKey, string> = {
  ...common.en,
  ...practice.en,
  ...quiz.en,
  ...mistakeCategories.en,
  ...history.en,
  ...mistakes.en,
  ...drill.en,
  ...achievements.en,
  ...settings.en,
};

export const TRANSLATIONS: Record<Lang, Record<TranslationKey, string>> = { ja, en };
export type { TranslationKey };
