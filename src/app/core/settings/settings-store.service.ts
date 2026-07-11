/**
 * @file アプリ設定（APIキー・モデル優先順位・テーマ）のローカル永続化を担うサービス。
 * 「設定管理」専任のストア。利用側（app/settings/practice等）が直接 inject する。旧バージョン（単一モデル文字列 `model`）からの
 * 移行ロジックもここに持つ。モデル一覧・デフォルト優先順位は gemini-models.constants.ts を共用する。
 * APIキーは localStorage に平文では保存せず、Web Crypto（AES-GCM、非抽出鍵を IndexedDB に保持）で
 * 暗号化した apiKeyEnc として保存する。復号は非同期のため、アプリ起動時に app.config.ts の
 * provideAppInitializer が init() を await し、起動後は getSettings() が同期でメモリ内の平文を返す。
 * 旧形式の平文 apiKey が残っている場合は init() で暗号化保存に移行する。
 * Web Crypto / IndexedDB 非対応環境では従来どおり平文保存にフォールバックする。
 * APIキーが設定済みかは hasApiKey signal で公開し、利用側（practice等）が購読して未設定時の誘導を出せるようにする。
 * 利用同意は consentAcceptedAt（日時）と consentVersion（同意した文言の版）の対で持つ。
 * 同意文言に実質的な変更（例: API 利用料金の負担条項の追加）を加えたら CONSENT_VERSION を上げること。
 * 既存ユーザーにも同意モーダルが再表示され、新しい文言への同意を取り直せる（判定は app.ts）。
 * 表示言語（language）もテーマと同じくここで永続化する。旧データは language を持たないため
 * getSettings() のデフォルトマージにより自動的に 'ja' として扱われる。
 */
import { Injectable, signal } from '@angular/core';
import { DEFAULT_MODEL_PRIORITY } from '../gemini/gemini-models.constants';
import { readJson, writeJson } from '@shared/utils/local-storage.util';
import {
  decryptText,
  encryptText,
  getOrCreateAesKey,
  isCryptoSupported,
} from '@shared/utils/crypto.util';
import { Lang } from '@core/i18n/lang.model';

const SETTINGS_KEY = 'app_settings';

// ── 同意文言のバージョン ──────────────────────────────────────────
// 1: 初版（Gemini API への送信・Firebase 保存の告知のみ）
// 2: API 利用料金の負担が利用者に帰属する旨を追記
export const CONSENT_VERSION = 2;

// ── 設定型・デフォルト値 ──────────────────────────────────────────
export interface AppSettings {
  apiKey: string;
  modelPriority: string[]; // API送信の試行順（先頭が最優先、失敗したら次のモデルへフォールバック）
  theme: 'light' | 'dark';
  language: Lang; // UI表示言語・添削結果の表示言語切替に使う
  consentAcceptedAt?: string; // プライバシーポリシー・利用規約への同意日時（ISO 8601）。未同意なら undefined。
  consentVersion?: number; // 同意した文言のバージョン。未設定（旧データ）は 1 とみなす。
}

// localStorage 上の保存形式。apiKey（平文・旧形式）と apiKeyEnc（暗号文・新形式）の両方を持ち得る。
type StoredSettings = Partial<AppSettings> & { model?: string; apiKeyEnc?: string };

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  modelPriority: DEFAULT_MODEL_PRIORITY,
  theme: 'dark',
  language: 'ja',
};

@Injectable({ providedIn: 'root' })
export class SettingsStoreService {
  // 復号済みAPIキーのメモリ内キャッシュ。init() 完了後は常に最新（saveSettings でも更新）。
  private apiKeyCache = '';

  // APIキーが設定済みか。apiKeyCache と常に同期させ、テンプレートから購読できるようにする。
  // getSettings() は同期メソッドで signal 依存を持たないため、これが無いと
  // 「設定ページで保存 → 添削ページの誘導が消える」という再描画が起きない。
  readonly hasApiKey = signal(false);

  // アプリ起動時（provideAppInitializer）に1回だけ呼ばれる。
  // 1. 旧形式の平文 apiKey が残っていれば暗号化保存へ移行して平文を除去する。
  // 2. 暗号文 apiKeyEnc があれば復号してメモリにキャッシュする。
  // 復号失敗（鍵の消失等）時はキー未設定として扱い、ユーザーに再入力してもらう。
  async init(): Promise<void> {
    const stored = readJson<StoredSettings>(SETTINGS_KEY, {});
    if (!isCryptoSupported()) {
      this.apiKeyCache = stored.apiKey ?? '';
      this.hasApiKey.set(!!this.apiKeyCache);
      return;
    }
    try {
      if (stored.apiKey) {
        // 旧形式（平文）からの移行: 暗号化して保存し直し、平文を localStorage から消す
        this.apiKeyCache = stored.apiKey;
        await this.persist({ ...stored, apiKey: this.apiKeyCache } as AppSettings & StoredSettings);
      } else if (stored.apiKeyEnc) {
        const key = await getOrCreateAesKey();
        this.apiKeyCache = await decryptText(key, stored.apiKeyEnc);
      }
    } catch (e) {
      console.error('[SettingsStoreService] APIキーの復号に失敗しました（再入力が必要です）:', e);
      this.apiKeyCache = '';
    }
    this.hasApiKey.set(!!this.apiKeyCache);
  }

  // 旧バージョン（単一モデル文字列 `model` を持つ設定）からの移行にも対応する:
  // `modelPriority` が無く `model` のみ持つ場合、その値を先頭に置きデフォルト順で残りを埋める。
  getSettings(): AppSettings {
    const parsed = readJson<StoredSettings>(SETTINGS_KEY, {});
    const merged: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      apiKey: parsed.apiKey ?? this.apiKeyCache,
    };
    if (!parsed.modelPriority && parsed.model) {
      merged.modelPriority = [
        parsed.model,
        ...DEFAULT_MODEL_PRIORITY.filter((m) => m !== parsed.model),
      ];
    }
    return merged;
  }

  // 同期APIを維持するため、暗号化書き込みは内部で fire-and-forget する。
  // メモリキャッシュは即時更新するので、直後の getSettings() は新しいキーを返す。
  saveSettings(settings: AppSettings): void {
    this.apiKeyCache = settings.apiKey;
    this.hasApiKey.set(!!this.apiKeyCache);
    this.persist(settings).catch((e) =>
      console.error('[SettingsStoreService] 設定の保存に失敗しました:', e),
    );
  }

  // apiKey を暗号文（apiKeyEnc）に変換して書き込む。平文 apiKey は保存形式から常に除外する。
  // Web Crypto / IndexedDB 非対応環境では永続化せず、メモリ内キャッシュ（apiKeyCache）のみで
  // 保持する（ページ再読み込みで消える。localStorage への平文保存はセキュリティ上行わない）。
  private async persist(settings: AppSettings): Promise<void> {
    const { apiKey, ...rest } = settings;
    if (!isCryptoSupported()) {
      writeJson(SETTINGS_KEY, rest);
      return;
    }
    let apiKeyEnc: string | undefined;
    if (apiKey) {
      const key = await getOrCreateAesKey();
      apiKeyEnc = await encryptText(key, apiKey);
    }
    writeJson(SETTINGS_KEY, apiKeyEnc ? { ...rest, apiKeyEnc } : rest);
  }

  // 設定ページの未保存編集（isDirty）とは独立に、同意日時と同意した文言のバージョンを直接書き込む。
  acceptConsent(): void {
    this.saveSettings({
      ...this.getSettings(),
      consentAcceptedAt: new Date().toISOString(),
      consentVersion: CONSENT_VERSION,
    });
  }

  // 同意モーダルを表示すべきか。未同意、または旧バージョンの文言にしか同意していない場合に true。
  // 旧データは consentVersion を持たないため 1（初版）とみなす。
  needsConsent(): boolean {
    const { consentAcceptedAt, consentVersion } = this.getSettings();
    return !consentAcceptedAt || (consentVersion ?? 1) < CONSENT_VERSION;
  }
}
