/**
 * @file 設定ページ。アカウント（Google SSO ログイン/同期）・API キー・モデル選択・テーマ切り替えを管理する。
 * promptPreview は computed() で buildPrompt() から自動生成される（添削項目は全て常時有効）。
 */
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StorageService, AppSettings } from '../../services/storage.service';
import { AuthService } from '../../services/auth.service';
import { buildPrompt } from '../../utils/prompt.util';
import { APP_VERSION, RELEASE_DATE } from '../../../version';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  private storage = inject(StorageService);
  private auth = inject(AuthService);

  // ── アカウント（Google SSO） ──────────────────────────────────────
  readonly user = this.auth.user;
  authBusy = signal(false);

  async login() {
    this.authBusy.set(true);
    try {
      await this.auth.login();
    } catch (err) {
      console.error('[Settings] ログインに失敗:', err);
    } finally {
      this.authBusy.set(false);
    }
  }

  async logout() {
    this.authBusy.set(true);
    try {
      await this.auth.logout();
    } finally {
      this.authBusy.set(false);
    }
  }

  // ── バージョン情報（version.ts はビルド時に自動生成） ──
  readonly version = APP_VERSION;
  readonly releaseDate = RELEASE_DATE;

  readonly models = [
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  ];

  // ── 状態管理（signal） ────────────────────────────────────────────
  settings = signal<AppSettings>(this.initSettings());
  promptPreview = computed(() => buildPrompt());
  saved = signal(false);
  showKey = signal(false);

  private initSettings(): AppSettings {
    const saved = this.storage.getSettings();
    if (!this.models.find(m => m.value === saved.model)) {
      saved.model = this.models[0].value;
    }
    return saved;
  }

  update(field: keyof AppSettings, value: string | boolean) {
    this.settings.update(s => ({ ...s, [field]: value }));
    if (field === 'theme') {
      document.documentElement.dataset['theme'] = value as string;
    }
  }

  save() {
    this.storage.saveSettings(this.settings());
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }
}
