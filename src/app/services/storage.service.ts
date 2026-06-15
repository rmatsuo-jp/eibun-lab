import { Injectable } from '@angular/core';
import { CorrectionSession, Mistake } from '../models/session.model';

const SESSIONS_KEY = 'correction_sessions';
const SETTINGS_KEY = 'app_settings';

export interface AppSettings {
  apiKey: string;
  model: string;
  includeNaturalExpressions: boolean;
  includeGrammarTendency: boolean;
  includeCefrEvaluation: boolean;
  includeLevelUpSuggestion: boolean;
  theme: 'light' | 'dark';
}

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  model: 'gemini-3.5-flash',
  includeNaturalExpressions: true,
  includeGrammarTendency: true,
  includeCefrEvaluation: true,
  includeLevelUpSuggestion: true,
  theme: 'dark',
};

export function buildPrompt(settings: AppSettings): string {
  const sections: string[] = [];

  sections.push(`以下の英作文（英語日記）の添削をお願いします。
単に修正するだけでなく、以下の指示に従って詳細なフィードバックを日本語で出力してください。

1. 文法・語法のミスを指摘し、正しい表現を示してください。
   【なぜその修正が必要なのか（文法的な理由）】を、初心者にも分かりやすく丁寧に解説してください。`);

  if (settings.includeNaturalExpressions) {
    sections.push(`2. より自然な表現、ネイティブらしい表現があれば提案してください。`);
  }

  sections.push(`3. 添削後の全文（修正を反映した完成版の文章）を提示してください。
4. ミスを必ず以下のJSON形式でレスポンスの「一番最後（末尾）」にまとめてください：
<mistakes>
{"mistakes": [{"category": "カテゴリ名", "original": "元の表現", "corrected": "正しい表現", "explanation": "説明"}]}
</mistakes>`);

  const analysis: string[] = [];

  if (settings.includeGrammarTendency) {
    analysis.push(`【文法のミスの傾向】
今回の日記から読み取れる、私が犯しやすい「文法のミスの傾向や癖」があれば、今後の対策と合わせて教えてください。`);
  }

  if (settings.includeCefrEvaluation) {
    analysis.push(`【CEFR基準による評価】
今回の文章をCEFR（ヨーロッパ言語共通参照枠）の観点から、以下の3つの側面で客観的に評価してください（例：A2、B1など）。
・文法面：
・語彙面：
・内容面：`);
  }

  if (settings.includeLevelUpSuggestion) {
    analysis.push(`【レベルアップした表現の提案】
今回のCEFR評価の「一段階上」のレベル（例：今回がA2ならB1レベル、B1ならB2レベル）で、同じ日記の内容を書いた場合の英文のサンプルを提示してください。どのような語彙や構文を使えばレベルアップできるかの解説も添えてください。`);
  }

  if (analysis.length > 0) {
    sections.push(`\nまた、添削に加えて以下の分析と評価も必ず行ってください。\n\n` + analysis.join('\n\n'));
  }

  sections.push(`\n英作文:\n{USER_TEXT}`);

  return sections.join('\n\n');
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  getSessions(): CorrectionSession[] {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as CorrectionSession[];
    } catch {
      return [];
    }
  }

  saveSession(session: CorrectionSession): void {
    const sessions = this.getSessions();
    sessions.unshift(session);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }

  deleteSession(id: string): void {
    const sessions = this.getSessions().filter(s => s.id !== id);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }

  getSettings(): AppSettings {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(settings: AppSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  importSessions(incoming: CorrectionSession[]): CorrectionSession[] {
    const existing = this.getSessions();
    const existingIds = new Set(existing.map(s => s.id));
    const newOnes = incoming.filter(s => !existingIds.has(s.id));
    const merged = [...existing, ...newOnes]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(merged));
    return merged;
  }

  exportSessions(): string {
    return JSON.stringify(this.getSessions(), null, 2);
  }

  getMistakeStats(): { category: string; count: number }[] {
    const sessions = this.getSessions();
    const counts: Record<string, number> = {};
    for (const session of sessions) {
      for (const m of session.mistakes) {
        counts[m.category] = (counts[m.category] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }

  getFrequentMistakes(): Mistake[] {
    const sessions = this.getSessions();
    const all: Mistake[] = sessions.flatMap(s => s.mistakes);
    const seen = new Map<string, Mistake & { count: number }>();
    for (const m of all) {
      const key = m.original.toLowerCase().trim();
      const existing = seen.get(key);
      if (existing) {
        existing.count++;
      } else {
        seen.set(key, { ...m, count: 1 });
      }
    }
    return [...seen.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }
}
