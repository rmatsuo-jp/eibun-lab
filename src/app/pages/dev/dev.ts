/**
 * @file 開発者用ページ。Gemini との入出力ログ閲覧・添削後 HTML のライブプレビュー・buildPrompt() プレビュー・
 * localStorage 生データのダンプを行う。添削プロンプト改善や HTML 表示 UX の検証を目的とした開発専用タブ。
 */
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DevLogEntry, DevLogService } from '../../services/dev-log.service';
import { StorageService } from '../../services/storage.service';
import { buildPrompt } from '../../utils/prompt.util';
import { renderSafeMarkdown } from '../../utils/markdown.util';
import { copyToClipboard } from '../../utils/clipboard.util';

@Component({
  selector: 'app-dev',
  imports: [FormsModule, DatePipe],
  templateUrl: './dev.html',
  styleUrl: './dev.scss',
})
export class Dev {
  private devLog = inject(DevLogService);
  private storage = inject(StorageService);
  private sanitizer = inject(DomSanitizer);

  // ── a. 入出力ログ一覧 ──────────────────────────────────────────
  logs = this.devLog.logs;
  expandedId = signal<string | null>(null);

  toggleExpand(id: string) {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  clearLogs() {
    this.devLog.clear();
    this.expandedId.set(null);
  }

  sendToPreview(entry: DevLogEntry) {
    this.previewMarkdown.set(entry.parsed.corrected);
  }

  // ── b. 添削後 HTML ライブプレビュー ────────────────────────────
  previewMarkdown = signal('');
  previewHtml = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(renderSafeMarkdown(this.previewMarkdown()))
  );

  // ── c. buildPrompt() プレビュー ────────────────────────────────
  promptPreview = computed(() => buildPrompt());

  // ── d. localStorage 生データダンプ ─────────────────────────────
  showApiKey = signal(false);
  sessionsDump = computed(() => this.storage.exportSessions());
  settingsDump = computed(() => {
    const s = this.storage.getSettings();
    const masked = this.showApiKey() ? s.apiKey : this.maskKey(s.apiKey);
    return JSON.stringify({ ...s, apiKey: masked }, null, 2);
  });

  private maskKey(key: string): string {
    if (!key) return '';
    if (key.length <= 8) return '****';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }

  // ── 共通: クリップボードコピー（ボタンごとに一時的に「コピーしました」を表示） ─
  copiedKey = signal<string | null>(null);

  async copy(key: string, text: string) {
    await copyToClipboard(text);
    this.copiedKey.set(key);
    setTimeout(() => {
      if (this.copiedKey() === key) this.copiedKey.set(null);
    }, 1500);
  }

  json(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }
}
