/**
 * @file 英作文入力・添削結果表示ページ。
 * 状態（入力テキスト・添削結果・ローディング）は PracticeState サービスが保持するため、
 * タブ遷移でコンポーネントが破棄されても消えない。本コンポーネントは表示と入力の橋渡しに専念する。
 * 添削中はストリーミング実測の進捗バーを表示し、「クイズで待つ」で WaitingQuiz（待機中ミニクイズ）へ切り替える。
 * 一括添削の実行前には、送信件数（＝API 呼び出し回数）と課金の可能性を confirm で確認する。
 * Gemini API キーが未設定のときは設定ページへの誘導バナーを出し、添削ボタンを無効化する
 * （SettingsStoreService.hasApiKey を購読するため、キー保存と同時に誘導が消える）。
 * 添削解説5項目（grammarNotes/naturalExpressions/grammarTendency/cefrRationale/studyPlan）・
 * ミス説明（explanation/explanationEn）は i18n.lang() に応じて core/i18n/localized-session.util.ts の
 * ヘルパーで表示言語を切り替える（英語版が無ければ日本語表示）。5項目は各タグが独立抽出されるため、
 * 1項目が undefined（生成失敗）でもその項目だけを非表示にし、他の項目・他のセクション（評価・ミス一覧等）には
 * 影響しない。5項目が1つも無い旧データ（generatedAtがproseタグ導入前のセッション）のみ、
 * corrected/correctedEn を単一ブロックとして表示するフォールバックを使う（proseSections() 参照）。
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
import { I18nService } from '@core/i18n/i18n.service';
import { localizedCategory, localizedExplanation, localizedField, localizedProse } from '@core/i18n/localized-session.util';
import { Mistake } from '@core/models/session.model';
import { PROSE_FIELDS, ProseSource } from '@core/i18n/prose-fields.util';
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
  protected i18n = inject(I18nService);
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

  // ── 添削解説・ミス説明・カテゴリの表示言語切替（英語版が無ければ日本語にフォールバック） ──
  proseText(source: { corrected: string; correctedEn?: string }): string {
    return localizedProse(source, this.i18n.lang());
  }

  // 解説5項目を、抽出できたものだけ見出し付きで返す。1項目もタグ抽出できていない旧データのみ、
  // 呼び出し側（テンプレート）が corrected/correctedEn の単一ブロックにフォールバックする。
  proseSections(source: ProseSource): { heading: string; text: string }[] {
    const lang = this.i18n.lang();
    return PROSE_FIELDS.map((f) => ({
      heading: this.i18n.t(f.headingKey),
      text: localizedField(source[f.ja], source[f.en], lang),
    })).filter((s): s is { heading: string; text: string } => !!s.text);
  }

  explanationText(m: Mistake): string {
    return localizedExplanation(m, this.i18n.lang());
  }

  categoryText(m: Mistake): string {
    return localizedCategory(m, this.i18n);
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
        alert(this.i18n.t('practice.bulk.alertPartial', { errors: errors.join('\n') }));
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
    const ok = window.confirm(this.i18n.t('practice.bulk.confirm', { count }));
    if (!ok) return;
    this.state.submitBulk();
  }
}
