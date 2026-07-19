/**
 * @file 設定ページのオーケストレーター。API キー・モデル優先順位・リリースノート・アカウントは
 * それぞれ api-key-panel / model-priority-panel / release-notes-panel / account-panel に切り出し済み。
 * テーマ・表示言語・法的情報導線・GitHubリポジトリ導線は小規模なためこのファイルに残す。
 * テーマ・表示言語は操作した時点で即時保存する（settings signal は常に「保存済みの真値」）。
 * updateLanguage() は I18nService.setLang() で即時反映しつつ settings signal を更新して
 * persist() する（updateTheme() と同じ即時保存パターン）。
 * 未保存の API キーは api-key-panel が isDirty として保持する。canDeactivate()（settings.guard.ts から
 * 呼ばれる）はその子コンポーネントを viewChild で参照し、isDirty() を読んで離脱時の確認ダイアログに使う。
 * 末尾に法的情報（プライバシーポリシー・利用規約・免責事項、pages/legal）への導線を持つ。
 * バージョン情報の直下にGitHubリポジトリへの外部リンクを表示する（githubUrl）。
 */
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppSettings, SettingsStoreService } from '@core/settings/settings-store.service';
import { I18nService } from '@core/i18n/i18n.service';
import { ApiKeyPanel } from './api-key-panel/api-key-panel';
import { ModelPriorityPanel } from './model-priority-panel/model-priority-panel';
import { ReleaseNotesPanel } from './release-notes-panel/release-notes-panel';
import { AccountPanel } from './account-panel/account-panel';

@Component({
  selector: 'app-settings',
  imports: [RouterLink, ApiKeyPanel, ModelPriorityPanel, ReleaseNotesPanel, AccountPanel],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  private settingsStore = inject(SettingsStoreService);
  protected i18n = inject(I18nService);

  // ── GitHubリポジトリ導線 ───────────────────────────────────────
  readonly githubUrl = 'https://github.com/rmatsuo-jp/eibun-lab';

  // ── 未保存の API キー変更を検知するため、api-key-panel を参照する ──
  private apiKeyPanel = viewChild.required(ApiKeyPanel);

  // ── 状態管理（signal） ────────────────────────────────────────────
  settings = signal<AppSettings>(this.settingsStore.getSettings());

  // ── テーマ（即時保存。DOM への反映と永続化を同時に行う） ──────────
  // api-key-panel / model-priority-panel が独立して保存を行うため、保存直前に
  // ストアから最新値を読み直してから theme のみを上書きする（他パネルの変更を巻き戻さないため）。
  updateTheme(theme: AppSettings['theme']) {
    document.documentElement.dataset['theme'] = theme;
    this.persist({ ...this.settingsStore.getSettings(), theme });
  }

  // ── 表示言語（即時保存。I18nService への反映と永続化を同時に行う） ──
  updateLanguage(language: AppSettings['language']) {
    this.i18n.setLang(language);
    this.persist({ ...this.settingsStore.getSettings(), language });
  }

  private persist(next: AppSettings) {
    this.settings.set(next);
    this.settingsStore.saveSettings(next);
  }

  // ── 他ページへの遷移時に未保存の API キーを警告（settings.guard.ts から呼ばれる） ──
  canDeactivate(): boolean {
    if (!this.apiKeyPanel().isDirty()) return true;
    return window.confirm(this.i18n.t('settings.confirmLeave'));
  }
}
