/**
 * @file 過去の添削セッション一覧ページ。
 * 集計・表示データの組み立て・インポート/エクスポートは HistoryState サービスに委譲する
 * （テンプレートから state.xxx で参照）。本コンポーネントはファイル選択トリガー・
 * confirm/alertダイアログ・Blobダウンロードなど DOM 操作のみに専念する
 * （practice.ts/PracticeState、mistakes.ts/MistakesState と同じ設計）。
 */
import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { formatTimestampForFilename } from '@shared/utils/date.util';
import { downloadJson, readTextFile } from '@shared/utils/file-transfer.util';
import { I18nService } from '@core/i18n/i18n.service';
import { Badge } from '@shared/ui/badge/badge';
import { HistoryCalendar } from './history-calendar/history-calendar';
import { HistoryState } from './history-state.service';

@Component({
  selector: 'app-history',
  imports: [FormsModule, NgTemplateOutlet, HistoryCalendar, Badge],
  templateUrl: './history.html',
  styleUrl: './history.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class History {
  protected state = inject(HistoryState);
  protected i18n = inject(I18nService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  deleteSelected() {
    const ids = this.state.selectedIds();
    if (ids.length === 0) return;
    if (!confirm(this.i18n.t('history.confirmDelete', { count: ids.length }))) return;
    this.state.deleteSessions(ids);
  }

  // ── インポート / エクスポート ──────────────────────────────────────
  triggerImport() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event) {
    readTextFile(event, (text) => {
      const result = this.state.importFromJson(text);
      if (!result.ok) {
        alert(
          this.i18n.t(
            result.reason === 'not-array' ? 'history.alertArrayJson' : 'history.alertInvalidJson',
          ),
        );
      }
    });
  }

  exportJson() {
    downloadJson(`history_${formatTimestampForFilename()}.json`, this.state.exportJson());
  }
}
