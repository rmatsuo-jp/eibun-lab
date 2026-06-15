import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StorageService, AppSettings, buildPrompt } from '../../services/storage.service';
import { CorrectionSession } from '../../models/session.model';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  settings = signal<AppSettings>({ apiKey: '', model: 'gemini-3.5-flash', includeNaturalExpressions: true, includeGrammarTendency: true, includeCefrEvaluation: true, includeLevelUpSuggestion: true, theme: 'dark' });
  promptPreview = signal('');
  saved = signal(false);
  showKey = signal(false);

  readonly models = [
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  ];

  convertDate = signal(new Date().toISOString().slice(0, 10));
  convertTexts = signal<string[]>(['']);
  convertResult = signal('');
  copiedConvert = signal(false);

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

  addEntry() {
    this.convertTexts.set([...this.convertTexts(), '']);
  }

  removeEntry(i: number) {
    const arr = [...this.convertTexts()];
    arr.splice(i, 1);
    this.convertTexts.set(arr.length ? arr : ['']);
  }

  updateEntry(i: number, value: string) {
    const arr = [...this.convertTexts()];
    arr[i] = value;
    this.convertTexts.set(arr);
  }

  generateJson() {
    const baseTime = new Date(this.convertDate()).getTime();
    const sessions: CorrectionSession[] = this.convertTexts()
      .filter(t => t.trim())
      .map((t, i) => ({
        id: `${baseTime + i}`,
        date: new Date(this.convertDate()).toISOString(),
        original: t.trim(),
        corrected: '',
        mistakes: [],
      }));
    this.convertResult.set(JSON.stringify(sessions, null, 2));
  }

  copyResult() {
    navigator.clipboard.writeText(this.convertResult());
    this.copiedConvert.set(true);
    setTimeout(() => this.copiedConvert.set(false), 2000);
  }
}
