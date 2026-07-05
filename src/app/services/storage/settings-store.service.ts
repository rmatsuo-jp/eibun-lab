/**
 * @file アプリ設定（APIキー・モデル優先順位・テーマ）のローカル永続化を担うサービス。
 * StorageService から切り出した「設定管理」専任部分。旧バージョン（単一モデル文字列 `model`）からの
 * 移行ロジックもここに持つ。
 */
import { Injectable } from '@angular/core';

const SETTINGS_KEY = 'app_settings';

// ── 設定型・デフォルト値 ──────────────────────────────────────────
export interface AppSettings {
  apiKey: string;
  modelPriority: string[]; // API送信の試行順（先頭が最優先、失敗したら次のモデルへフォールバック）
  theme: 'light' | 'dark';
}

const DEFAULT_MODEL_PRIORITY = [
  'gemini-3.5-flash',
  'gemini-3-flash',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
];

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  modelPriority: DEFAULT_MODEL_PRIORITY,
  theme: 'dark',
};

@Injectable({ providedIn: 'root' })
export class SettingsStoreService {
  // 旧バージョン（単一モデル文字列 `model` を持つ設定）からの移行にも対応する:
  // `modelPriority` が無く `model` のみ持つ場合、その値を先頭に置きデフォルト順で残りを埋める。
  getSettings(): AppSettings {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      const parsed = JSON.parse(raw) as Partial<AppSettings> & { model?: string };
      const merged: AppSettings = { ...DEFAULT_SETTINGS, ...parsed };
      if (!parsed.modelPriority && parsed.model) {
        merged.modelPriority = [
          parsed.model,
          ...DEFAULT_MODEL_PRIORITY.filter(m => m !== parsed.model),
        ];
      }
      return merged;
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(settings: AppSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
}
