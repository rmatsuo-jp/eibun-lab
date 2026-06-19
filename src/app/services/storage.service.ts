/**
 * @file LocalStorage への永続化を担うサービス。
 * セッション管理（CRUD）・設定管理・ミス統計集計を一元管理する。
 * sessions signal でリアクティブなキャッシュを提供する。
 * コンポーネントから直接 localStorage を操作せず、必ずこのサービスを経由すること。
 */
import { Injectable, signal } from '@angular/core';
import { CorrectionSession, Mistake } from '../models/session.model';

const SESSIONS_KEY = 'correction_sessions';
const SETTINGS_KEY = 'app_settings';

// ── 設定型・デフォルト値 ──────────────────────────────────────────
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

@Injectable({ providedIn: 'root' })
export class StorageService {
  // ── Signal キャッシュ（読み取り専用で公開） ──────────────────────
  private _sessions = signal<CorrectionSession[]>(this.loadFromStorage());
  readonly sessions = this._sessions.asReadonly();

  private loadFromStorage(): CorrectionSession[] {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as CorrectionSession[];
    } catch {
      return [];
    }
  }

  private persist(sessions: CorrectionSession[]): void {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    this._sessions.set(sessions);
  }

  // ── セッション管理 ────────────────────────────────────────────────
  saveSession(session: CorrectionSession): void {
    this.persist([session, ...this._sessions()]);
  }

  deleteSession(id: string): void {
    this.persist(this._sessions().filter(s => s.id !== id));
  }

  // ── 設定管理 ──────────────────────────────────────────────────────
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

  // ── インポート / エクスポート ──────────────────────────────────────
  importSessions(incoming: CorrectionSession[]): void {
    const existing = this._sessions();
    const existingIds = new Set(existing.map(s => s.id));
    const merged = [...existing, ...incoming.filter(s => !existingIds.has(s.id))]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    this.persist(merged);
  }

  exportSessions(): string {
    return JSON.stringify(this._sessions(), null, 2);
  }

  // ── ミス統計集計（sessions signal を読むため computed() 内で依存追跡される） ─
  getMistakeStats(): { category: string; count: number }[] {
    const counts: Record<string, number> = {};
    for (const session of this._sessions()) {
      for (const m of session.mistakes) {
        counts[m.category] = (counts[m.category] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }

  getFrequentMistakes(): (Mistake & { count: number })[] {
    const all = this._sessions().flatMap(s => s.mistakes);
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
