/**
 * @file 設定ページのバージョン情報パネル。settings.html から切り出したUIブロック。
 * バージョン情報の直下に「リリースノートを見る」の開閉導線を持つ。ReleaseNotesService.getAllNotes()
 * で CHANGELOG.md 全件を取得し、初回展開時のみ fetch して allNotes にキャッシュする
 * （app.ts の新機能モーダルとは独立で、既読バージョンの状態には影響しない）。
 */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { ReleaseNotesService, ReleaseNoteEntry } from '@core/release-notes/release-notes.service';
import { APP_VERSION, RELEASE_DATE } from '../../../../version';

@Component({
  selector: 'app-release-notes-panel',
  imports: [],
  templateUrl: './release-notes-panel.html',
  styleUrl: './release-notes-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReleaseNotesPanel {
  protected i18n = inject(I18nService);
  private releaseNotes = inject(ReleaseNotesService);

  readonly version = APP_VERSION;
  readonly releaseDate = RELEASE_DATE;

  protected showAllNotes = signal(false);
  protected allNotes = signal<ReleaseNoteEntry[] | null>(null);

  async toggleAllNotes() {
    this.showAllNotes.update((v) => !v);
    if (this.showAllNotes() && this.allNotes() === null) {
      this.allNotes.set(await this.releaseNotes.getAllNotes());
    }
  }
}
