/**
 * @file アプリ設定（APIキー・モデル優先順位・テーマ）のローカル永続化を担うサービス。
 * 「設定管理」専任のストア。利用側（app/settings/practice等）が直接 inject する。旧バージョン（単一モデル文字列 `model`）からの
 * 移行ロジックもここに持つ。モデル一覧・デフォルト優先順位は gemini-models.constants.ts を共用する。
 */
import { Injectable } from '@angular/core';
import { DEFAULT_MODEL_PRIORITY } from '../gemini/gemini-models.constants';
import { readJson, writeJson } from '@shared/utils/local-storage.util';

const SETTINGS_KEY = 'app_settings';

// ── 設定型・デフォルト値 ──────────────────────────────────────────
export interface AppSettings {
  apiKey: string;
  modelPriority: string[]; // API送信の試行順（先頭が最優先、失敗したら次のモデルへフォールバック）
  theme: 'light' | 'dark';
  consentAcceptedAt?: string; // プライバシーポリシー・利用規約への同意日時（ISO 8601）。未同意なら undefined。
}

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
    const parsed = readJson<Partial<AppSettings> & { model?: string }>(SETTINGS_KEY, {});
    const merged: AppSettings = { ...DEFAULT_SETTINGS, ...parsed };
    if (!parsed.modelPriority && parsed.model) {
      merged.modelPriority = [
        parsed.model,
        ...DEFAULT_MODEL_PRIORITY.filter(m => m !== parsed.model),
      ];
    }
    return merged;
  }

  saveSettings(settings: AppSettings): void {
    writeJson(SETTINGS_KEY, settings);
  }

  // 設定ページの未保存編集（isDirty）とは独立に、同意日時だけを直接書き込む。
  acceptConsent(): void {
    this.saveSettings({ ...this.getSettings(), consentAcceptedAt: new Date().toISOString() });
  }
}
