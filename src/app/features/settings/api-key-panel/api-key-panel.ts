/**
 * @file 設定ページの API キー入力パネル。settings.html から切り出したUIブロック。
 * 保存粒度はテーマ・モデル優先順位と異なり即時保存ではない。入力途中の値を永続化しないよう
 * apiKeyDraft に退避し、専用の保存ボタンを押したときのみ SettingsStoreService.saveSettings() で確定する。
 * API キーは入力時に normalizeApiKey() で空白・引用符を除去する（プレフィックスによる形式検査はしない。
 * 理由は api-key.util.ts 参照）。テンプレート側には課金が利用者負担である旨の注意を常時表示する。
 * 未保存の API キーは isDirty で検知する。親（settings.ts）は viewChild でこのコンポーネントを参照し、
 * isDirty() を canDeactivate()（settings.guard.ts）から読む。
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppSettings, SettingsStoreService } from '@core/settings/settings-store.service';
import { normalizeApiKey } from '@core/settings/api-key.util';
import { I18nService } from '@core/i18n/i18n.service';

@Component({
  selector: 'app-api-key-panel',
  imports: [RouterLink],
  templateUrl: './api-key-panel.html',
  styleUrl: './api-key-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApiKeyPanel {
  private settingsStore = inject(SettingsStoreService);
  protected i18n = inject(I18nService);

  // ── 状態管理（signal） ────────────────────────────────────────────
  // apiKey は常に「保存済みの真値」。編集中の値は apiKeyDraft 側にだけ入る。
  private apiKey = signal(this.settingsStore.getSettings().apiKey);
  apiKeyDraft = signal(this.apiKey());
  saved = signal(false);
  showKey = signal(false);

  // ── 未保存変更の検知（親の canDeactivate() から参照される） ─────────
  readonly isDirty = computed(() => this.apiKeyDraft() !== this.apiKey());

  // ── API キー（草稿のみ更新。保存は saveApiKey() でのみ行う） ───────
  updateApiKey(value: string) {
    // APIキーは貼り付け時に前後の空白・改行・引用符が混入しやすい。そのまま送信すると
    // Gemini 側で原因の分かりにくい 400 になるため、入力の時点で無害化しておく。
    this.apiKeyDraft.set(normalizeApiKey(value));
  }

  saveApiKey() {
    const updated: AppSettings = { ...this.settingsStore.getSettings(), apiKey: this.apiKeyDraft() };
    this.settingsStore.saveSettings(updated);
    this.apiKey.set(this.apiKeyDraft());
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }
}
