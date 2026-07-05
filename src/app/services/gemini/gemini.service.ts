/**
 * @file Google Gemini API との通信を担うサービス。
 * correct() でプロンプトを送信し、レスポンスから添削文・mistakes JSON・定量評価(WritingEvaluation)・
 * 復習カード・レベルアップ例文（LevelUpItem、構造化JSON）を分離して返す。
 * 定量評価は AI の3観点スコア＋errorDensity を受け取り、総合スコア・CEFR は evaluation.util で算出して補完する。
 * モデル優先順位配列（AppSettings.modelPriority）を先頭から順に試し、失敗したら次のモデルへフォールバックする。
 * 成功した呼び出しは DevLogService に生プロンプト・生レスポンス・解析警告を記録し、開発タブ（pages/dev）で確認できるようにする。
 * レスポンス解析（<mistakes>等のタグ抽出＋JSON検証）は utils/gemini-parse.util.ts の extractTaggedJson に集約し、
 * 各 parseX メソッドはタグ名とスキーマ検証関数を渡すだけの薄い呼び出しにする。
 */
import { Injectable, inject } from '@angular/core';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LevelUpItem, Mistake, ReviewItem, WritingEvaluation } from '../../models/session.model';
import { buildEvaluation } from '../../utils/evaluation.util';
import { extractTaggedJson, ParseFailureStage } from '../../utils/gemini-parse.util';
import { DevLogService } from './dev-log.service';

export interface CorrectionResult {
  corrected: string;
  mistakes: Mistake[];
  evaluation?: WritingEvaluation;
  reviewItems?: ReviewItem[];
  levelUpItems?: LevelUpItem[];
}

@Injectable({ providedIn: 'root' })
export class GeminiService {
  private devLog = inject(DevLogService);

  // ── API 呼び出し（modelPriority を先頭から順に試し、失敗したら次のモデルへフォールバック） ─
  async correct(
    apiKey: string,
    modelPriority: string[],
    prompt: string,
    userText: string
  ): Promise<CorrectionResult> {
    let lastError: unknown;
    for (const model of modelPriority) {
      try {
        return await this.callApi(apiKey, model, prompt, userText);
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError;
  }

  private async callApi(apiKey: string, model: string, prompt: string, userText: string): Promise<CorrectionResult> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({ model });

    const fullPrompt = prompt.replace('{USER_TEXT}', userText);
    const result = await genModel.generateContent(fullPrompt);
    const text = result.response.text();

    const parseWarnings: string[] = [];
    const warn = (tag: string) => (stage: ParseFailureStage, detail: unknown) => {
      parseWarnings.push(`[${tag}/${stage}] ${String(detail)}`);
    };

    const mistakes = this.parseMistakes(text, warn('mistakes'));
    const evaluation = this.parseEvaluation(text, warn('evaluation'));
    const levelUpItems = this.parseLevelUp(text, warn('levelup'));
    const reviewItems = this.parseReview(text, warn('review'));
    const corrected = text
      .replace(/<mistakes>[\s\S]*?<\/mistakes>/g, '')
      .replace(/<evaluation>[\s\S]*?<\/evaluation>/g, '')
      .replace(/<levelup>[\s\S]*?<\/levelup>/g, '')
      .replace(/<review>[\s\S]*?<\/review>/g, '')
      .trim();

    if (parseWarnings.length > 0) {
      console.warn('[GeminiService] レスポンス解析で問題が発生しました:', parseWarnings);
    }

    this.devLog.record({
      model,
      fullPrompt,
      userText,
      rawResponse: text,
      parsed: { corrected, mistakes, evaluation, reviewItems, levelUpItems },
      parseWarnings,
    });

    return { corrected, mistakes, evaluation, reviewItems, levelUpItems };
  }

  // ── レスポンス解析: <mistakes>...</mistakes> タグから JSON を抽出（失敗時は空配列） ─
  private parseMistakes(text: string, onError: (stage: ParseFailureStage, detail: unknown) => void): Mistake[] {
    return extractTaggedJson<Mistake[]>(
      text,
      'mistakes',
      (json) => {
        const obj = json as { mistakes?: unknown };
        return Array.isArray(obj.mistakes) ? (obj.mistakes as Mistake[]) : undefined;
      },
      onError
    ) ?? [];
  }

  // ── レスポンス解析: <evaluation>...</evaluation> タグから定量評価を抽出（失敗時 undefined） ─
  // 採用条件は3観点スコア＋errorDensity（数値）が揃うこと。CEFR4項目はAIの実判定値を優先採用し、
  // 欠落/不正時は buildEvaluation() 側で scoreToCefr にフォールバックする。総合スコアは常にコード算出。
  private parseEvaluation(text: string, onError: (stage: ParseFailureStage, detail: unknown) => void): WritingEvaluation | undefined {
    return extractTaggedJson<WritingEvaluation>(
      text,
      'evaluation',
      (json) => {
        const obj = json as Partial<WritingEvaluation>;
        const num = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);
        const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
        if (
          num(obj.grammarScore) && num(obj.vocabularyScore) &&
          num(obj.contentScore) && num(obj.errorDensity)
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
      onError
    );
  }

  // ── レスポンス解析: <levelup>...</levelup> タグからレベルアップ例文を抽出 ─
  // 必須フィールドが揃った項目だけを採用する。keyPhrases は leveledUp 内に実在するかまでは検証せず
  // （Drill 側の穴埋めロジックが該当フレーズを見つけられない場合はそのフレーズをスキップして防御的に扱う）、
  // 型の妥当性のみチェックする。不正な項目は除外し、1件も残らなければ undefined を返す。
  private parseLevelUp(text: string, onError: (stage: ParseFailureStage, detail: unknown) => void): LevelUpItem[] | undefined {
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
            item.keyPhrases.every((p) => typeof p === 'string' && p.length > 0)
        );
        return valid.length > 0 ? valid : undefined;
      },
      onError
    );
  }

  // ── レスポンス解析: <review>...</review> タグから復習カードを抽出 ─
  // 必須フィールドが揃い、choices が4要素かつ正解(answer)を含む項目だけを採用する。
  // 不正な項目は除外し、1件も残らなければ undefined を返す（保存・同期では undefined を持たせない）。
  private parseReview(text: string, onError: (stage: ParseFailureStage, detail: unknown) => void): ReviewItem[] | undefined {
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
            r.choices.includes(r.answer)
        );
        return valid.length > 0 ? valid : undefined;
      },
      onError
    );
  }
}
