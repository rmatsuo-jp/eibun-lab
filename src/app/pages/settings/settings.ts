/**
 * @file 設定ページ。API キー・モデル選択・機能トグル・テーマ切り替えを管理する。
 * プロンプトのリアルタイムプレビューを提供する。
 */
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StorageService, AppSettings, buildPrompt } from '../../services/storage.service';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  // ── 状態管理（signal） ────────────────────────────────────────────
  settings = signal<AppSettings>({ apiKey: '', model: 'gemini-3.5-flash', includeNaturalExpressions: true, includeGrammarTendency: true, includeCefrEvaluation: true, includeLevelUpSuggestion: true, theme: 'dark' });
  promptPreview = signal('');
  saved = signal(false);
  showKey = signal(false);

  readonly models = [
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  ];

  constructor(private storage: StorageService) {
    const saved = this.storage.getSettings();
    const validModel = this.models.find(m => m.value === saved.model);
    if (!validModel) {
      saved.model = this.models[0].value;
    }
    this.settings.set(saved);
    this.promptPreview.set(buildPrompt(saved));
  }

  update(field: keyof AppSettings, value: string | boolean) {
    const updated = { ...this.settings(), [field]: value };
    this.settings.set(updated);
    this.promptPreview.set(buildPrompt(updated));
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
