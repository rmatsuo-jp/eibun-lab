/**
 * @file LocalStorage への永続化を担うサービス。
 * セッション管理（CRUD）・設定管理・ミス統計集計・学習統計（streak等）を一元管理する。
 * sessions signal でリアクティブなキャッシュを提供する。
 * コンポーネントから直接 localStorage を操作せず、必ずこのサービスを経由すること。
 */
import { Injectable, signal } from '@angular/core';
import { CefrEvaluation, CorrectionSession, Mistake } from '../models/session.model';

// CEFR レベルを数値化（グラフ描画用）。未知の値は 0 として扱う。
export const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export function cefrToNumber(level: string): number {
  const idx = CEFR_ORDER.indexOf(level.toUpperCase().trim() as (typeof CEFR_ORDER)[number]);
  return idx === -1 ? 0 : idx + 1;
}

const SESSIONS_KEY = 'correction_sessions';
const SETTINGS_KEY = 'app_settings';

// ── 学習統計型（ダッシュボード表示用） ──────────────────────────────
export interface StudyStats {
  totalSessions: number;     // 総添削数
  totalMistakes: number;     // 総ミス数
  avgMistakes: number;       // 1回あたり平均ミス数（小数1桁）
  currentStreak: number;     // 連続学習日数
  last7DaysCount: number;    // 直近7日のセッション数
}

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

  // ── 学習統計（streak は日付単位で連続日数を算出） ───────────────────
  getStudyStats(): StudyStats {
    const sessions = this._sessions();
    const totalSessions = sessions.length;
    const totalMistakes = sessions.reduce((sum, s) => sum + s.mistakes.length, 0);
    const avgMistakes = totalSessions === 0
      ? 0
      : Math.round((totalMistakes / totalSessions) * 10) / 10;

    // セッションが存在する日付（ローカル時刻 YYYY-MM-DD）の集合
    const dayKeys = new Set(sessions.map(s => this.toDayKey(s.date)));

    // 連続学習日数: 今日 or 昨日を起点に、連続して遡れる日数を数える
    let currentStreak = 0;
    const cursor = new Date();
    if (!dayKeys.has(this.toDayKey(cursor.toISOString()))) {
      // 今日まだ未学習なら昨日を起点にする（昨日があれば streak 継続中とみなす）
      cursor.setDate(cursor.getDate() - 1);
    }
    while (dayKeys.has(this.toDayKey(cursor.toISOString()))) {
      currentStreak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    // 直近7日のセッション数
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const last7DaysCount = sessions.filter(
      s => new Date(s.date).getTime() >= sevenDaysAgo.getTime()
    ).length;

    return { totalSessions, totalMistakes, avgMistakes, currentStreak, last7DaysCount };
  }

  // ── CEFR 推移: cefr を持つセッションを日付昇順で返す（同一日付は最新を採用） ─
  getCefrHistory(): { date: string; cefr: CefrEvaluation }[] {
    const byDay = new Map<string, { date: string; cefr: CefrEvaluation }>();
    for (const s of this._sessions()) {
      if (!s.cefr) continue;
      const key = this.toDayKey(s.date);
      const existing = byDay.get(key);
      // 同一日付は date（ISO）が新しい方を採用
      if (!existing || s.date > existing.date) {
        byDay.set(key, { date: s.date, cefr: s.cefr });
      }
    }
    return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  // ── 日付をローカル時刻の YYYY-MM-DD キーに正規化 ──────────────────
  private toDayKey(iso: string): string {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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
