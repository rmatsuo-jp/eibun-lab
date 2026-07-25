/**
 * @file Gemini レスポンスの各セクションを「何が有効なデータか」まで検証して取り出す純粋関数群。
 * タグ単位の抽出プリミティブ（gemini-parse.util.ts）の一段上のレイヤーで、mistakes / evaluation /
 * levelup / review それぞれのスキーマ検証と、後方互換の結合プローズ生成（buildLegacyProse）を担う。
 * GeminiService からは通信・モデルフォールバック以外のこの解析責務を分離してある。
 * すべて副作用なしの関数のため spec から直接検証できる。
 * 1セクションの検証に失敗しても undefined（mistakes は空配列）を返すだけで、他セクションには影響しない。
 */
import { LevelUpItem, Mistake, ReviewItem, WritingEvaluation } from '@core/models/session.model';
import { buildEvaluation } from '@core/gemini/evaluation.util';
import { extractTaggedJson, ParseFailureStage } from '@core/gemini/gemini-parse.util';

/** 各セクションの解析失敗をまとめて通知するコールバック。 */
export type ParseErrorReporter = (stage: ParseFailureStage, detail: unknown) => void;

// ── 解説5項目の定義 ────────────────────────────────────────────────
// id は CorrectionResult のフィールド名接頭辞、tag はプロンプト側のタグ名接頭辞、
// heading は corrected（後方互換の結合プローズ）に付ける見出し。新しい解説項目を追加する場合は
// prompt.util.ts の SECTIONS 側にタグを追加したうえで、ここにも1エントリ足すだけでよい。
// heading は過去に保存済みの corrected 文字列にも埋め込まれているため、既存項目の文言は変更しない。
export const PROSE_SECTIONS: { id: string; tag: string; heading: string }[] = [
  { id: 'grammarNotes', tag: 'grammar-notes', heading: '文法・語法のミスの指摘' },
  { id: 'naturalExpressions', tag: 'natural-expr', heading: '自然な表現の提案' },
  { id: 'grammarTendency', tag: 'grammar-tendency', heading: '文法のミスの傾向' },
  { id: 'cefrRationale', tag: 'cefr-rationale', heading: 'CEFR評価の根拠' },
  { id: 'studyPlan', tag: 'study-plan', heading: '今のレベルから伸ばすための学習法' },
];

// ── 後方互換用: 解説5項目のうち抽出できたものだけを見出し付きで結合する ─
// 過去データ互換の corrected/correctedEn、および search/stats など session-wide なテキスト参照用。
// 新しいUI（practice/history）はこの結合結果ではなく、5項目それぞれのフィールドを個別に表示する。
export function buildLegacyProse(parts: { heading: string; text: string | undefined }[]): string {
  return parts
    .filter((p) => p.text)
    .map((p) => `【${p.heading}】\n${p.text}`)
    .join('\n\n');
}

// ── <mistakes>...</mistakes> タグから JSON を抽出（失敗時は空配列） ─
export function parseMistakes(text: string, onError: ParseErrorReporter): Mistake[] {
  return (
    extractTaggedJson<Mistake[]>(
      text,
      'mistakes',
      (json) => {
        const obj = json as { mistakes?: unknown };
        return Array.isArray(obj.mistakes) ? (obj.mistakes as Mistake[]) : undefined;
      },
      onError,
    ) ?? []
  );
}

// ── <evaluation>...</evaluation> タグから定量評価を抽出（失敗時 undefined） ─
// 採用条件は3観点スコア＋errorDensity（数値）が揃うこと。CEFR4項目はAIの実判定値を優先採用し、
// 欠落/不正時は buildEvaluation() 側で scoreToCefr にフォールバックする。総合スコアは常にコード算出。
export function parseEvaluation(
  text: string,
  onError: ParseErrorReporter,
): WritingEvaluation | undefined {
  return extractTaggedJson<WritingEvaluation>(
    text,
    'evaluation',
    (json) => {
      const obj = json as Partial<WritingEvaluation>;
      const num = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);
      const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
      if (
        num(obj.grammarScore) &&
        num(obj.vocabularyScore) &&
        num(obj.contentScore) &&
        num(obj.errorDensity)
      ) {
        return buildEvaluation({
          grammarScore: obj.grammarScore,
          vocabularyScore: obj.vocabularyScore,
          contentScore: obj.contentScore,
          errorDensity: obj.errorDensity,
          grammarCefr: str(obj.grammarCefr) ? obj.grammarCefr : undefined,
          vocabularyCefr: str(obj.vocabularyCefr) ? obj.vocabularyCefr : undefined,
          contentCefr: str(obj.contentCefr) ? obj.contentCefr : undefined,
          overallCefr: str(obj.overallCefr) ? obj.overallCefr : undefined,
        });
      }
      return undefined;
    },
    onError,
  );
}

// ── <levelup>...</levelup> タグからレベルアップ例文を抽出 ─
// 必須フィールドが揃った項目だけを採用する。keyPhrases は leveledUp 内に実在するかまでは検証せず
// （Drill 側の穴埋めロジックが該当フレーズを見つけられない場合はそのフレーズをスキップして防御的に扱う）、
// 型の妥当性のみチェックする。不正な項目は除外し、1件も残らなければ undefined を返す。
export function parseLevelUp(text: string, onError: ParseErrorReporter): LevelUpItem[] | undefined {
  return extractTaggedJson<LevelUpItem[]>(
    text,
    'levelup',
    (json) => {
      const obj = json as { levelUpItems?: unknown };
      if (!Array.isArray(obj.levelUpItems)) return undefined;
      const valid = (obj.levelUpItems as LevelUpItem[]).filter(
        (item) =>
          item &&
          typeof item.original === 'string' &&
          typeof item.leveledUp === 'string' &&
          typeof item.translation === 'string' &&
          Array.isArray(item.keyPhrases) &&
          item.keyPhrases.every((p) => typeof p === 'string' && p.length > 0),
      );
      return valid.length > 0 ? valid : undefined;
    },
    onError,
  );
}

// ── <review>...</review> タグから復習カードを抽出 ─
// 必須フィールドが揃い、choices が4要素かつ正解(answer)を含む項目だけを採用する。
// 不正な項目は除外し、1件も残らなければ undefined を返す（保存・同期では undefined を持たせない）。
// choiceExplanations/choiceExplanationsEn は任意フィールドのため、choices と要素数が一致しない場合のみ削除する。
export function parseReview(text: string, onError: ParseErrorReporter): ReviewItem[] | undefined {
  return extractTaggedJson<ReviewItem[]>(
    text,
    'review',
    (json) => {
      const obj = json as { reviewItems?: unknown };
      if (!Array.isArray(obj.reviewItems)) return undefined;
      const valid = (obj.reviewItems as ReviewItem[]).filter(
        (r) =>
          r &&
          typeof r.sentence === 'string' &&
          typeof r.answer === 'string' &&
          typeof r.hint === 'string' &&
          typeof r.translation === 'string' &&
          Array.isArray(r.choices) &&
          r.choices.length === 4 &&
          r.choices.includes(r.answer),
      );
      // choiceExplanations/choiceExplanationsEn は任意。choices と要素数が一致しない場合のみ取り除く
      // （理由が生成されないだけで、他のフィールドが有効ならカード自体は採用する）。
      for (const r of valid) {
        if (
          !Array.isArray(r.choiceExplanations) ||
          r.choiceExplanations.length !== r.choices.length
        ) {
          delete r.choiceExplanations;
        }
        if (
          !Array.isArray(r.choiceExplanationsEn) ||
          r.choiceExplanationsEn.length !== r.choices.length
        ) {
          delete r.choiceExplanationsEn;
        }
      }
      return valid.length > 0 ? valid : undefined;
    },
    onError,
  );
}
