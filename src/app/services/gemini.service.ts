/**
 * @file Google Gemini API との通信を担うサービス。
 * correct() でプロンプトを送信し、レスポンスから添削文・mistakes JSON・定量評価(WritingEvaluation)・復習カードを分離して返す。
 * 定量評価は AI の3観点スコア＋errorDensity を受け取り、総合スコア・CEFR は evaluation.util で算出して補完する。
 * gemini-3.5-flash でエラーが発生した場合、gemini-2.5-flash に自動フォールバックする。
 */
import { Injectable } from '@angular/core';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mistake, ReviewItem, WritingEvaluation } from '../models/session.model';
import { buildEvaluation } from '../utils/evaluation.util';

export interface CorrectionResult {
  corrected: string;
  mistakes: Mistake[];
  evaluation?: WritingEvaluation;
  reviewItems?: ReviewItem[];
}

@Injectable({ providedIn: 'root' })
export class GeminiService {
  // ── API 呼び出し（gemini-3.5-flash 失敗時は gemini-2.5-flash にフォールバック） ─
  async correct(apiKey: string, model: string, prompt: string, userText: string): Promise<CorrectionResult> {
    try {
      return await this.callApi(apiKey, model, prompt, userText);
    } catch (e) {
      if (model === 'gemini-3.5-flash') {
        return await this.callApi(apiKey, 'gemini-2.5-flash', prompt, userText);
      }
      throw e;
    }
  }

  private async callApi(apiKey: string, model: string, prompt: string, userText: string): Promise<CorrectionResult> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({ model });

    const fullPrompt = prompt.replace('{USER_TEXT}', userText);
    const result = await genModel.generateContent(fullPrompt);
    const text = result.response.text();

    const mistakes = this.parseMistakes(text);
    const evaluation = this.parseEvaluation(text);
    const reviewItems = this.parseReview(text);
    const corrected = text
      .replace(/<mistakes>[\s\S]*?<\/mistakes>/g, '')
      .replace(/<evaluation>[\s\S]*?<\/evaluation>/g, '')
      .replace(/<review>[\s\S]*?<\/review>/g, '')
      .trim();

    return { corrected, mistakes, evaluation, reviewItems };
  }

  // ── レスポンス解析: <mistakes>...</mistakes> タグから JSON を抽出 ─
  private parseMistakes(text: string): Mistake[] {
    const match = text.match(/<mistakes>([\s\S]*?)<\/mistakes>/);
    if (!match) return [];
    try {
      const json = JSON.parse(match[1].trim()) as { mistakes: Mistake[] };
      return Array.isArray(json.mistakes) ? json.mistakes : [];
    } catch {
      return [];
    }
  }

  // ── レスポンス解析: <evaluation>...</evaluation> タグから定量評価を抽出（失敗時 undefined） ─
  // 採用条件は3観点スコア＋errorDensity（数値）が揃うこと。CEFR4項目はAIの実判定値を優先採用し、
  // 欠落/不正時は buildEvaluation() 側で scoreToCefr にフォールバックする。総合スコアは常にコード算出。
  // 余計なコードフェンス等が混じっても最初の {...} を抽出して救済する。
  private parseEvaluation(text: string): WritingEvaluation | undefined {
    const match = text.match(/<evaluation>([\s\S]*?)<\/evaluation>/);
    if (!match) return undefined;
    // コードフェンスを除去し、最初の {...} ブロックだけを取り出す（軽い正規化）
    const cleaned = match[1].replace(/```[a-z]*/gi, '').trim();
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!objMatch) return undefined;
    try {
      const json = JSON.parse(objMatch[0]) as Partial<WritingEvaluation>;
      const num = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);
      const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
      if (
        num(json.grammarScore) && num(json.vocabularyScore) &&
        num(json.contentScore) && num(json.errorDensity)
      ) {
        return buildEvaluation({
          grammarScore: json.grammarScore,
          vocabularyScore: json.vocabularyScore,
          contentScore: json.contentScore,
          errorDensity: json.errorDensity,
          grammarCefr: str(json.grammarCefr) ? json.grammarCefr : undefined,
          vocabularyCefr: str(json.vocabularyCefr) ? json.vocabularyCefr : undefined,
          contentCefr: str(json.contentCefr) ? json.contentCefr : undefined,
          overallCefr: str(json.overallCefr) ? json.overallCefr : undefined,
        });
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  // ── レスポンス解析: <review>...</review> タグから復習カードを抽出 ─
  // 必須フィールドが揃い、choices が4要素かつ正解(answer)を含む項目だけを採用する。
  // 不正な項目は除外し、1件も残らなければ undefined を返す（保存・同期では undefined を持たせない）。
  private parseReview(text: string): ReviewItem[] | undefined {
    const match = text.match(/<review>([\s\S]*?)<\/review>/);
    if (!match) return undefined;
    try {
      const json = JSON.parse(match[1].trim()) as { reviewItems?: ReviewItem[] };
      if (!Array.isArray(json.reviewItems)) return undefined;
      const valid = json.reviewItems.filter(
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
    } catch {
      return undefined;
    }
  }
}
