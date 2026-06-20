/**
 * @file Google Gemini API との通信を担うサービス。
 * correct() でプロンプトを送信し、レスポンスから添削文・mistakes JSON・CEFR評価を分離して返す。
 * gemini-3.5-flash でエラーが発生した場合、gemini-2.5-flash に自動フォールバックする。
 */
import { Injectable } from '@angular/core';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CefrEvaluation, Mistake } from '../models/session.model';

export interface CorrectionResult {
  corrected: string;
  mistakes: Mistake[];
  cefr?: CefrEvaluation;
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
    const corrected = text
      .replace(/<mistakes>[\s\S]*?<\/mistakes>/g, '')
      .replace(/<cefr>[\s\S]*?<\/cefr>/g, '')
      .trim();

    return { corrected, mistakes, cefr };
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
}
