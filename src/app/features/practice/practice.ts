/**
 * @file 英作文入力・添削結果表示ページ。
 * 状態（入力テキスト・添削結果・ローディング）は PracticeState サービスが保持するため、
 * タブ遷移でコンポーネントが破棄されても消えない。本コンポーネントは表示と入力の橋渡しに専念する。
 * 添削中はストリーミング実測の進捗バーを表示し、「クイズで待つ」で WaitingQuiz（待機中ミニクイズ）へ切り替える。
 * 一括添削の実行前には、送信件数（＝API 呼び出し回数）と課金の可能性を confirm で確認する。
 * Gemini API キーが未設定のときは設定ページへの誘導バナーを出し、添削ボタンを無効化する
 * （SettingsStoreService.hasApiKey を購読するため、キー保存と同時に誘導が消える）。
 */
import { Component, ElementRef, ViewChild, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SettingsStoreService } from '@core/settings/settings-store.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { renderSafeMarkdown } from '@shared/utils/markdown.util';
import { buildBulkTemplateJson, buildBulkTemplateFromSessions, parseBulkImportJson } from './bulk-import.util';
import { formatTimestampForFilename } from '@shared/utils/date.util';
import { SessionRepositoryService } from '@core/sessions/session-repository.service';
import { getReviewItems } from '@core/stats/session-stats.util';
import { PracticeState } from './practice-state.service';
import { WaitingQuiz } from './waiting-quiz/waiting-quiz';

@Component({
  selector: 'app-practice',
  imports: [FormsModule, RouterLink, WaitingQuiz],
  templateUrl: './practice.html',
  styleUrl: './practice.scss',
})
export class Practice {
  // ── 状態はサービスへ委譲（テンプレートから state.xxx で参照） ──────
  state = inject(PracticeState);
  // テンプレートが hasApiKey() を購読するため public。
  settingsStore = inject(SettingsStoreService);
  private sanitizer = inject(DomSanitizer);
  private repository = inject(SessionRepositoryService);

  @ViewChild('bulkFileInput') bulkFileInput!: ElementRef<HTMLInputElement>;

  // 復習カードが1件も無い（＝初回ユーザー）と待機中クイズは出題できないため、「クイズで待つ」ボタン自体を隠す。
  hasReviewItems = computed(() => getReviewItems(this.repository.sessions()).length > 0);

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
    const json = buildBulkTemplateFromSessions(this.repository.sessions());
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

  // 一括添削は件数分の API 呼び出しになるため、意図しない大量送信・課金を防ぐ確認を挟む。
  // ダイアログはコンポーネント層に留め、PracticeState には UI を持ち込まない。
  runBulk() {
    const count = this.state.bulkEntries().length;
    if (count === 0) return;
    const ok = window.confirm(
      `${count}件の英文を Gemini API へ送信します（API 呼び出し ${count} 回分）。\n` +
        '無料枠を超えた分は課金対象となる場合があります。実行しますか？'
    );
    if (!ok) return;
    this.state.submitBulk();
  }
}
