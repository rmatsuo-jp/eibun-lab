/**
 * @file Gemini とのやり取り（送信プロンプト全文・生レスポンス・パース済みJSON）を開発用に記録するサービス。
 * core/logging の GeminiLogger 実装。app.config.ts が開発ビルド時のみ GEMINI_LOGGER として provide する
 * （本番ビルドは no-op デフォルトのため記録されない）。signal + localStorage で直近 MAX_ENTRIES 件を永続化し、
 * 開発タブ（features/dev）から閲覧・コピーする。学習データ（CorrectionSession）とは無関係。
 */
import { Injectable, signal } from '@angular/core';
import { GeminiLogRecord, GeminiLogger } from '@core/logging/gemini-log.token';

export interface DevLogEntry extends GeminiLogRecord {
  id: string;
  timestamp: string; // ISO
}

const LOGS_KEY = 'dev_logs';
const MAX_ENTRIES = 20;

@Injectable({ providedIn: 'root' })
export class DevLogService implements GeminiLogger {
  logs = signal<DevLogEntry[]>(this.loadFromStorage());

  private loadFromStorage(): DevLogEntry[] {
    const raw = localStorage.getItem(LOGS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as DevLogEntry[];
    } catch {
      return [];
    }
  }

  private persist(logs: DevLogEntry[]): void {
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
    this.logs.set(logs);
  }

  record(entry: GeminiLogRecord): void {
    const full: DevLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
    };
    this.persist([full, ...this.logs()].slice(0, MAX_ENTRIES));
  }

  clear(): void {
    this.persist([]);
  }

  exportJson(): string {
    return JSON.stringify(this.logs(), null, 2);
  }
}
