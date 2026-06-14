import { Injectable } from '@angular/core';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mistake } from '../models/session.model';

export interface CorrectionResult {
  corrected: string;
  mistakes: Mistake[];
}

@Injectable({ providedIn: 'root' })
export class GeminiService {
  async correct(apiKey: string, model: string, prompt: string, userText: string): Promise<CorrectionResult> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({ model });

    const fullPrompt = prompt.replace('{USER_TEXT}', userText);
    const result = await genModel.generateContent(fullPrompt);
    const text = result.response.text();

    const mistakes = this.parseMistakes(text);
    const corrected = text.replace(/<mistakes>[\s\S]*?<\/mistakes>/g, '').trim();

    return { corrected, mistakes };
  }

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
}
