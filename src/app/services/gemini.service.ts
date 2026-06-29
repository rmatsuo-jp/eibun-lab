/**
 * @file Google Gemini API との通信を担うサービス。
 * correct() でプロンプトを送信し、レスポンスから添削文・mistakes JSON・CEFR評価・復習カードを分離して返す。
 * gemini-3.5-flash でエラーが発生した場合、gemini-2.5-flash に自動フォールバックする。
 */
import { Injectable } from '@angular/core';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CefrEvaluation, Mistake, ReviewItem } from '../models/session.model';

export interface CorrectionResult {
  corrected: string;
  mistakes: Mistake[];
  cefr?: CefrEvaluation;
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
    const cefr = this.parseCefr(text);
    const reviewItems = this.parseReview(text);
    const corrected = text
      .replace(/<mistakes>[\s\S]*?<\/mistakes>/g, '')
      .replace(/<cefr>[\s\S]*?<\/cefr>/g, '')
      .replace(/<review>[\s\S]*?<\/review>/g, '')
      .trim();

    return { corrected, mistakes, cefr, reviewItems };
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

  // ── レスポンス解析: <cefr>...</cefr> タグから CEFR 評価を抽出（失敗時 undefined） ─
  private parseCefr(text: string): CefrEvaluation | undefined {
    const match = text.match(/<cefr>([\s\S]*?)<\/cefr>/);
    if (!match) return undefined;
    try {
      const json = JSON.parse(match[1].trim()) as Partial<CefrEvaluation>;
      if (json.grammar && json.vocabulary && json.content) {
        return { grammar: json.grammar, vocabulary: json.vocabulary, content: json.content };
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
