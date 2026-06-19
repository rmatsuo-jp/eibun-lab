/**
 * @file 設定ページ。API キー・モデル選択・機能トグル・テーマ切り替えを管理する。
 * promptPreview は computed() で settings signal から自動生成される。
 */
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StorageService, AppSettings } from '../../services/storage.service';
import { buildPrompt } from '../../utils/prompt.util';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  private storage = inject(StorageService);

  readonly models = [
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  ];

  // ── 状態管理（signal） ────────────────────────────────────────────
  settings = signal<AppSettings>(this.initSettings());
  promptPreview = computed(() => buildPrompt(this.settings()));
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
