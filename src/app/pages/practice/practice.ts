import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { GeminiService } from '../../services/gemini.service';
import { StorageService } from '../../services/storage.service';
import { CorrectionSession, Mistake } from '../../models/session.model';

@Component({
  selector: 'app-practice',
  imports: [FormsModule],
  templateUrl: './practice.html',
  styleUrl: './practice.scss',
})
export class Practice {
  userText = signal('');
  loading = signal(false);
  error = signal('');
  result = signal<{ corrected: string; mistakes: Mistake[] } | null>(null);

  constructor(
    private gemini: GeminiService,
    private storage: StorageService,
    private sanitizer: DomSanitizer,
  ) {}

  toHtml(markdown: string): SafeHtml {
    const html = marked.parse(markdown) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  async submit() {
    const text = this.userText().trim();
    if (!text) return;

    const settings = this.storage.getSettings();
    if (!settings.apiKey) {
      this.error.set('設定ページで Gemini API キーを入力してください。');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.result.set(null);

    try {
      const res = await this.gemini.correct(settings.apiKey, settings.model, settings.prompt, text);
      this.result.set(res);

      const session: CorrectionSession = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        original: text,
        corrected: res.corrected,
        mistakes: res.mistakes,
      };
      this.storage.saveSession(session);
    } catch (e) {
      this.error.set('エラーが発生しました: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      this.loading.set(false);
    }
  }

  clear() {
    this.userText.set('');
    this.result.set(null);
    this.error.set('');
  }
}
