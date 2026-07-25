/**
 * @file Google Gemini API との通信を担うサービス。
 * correct() でプロンプトを送信し、レスポンスから添削解説5項目(grammarNotes/naturalExpressions/
 * grammarTendency/cefrRationale/studyPlan)・添削後の英文(correctedText)・mistakes JSON・
 * 定量評価(WritingEvaluation)・復習カード・レベルアップ例文（LevelUpItem、構造化JSON）・
 * レベルアップ全文(levelUpText)を分離して返す。
 * 定量評価は AI の3観点スコア＋errorDensity を受け取り、総合スコア・CEFR は evaluation.util で算出して補完する。
 * API 呼び出しは generateContentStream() によるストリーミング受信で行い、受信途中の進捗率を
 * onProgress コールバックへ通知する（算出は stream-progress.util.ts）。解析自体は全文が揃ってから従来どおり行う。
 * モデル優先順位配列（AppSettings.modelPriority）を先頭から順に試し、失敗したら次のモデルへフォールバックする。
 * ただしセーフティフィルタによる入力ブロック（GeminiBlockedError、定義は gemini-blocked.error.ts）は
 * モデル起因でないため、フォールバックせず即座にエラーとしてユーザーへ返す。
 * 成功したモデルIDは CorrectionResult.model として返し、セッション詳細画面での表示に使われる。
 * 成功した呼び出しは GEMINI_LOGGER トークン（core/logging）経由で記録する。実装は開発ビルド時のみ
 * features/dev の DevLogService が provide され、本番ビルドでは no-op（core→features の逆依存を持たない）。
 * レスポンス解析は utils/gemini-parse.util.ts に集約する。構造化JSON（<mistakes>等）は extractTaggedJson、
 * 自由記述の英文（<corrected-text>/<levelup-text>）や解説5項目（<grammar-notes-ja>等）は extractTaggedText を
 * 使い、それぞれ独立データとして抽出する。1タグの抽出に失敗しても、そのフィールドが undefined になるだけで
 * 他のタグの抽出には影響しない（mistakes/evaluation/levelup/review と同じ独立失敗設計）。
 * corrected（添削解説・日本語, 後方互換フィールド）/ correctedEn（同・英語）は、上記5項目のうち
 * 抽出に成功したものだけを見出し付きで結合して合成する（buildLegacyProse 参照）。生JSON等の未抽出データが
 * 紛れ込むことはない（結合元は必ず extractTaggedText を通過済みのクリーンな文字列のみ）。
 */
import { Injectable, inject } from '@angular/core';
import { EnhancedGenerateContentResponse, GoogleGenerativeAI } from '@google/generative-ai';
import { LevelUpItem, Mistake, ReviewItem, WritingEvaluation } from '@core/models/session.model';
import { buildEvaluation } from '@core/gemini/evaluation.util';
import {
  extractTaggedJson,
  extractTaggedText,
  ParseFailureStage,
} from '@core/gemini/gemini-parse.util';
import { GEMINI_LOGGER } from '@core/logging/gemini-log.token';
import {
  computeProgress,
  getExpectedTotalChars,
  recordResponseLength,
} from '@core/gemini/stream-progress.util';
import { GeminiBlockedError } from '@core/gemini/gemini-blocked.error';

export interface CorrectionResult {
  /** 実際に成功したモデルID（modelPriorityフォールバック後の最終選択、例: 'gemini-3.5-flash'） */
  model: string;
  corrected: string;
  correctedEn?: string;
  correctedText?: string;
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
  mistakes: Mistake[];
  evaluation?: WritingEvaluation;
  reviewItems?: ReviewItem[];
  levelUpItems?: LevelUpItem[];
  levelUpText?: string;
}

// 解説5項目の定義。id は CorrectionResult のフィールド名接頭辞、tag はプロンプト側のタグ名接頭辞、
// heading は corrected（後方互換の結合プローズ）に付ける見出し。新しい解説項目を追加する場合は
// prompt.util.ts の SECTIONS 側にタグを追加したうえで、ここにも1エントリ足すだけでよい。
const PROSE_SECTIONS: { id: string; tag: string; heading: string }[] = [
  { id: 'grammarNotes', tag: 'grammar-notes', heading: '文法・語法のミスの指摘' },
  { id: 'naturalExpressions', tag: 'natural-expr', heading: '自然な表現の提案' },
  { id: 'grammarTendency', tag: 'grammar-tendency', heading: '文法のミスの傾向' },
  { id: 'cefrRationale', tag: 'cefr-rationale', heading: 'CEFR評価の根拠' },
  { id: 'studyPlan', tag: 'study-plan', heading: '今のレベルから伸ばすための学習法' },
];

@Injectable({ providedIn: 'root' })
export class GeminiService {
  private logger = inject(GEMINI_LOGGER);

  // ── API 呼び出し（modelPriority を先頭から順に試し、失敗したら次のモデルへフォールバック） ─
  // onProgress は受信途中の進捗率（0〜95）を随時通知する任意コールバック。
  // モデルをフォールバックすると進捗は巻き戻るため、単調増加の担保は呼び出し側の責務とする。
  async correct(
    apiKey: string,
    modelPriority: string[],
    prompt: string,
    userText: string,
    onProgress?: (percent: number) => void,
  ): Promise<CorrectionResult> {
    let lastError: unknown;
    for (const model of modelPriority) {
      try {
        return await this.callApi(apiKey, model, prompt, userText, onProgress);
      } catch (e) {
        // セーフティブロックは入力起因でありモデルを替えても解消しないため、
        // 残りのモデルへのフォールバックを中断して即座にユーザーへ伝える。
        if (e instanceof GeminiBlockedError) throw e;
        lastError = e;
      }
    }
    throw lastError;
  }

  private async callApi(
    apiKey: string,
    model: string,
    prompt: string,
    userText: string,
    onProgress?: (percent: number) => void,
  ): Promise<CorrectionResult> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({ model });

    const fullPrompt = prompt.replace('{USER_TEXT}', userText);
    // ストリーミングで受信するのは進捗表示のためだけで、解析は従来どおり全文が揃ってから行う。
    const result = await genModel.generateContentStream(fullPrompt);

    const expectedChars = getExpectedTotalChars();
    let text = '';
    let streamError: unknown;
    try {
      for await (const chunk of result.stream) {
        text += chunk.text();
        onProgress?.(computeProgress(text, expectedChars));
      }
    } catch (e) {
      // セーフティブロック時は chunk.text() が throw し得る。blockReason を確認するまで再送出を保留する。
      streamError = e;
    }

    // セーフティフィルタで入力がブロックされると text() が throw / 空文字を返し、
    // 原因不明の「APIエラー」として扱われてしまうため、先に blockReason を確認して
    // 明確な日本語メッセージの専用エラーに変換する。
    // ブロック時は result.response の Promise 自体が reject することもあるため、
    // 例外オブジェクトに載る promptFeedback も同様に確認する。
    let response: EnhancedGenerateContentResponse;
    try {
      response = await result.response;
    } catch (e) {
      const reason = (e as { response?: { promptFeedback?: { blockReason?: string } } })?.response
        ?.promptFeedback?.blockReason;
      if (reason) throw new GeminiBlockedError(String(reason));
      throw e;
    }
    const blockReason = response.promptFeedback?.blockReason;
    if (blockReason) throw new GeminiBlockedError(String(blockReason));
    if (streamError) throw streamError;

    recordResponseLength(text.length);

    const parseWarnings: string[] = [];
    const warn = (tag: string) => (stage: ParseFailureStage, detail: unknown) => {
      parseWarnings.push(`[${tag}/${stage}] ${String(detail)}`);
    };

    const mistakes = this.parseMistakes(text, warn('mistakes'));
    const evaluation = this.parseEvaluation(text, warn('evaluation'));
    const levelUpItems = this.parseLevelUp(text, warn('levelup'));
    const levelUpText = extractTaggedText(text, 'levelup-text', warn('levelup-text'));
    const correctedText = extractTaggedText(text, 'corrected-text', warn('corrected-text'));
    const reviewItems = this.parseReview(text, warn('review'));

    // 解説5項目はそれぞれ独立したタグから個別に抽出する。1項目のタグが欠けても
    // 他の項目・他のセクション（mistakes/evaluation/levelup/review）には影響しない。
    const prose: Record<string, string | undefined> = {};
    for (const section of PROSE_SECTIONS) {
      prose[section.id] = extractTaggedText(text, `${section.tag}-ja`, warn(`${section.tag}-ja`));
      prose[`${section.id}En`] = extractTaggedText(
        text,
        `${section.tag}-en`,
        warn(`${section.tag}-en`),
      );
    }

    // corrected/correctedEn（後方互換フィールド）は、抽出できた解説項目だけを見出し付きで結合して合成する。
    // 結合元は必ずタグ抽出済みのクリーンな文字列のみのため、生JSON等が紛れ込むことはない。
    const corrected = this.buildLegacyProse(
      PROSE_SECTIONS.map((s) => ({ heading: s.heading, text: prose[s.id] })),
    );
    const correctedEn = this.buildLegacyProse(
      PROSE_SECTIONS.map((s) => ({ heading: s.heading, text: prose[`${s.id}En`] })),
    );

    if (parseWarnings.length > 0) {
      console.warn('[GeminiService] レスポンス解析で問題が発生しました:', parseWarnings);
    }

    const correctionResult: CorrectionResult = {
      model,
      corrected,
      correctedEn: correctedEn || undefined,
      correctedText,
      grammarNotes: prose['grammarNotes'],
      grammarNotesEn: prose['grammarNotesEn'],
      naturalExpressions: prose['naturalExpressions'],
      naturalExpressionsEn: prose['naturalExpressionsEn'],
      grammarTendency: prose['grammarTendency'],
      grammarTendencyEn: prose['grammarTendencyEn'],
      cefrRationale: prose['cefrRationale'],
      cefrRationaleEn: prose['cefrRationaleEn'],
      studyPlan: prose['studyPlan'],
      studyPlanEn: prose['studyPlanEn'],
      mistakes,
      evaluation,
      reviewItems,
      levelUpItems,
      levelUpText,
    };

    this.logger.record({
      model,
      fullPrompt,
      userText,
      rawResponse: text,
      parsed: correctionResult,
      parseWarnings,
    });

    return correctionResult;
  }

  // ── 後方互換用: 解説5項目のうち抽出できたものだけを見出し付きで結合する ─
  // 過去データ互換の corrected/correctedEn、および search/stats など session-wide なテキスト参照用。
  // 新しいUI（practice/history）はこの結合結果ではなく、5項目それぞれのフィールドを個別に表示する。
  private buildLegacyProse(parts: { heading: string; text: string | undefined }[]): string {
    return parts
      .filter((p) => p.text)
      .map((p) => `【${p.heading}】\n${p.text}`)
      .join('\n\n');
  }

  // ── レスポンス解析: <mistakes>...</mistakes> タグから JSON を抽出（失敗時は空配列） ─
  private parseMistakes(
    text: string,
    onError: (stage: ParseFailureStage, detail: unknown) => void,
  ): Mistake[] {
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

  // ── レスポンス解析: <evaluation>...</evaluation> タグから定量評価を抽出（失敗時 undefined） ─
  // 採用条件は3観点スコア＋errorDensity（数値）が揃うこと。CEFR4項目はAIの実判定値を優先採用し、
  // 欠落/不正時は buildEvaluation() 側で scoreToCefr にフォールバックする。総合スコアは常にコード算出。
  private parseEvaluation(
    text: string,
    onError: (stage: ParseFailureStage, detail: unknown) => void,
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

  // ── レスポンス解析: <levelup>...</levelup> タグからレベルアップ例文を抽出 ─
  // 必須フィールドが揃った項目だけを採用する。keyPhrases は leveledUp 内に実在するかまでは検証せず
  // （Drill 側の穴埋めロジックが該当フレーズを見つけられない場合はそのフレーズをスキップして防御的に扱う）、
  // 型の妥当性のみチェックする。不正な項目は除外し、1件も残らなければ undefined を返す。
  private parseLevelUp(
    text: string,
    onError: (stage: ParseFailureStage, detail: unknown) => void,
  ): LevelUpItem[] | undefined {
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

  // ── レスポンス解析: <review>...</review> タグから復習カードを抽出 ─
  // 必須フィールドが揃い、choices が4要素かつ正解(answer)を含む項目だけを採用する。
  // 不正な項目は除外し、1件も残らなければ undefined を返す（保存・同期では undefined を持たせない）。
  // choiceExplanations/choiceExplanationsEn は任意フィールドのため、choices と要素数が一致しない場合のみ削除する。
  private parseReview(
    text: string,
    onError: (stage: ParseFailureStage, detail: unknown) => void,
  ): ReviewItem[] | undefined {
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
}
