/**
 * @file Gemini とのやり取り（送信プロンプト全文・生レスポンス・パース済みJSON）を開発用に記録するサービス。
 * StorageService と同じ signal + localStorage パターンで直近 MAX_ENTRIES 件を永続化する。
 * 開発タブ（pages/dev）から閲覧・コピーするためだけに存在し、学習データ（CorrectionSession）とは無関係。
 */
import { Injectable, signal } from '@angular/core';
import { Mistake, ReviewItem, WritingEvaluation } from '../models/session.model';

export interface DevLogEntry {
  id: string;
  timestamp: string; // ISO
  model: string; // 実際に応答したモデル（フォールバック後の値）
  fullPrompt: string; // {USER_TEXT} 置換後の送信プロンプト全文
  userText: string;
  rawResponse: string; // Gemini の生レスポンステキスト（タグ除去前）
  parsed: {
    corrected: string;
    mistakes: Mistake[];
    evaluation?: WritingEvaluation;
    reviewItems?: ReviewItem[];
  };
}

const LOGS_KEY = 'dev_logs';
const MAX_ENTRIES = 20;

@Injectable({ providedIn: 'root' })
export class DevLogService {
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

  record(entry: Omit<DevLogEntry, 'id' | 'timestamp'>): void {
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
