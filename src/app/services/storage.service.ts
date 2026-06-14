import { Injectable } from '@angular/core';
import { CorrectionSession, Mistake } from '../models/session.model';

const SESSIONS_KEY = 'correction_sessions';
const SETTINGS_KEY = 'app_settings';

export interface AppSettings {
  apiKey: string;
  model: string;
  prompt: string;
}

const DEFAULT_PROMPT = `以下の英作文を添削してください。
1. 文法・語法のミスを指摘し、正しい表現を示してください
2. より自然な表現があれば提案してください
3. 添削後の全文も示してください
4. ミスを必ず以下のJSON形式でレスポンスの末尾にまとめてください：
<mistakes>
{"mistakes": [{"category": "カテゴリ名", "original": "元の表現", "corrected": "正しい表現", "explanation": "説明"}]}
</mistakes>

英作文:
{USER_TEXT}`;

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  model: 'gemini-3.5-flash',
  prompt: DEFAULT_PROMPT,
};

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
