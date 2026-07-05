/**
 * @file 英作文入力・添削結果表示ページ。
 * 状態（入力テキスト・添削結果・ローディング）は PracticeState サービスが保持するため、
 * タブ遷移でコンポーネントが破棄されても消えない。本コンポーネントは表示と入力の橋渡しに専念する。
 */
import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { renderSafeMarkdown } from '../../utils/markdown.util';
import { buildBulkTemplateJson, buildBulkTemplateFromSessions, parseBulkImportJson } from '../../utils/bulk-import.util';
import { formatTimestampForFilename } from '../../utils/date.util';
import { StorageService } from '../../services/storage.service';
import { PracticeState } from './practice-state.service';

@Component({
  selector: 'app-practice',
  imports: [FormsModule],
  templateUrl: './practice.html',
  styleUrl: './practice.scss',
})
export class Practice {
  // ── 状態はサービスへ委譲（テンプレートから state.xxx で参照） ──────
  state = inject(PracticeState);
  private sanitizer = inject(DomSanitizer);
  private storage = inject(StorageService);

  @ViewChild('bulkFileInput') bulkFileInput!: ElementRef<HTMLInputElement>;

  constructor() {
    // 添削タブを開いた時点で完了通知は役目を終えるので消す（ページ内に結果が見えるため）。
    if (this.state.notice()?.status === 'success') {
      this.state.dismissNotice();
    }
  }

  toHtml(markdown: string): SafeHtml {
    // marked → DOMPurify でサニタイズした HTML のみ信頼済みとして渡す。
    return this.sanitizer.bypassSecurityTrustHtml(renderSafeMarkdown(markdown));
  }

  // ── 一括添削: テンプレートダウンロード / JSONアップロード ──────────
  downloadTemplate() {
    const blob = new Blob([buildBulkTemplateJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bulk_template_${formatTimestampForFilename()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  downloadHistoryAsTemplate() {
    const json = buildBulkTemplateFromSessions(this.storage.sessions());
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bulk_from_history_${formatTimestampForFilename()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  triggerBulkUpload() {
    this.bulkFileInput.nativeElement.click();
  }

  onBulkFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const { entries, errors } = parseBulkImportJson(reader.result as string);
      this.state.setBulkEntries(entries);
      if (errors.length > 0) {
        alert(`一部のデータを読み込めませんでした:\n${errors.join('\n')}`);
      }
      (event.target as HTMLInputElement).value = '';
    };
    reader.readAsText(file);
  }

  runBulk() {
    this.state.submitBulk();
  }
}
