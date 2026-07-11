/**
 * @file CorrectionSession / Mistake / ReviewItem / LevelUpItem が持つ「日本語テキスト」フィールドを、
 * 表示言語（Lang）に応じて英語版（*En サフィックス）へ切り替える純粋関数群。
 * 英語版フィールドは optional（旧データ・生成失敗時は undefined）なので、
 * lang==='en' でも英語版が無ければ必ず日本語にフォールバックする
 * （＝既存の日本語のみセッションは英語表示中もそのまま日本語で表示される）。
 * categoryKey は UI ラベルの翻訳キーに使うため、無ければ生の category 文字列へフォールバックする。
 */
import { LevelUpItem, Mistake, ReviewItem } from '@core/models/session.model';
import { Lang } from './lang.model';
import { I18nService } from './i18n.service';
import { TRANSLATIONS, TranslationKey } from './translations';

// CorrectionSession（保存済みセッション）・CorrectionResult（添削直後の結果）どちらも
// corrected/correctedEn の形を共有するため、構造的部分型で受ける。
// corrected は grammarNotes 等5項目を結合した後方互換フィールド（新データも旧データも必ず持つ）。
export function localizedProse(source: { corrected: string; correctedEn?: string }, lang: Lang): string {
  return lang === 'en' && source.correctedEn ? source.correctedEn : source.corrected;
}

// 解説5項目（grammarNotes/naturalExpressions/grammarTendency/cefrRationale/studyPlan）のような
// 「ja本体 + en任意」ペアを表示言語に応じて切り替える汎用ヘルパー。ja が無ければ（そのタグの抽出に
// 失敗していれば）undefined を返し、呼び出し側でそのブロックごと非表示にできる。
export function localizedField(ja: string | undefined, en: string | undefined, lang: Lang): string | undefined {
  if (!ja) return undefined;
  return lang === 'en' && en ? en : ja;
}

export function localizedExplanation(mistake: Mistake, lang: Lang): string {
  return lang === 'en' && mistake.explanationEn ? mistake.explanationEn : mistake.explanation;
}

export function localizedHint(item: ReviewItem, lang: Lang): string {
  return lang === 'en' && item.hintEn ? item.hintEn : item.hint;
}

export function localizedTranslation(item: ReviewItem | LevelUpItem, lang: Lang): string {
  return lang === 'en' && item.translationEn ? item.translationEn : item.translation;
}

// カテゴリ名の表示用ラベル。categoryKey があれば翻訳辞書（mistake.category.*）を引き、
// 無ければ旧データの生の日本語 category 文字列をそのまま表示する。
export function localizedCategory(mistake: Mistake, i18n: I18nService): string {
  const key = `mistake.category.${mistake.categoryKey}` as TranslationKey;
  if (mistake.categoryKey && key in TRANSLATIONS.ja) {
    return i18n.t(key);
  }
  return mistake.category;
}

// session-stats.util.ts の normalizeCategory() は表記ゆれを固定の日本語カテゴリ
// （文法/語彙/スペリング/コロケーション/語法/構文/語順）へ正規化して集計する。
// その正規化済み日本語文字列から翻訳キーへの逆引き（ミス傾向ページのカテゴリ別集計表示に使う）。
const NORMALIZED_JA_TO_KEY: Record<string, TranslationKey> = {
  '文法': 'mistake.category.grammar',
  '語彙': 'mistake.category.vocabulary',
  'スペリング': 'mistake.category.spelling',
  'コロケーション': 'mistake.category.collocation',
  '語法': 'mistake.category.usage',
  '構文': 'mistake.category.syntax',
  '語順': 'mistake.category.word-order',
};

export function localizedNormalizedCategory(categoryJa: string, i18n: I18nService): string {
  const key = NORMALIZED_JA_TO_KEY[categoryJa];
  return key ? i18n.t(key) : categoryJa;
}
