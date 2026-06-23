/**
 * @file 英作文入力・添削結果表示ページ。
 * ユーザーが入力した英文を GeminiService に送信し、添削結果（Markdown）とミスリストを表示する。
 * 日付選択（デフォルト: 今日）が可能。添削成功時は StorageService にセッションを保存する。
 */
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { GeminiService } from '../../services/gemini.service';
import { StorageService } from '../../services/storage.service';
import { buildPrompt } from '../../utils/prompt.util';
import { CorrectionSession, Mistake } from '../../models/session.model';

// ── 日付ユーティリティ ───────────────────────────────────────────
/**
 * ローカルタイムゾーンの「今日」を YYYY-MM-DD 形式で返す純粋関数。
 * toISOString() は UTC 変換のため JST 早朝に前日へずれる。それを避けるため
 * getFullYear/getMonth/getDate（いずれもローカル時刻基準）から組み立てる。
 */
function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Component({
  selector: 'app-practice',
  imports: [FormsModule],
  templateUrl: './practice.html',
  styleUrl: './practice.scss',
})
export class Practice {
  private gemini = inject(GeminiService);
  private storage = inject(StorageService);
  private sanitizer = inject(DomSanitizer);

  // ── 状態管理（signal） ────────────────────────────────────────────
  userText = signal('');
  selectedDate = signal(todayLocal());
  loading = signal(false);
  error = signal('');
  result = signal<{ corrected: string; mistakes: Mistake[] } | null>(null);

  toHtml(markdown: string): SafeHtml {
    const html = marked.parse(markdown) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  // ── 添削実行: Gemini API 呼び出し → 結果表示 → セッション保存 ───
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
      const res = await this.gemini.correct(settings.apiKey, settings.model, buildPrompt(settings), text);
      this.result.set(res);

      // 'YYYY-MM-DD' を new Date() に渡すと UTC 0時扱いになりずれるため、
      // ローカル正午で生成して選択日付を確実に保持する。
      const [y, m, day] = this.selectedDate().split('-').map(Number);
      const sessionDate = new Date(y, m - 1, day, 12);
      const session: CorrectionSession = {
        // 日付に依存しない一意 ID（同日に複数回添削しても衝突しない）
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        date: sessionDate.toISOString(),
        original: text,
        corrected: res.corrected,
        mistakes: res.mistakes,
        cefr: res.cefr,
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
