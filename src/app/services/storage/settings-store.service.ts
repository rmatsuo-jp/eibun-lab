/**
 * @file アプリ設定（APIキー・モデル優先順位・テーマ）のローカル永続化を担うサービス。
 * StorageService から切り出した「設定管理」専任部分。旧バージョン（単一モデル文字列 `model`）からの
 * 移行ロジックもここに持つ。モデル一覧・デフォルト優先順位は gemini-models.constants.ts を共用する。
 */
import { Injectable } from '@angular/core';
import { DEFAULT_MODEL_PRIORITY } from '../gemini/gemini-models.constants';
import { readJson, writeJson } from '../../utils/local-storage.util';

const SETTINGS_KEY = 'app_settings';

// ── 設定型・デフォルト値 ──────────────────────────────────────────
export interface AppSettings {
  apiKey: string;
  modelPriority: string[]; // API送信の試行順（先頭が最優先、失敗したら次のモデルへフォールバック）
  theme: 'light' | 'dark';
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
}
