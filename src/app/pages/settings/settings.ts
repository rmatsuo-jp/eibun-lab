import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StorageService, AppSettings } from '../../services/storage.service';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  settings = signal<AppSettings>({ apiKey: '', model: 'gemini-3.5-flash', prompt: '' });
  saved = signal(false);
  showKey = signal(false);

  readonly models = [
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  ];

  constructor(private storage: StorageService) {
    const saved = this.storage.getSettings();
    const validModel = this.models.find(m => m.value === saved.model);
    if (!validModel) {
      saved.model = this.models[0].value;
    }
    this.settings.set(saved);
  }

  update(field: keyof AppSettings, value: string) {
    this.settings.set({ ...this.settings(), [field]: value });
  }

  save() {
    this.storage.saveSettings(this.settings());
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }
}
