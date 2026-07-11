/**
 * @file 添削解説5項目（grammarNotes/naturalExpressions/grammarTendency/cefrRationale/studyPlan）の
 * 定義一覧。gemini.service.ts の PROSE_SECTIONS と対になるUI側の定義で、フィールド名（ja/en）と
 * 見出し用の翻訳キーを1箇所にまとめる。practice/history 両ページがこれを共有し、表示順・見出し文言の
 * 重複定義を避ける。新しい解説項目を追加する場合は、prompt.util.ts・gemini.service.ts に加えて
 * ここにも1エントリ足すこと。
 */
import { TranslationKey } from './translations';

export interface ProseSource {
  grammarNotes?: string;
  grammarNotesEn?: string;
  naturalExpressions?: string;
  naturalExpressionsEn?: string;
  grammarTendency?: string;
  grammarTendencyEn?: string;
  cefrRationale?: string;
  cefrRationaleEn?: string;
  studyPlan?: string;
  studyPlanEn?: string;
}

export const PROSE_FIELDS: { ja: keyof ProseSource; en: keyof ProseSource; headingKey: TranslationKey }[] = [
  { ja: 'grammarNotes', en: 'grammarNotesEn', headingKey: 'practice.grammarNotes' },
  { ja: 'naturalExpressions', en: 'naturalExpressionsEn', headingKey: 'practice.naturalExpressions' },
  { ja: 'grammarTendency', en: 'grammarTendencyEn', headingKey: 'practice.grammarTendency' },
  { ja: 'cefrRationale', en: 'cefrRationaleEn', headingKey: 'practice.cefrRationale' },
  { ja: 'studyPlan', en: 'studyPlanEn', headingKey: 'practice.studyPlan' },
];
