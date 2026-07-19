/**
 * @file 設定ページ。アカウント（Google SSO ログイン/同期）・API キー・モデル優先順位（ドラッグ&ドロップ）・テーマ切り替えを管理する。
 * 保存粒度は2種類。テーマとモデル優先順位は操作した時点で即時保存する。API キーだけは
 * 入力途中の値を永続化しないよう apiKeyDraft に退避し、専用の保存ボタンを押したときのみ確定する。
 * settings signal は常に「保存済みの真値」を保持するため、即時保存が API キー草稿を巻き込むことはない。
 * API キーは入力時に normalizeApiKey() で空白・引用符を除去する（プレフィックスによる形式検査はしない。
 * 理由は api-key.util.ts 参照）。テンプレート側には課金が利用者負担である旨の注意を常時表示する。
 * 未保存の API キーは isDirty で検知し、保存ボタンの強調表示と離脱時の確認ダイアログ（settings.guard.ts）に使う。
 * 選択可能なモデル一覧は gemini-models.constants.ts を共用する（settings-store.service.ts のデフォルト優先順位と同一ソース）。
 * 末尾に法的情報（プライバシーポリシー・利用規約・免責事項、pages/legal）への導線を持つ。
 * バージョン情報の直下にGitHubリポジトリへの外部リンクを表示する（githubUrl）。
 * バージョン情報のすぐ下に「リリースノートを見る」の開閉導線を持つ。ReleaseNotesService.getAllNotes()
 * で CHANGELOG.md 全件を取得し、初回展開時のみ fetch して allNotes にキャッシュする
 * （app.ts の新機能モーダルとは独立で、既読バージョンの状態には影響しない）。
 * 表示言語（テーマの直下）も即時保存対象。updateLanguage() は I18nService.setLang() で即時反映しつつ
 * settings signal を更新して persist() する（updateTheme() と同じ即時保存パターン）。
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppSettings, SettingsStoreService } from '@core/settings/settings-store.service';
import { normalizeApiKey } from '@core/settings/api-key.util';
import { AuthService } from '@core/firebase/auth.service';
import { GEMINI_MODELS } from '@core/gemini/gemini-models.constants';
import { I18nService } from '@core/i18n/i18n.service';
import { ReleaseNotesService, ReleaseNoteEntry } from '@core/release-notes/release-notes.service';
import { APP_VERSION, RELEASE_DATE } from '../../../version';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, RouterLink],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  private settingsStore = inject(SettingsStoreService);
  private auth = inject(AuthService);
  protected i18n = inject(I18nService);
  private releaseNotes = inject(ReleaseNotesService);

  // ── アカウント（Google SSO） ──────────────────────────────────────
  readonly user = this.auth.user;
  // 非許可ユーザーのログイン拒否メッセージ（ホワイトリスト制。auth.service.ts が設定）
  readonly loginError = this.auth.loginError;
  authBusy = signal(false);

  async login() {
    this.authBusy.set(true);
    try {
      await this.auth.login();
    } catch (err) {
      console.error('[Settings] ログインに失敗:', err);
    } finally {
      this.authBusy.set(false);
    }
  }

  async logout() {
    this.authBusy.set(true);
    try {
      await this.auth.logout();
    } finally {
      this.authBusy.set(false);
    }
  }

  // ── バージョン情報（version.ts はビルド時に自動生成）／GitHubリポジトリ導線 ──
  readonly version = APP_VERSION;
  readonly releaseDate = RELEASE_DATE;
  readonly githubUrl = 'https://github.com/rmatsuo-jp/eibun-lab';

  // ── リリースノート一覧（開いたときのみ fetch し、以後はキャッシュする） ──
  protected showAllNotes = signal(false);
  protected allNotes = signal<ReleaseNoteEntry[] | null>(null);

  async toggleAllNotes() {
    this.showAllNotes.update((v) => !v);
    if (this.showAllNotes() && this.allNotes() === null) {
      this.allNotes.set(await this.releaseNotes.getAllNotes());
    }
  }

  readonly models = GEMINI_MODELS;

  // ── 状態管理（signal） ────────────────────────────────────────────
  // settings は常に「保存済みの真値」。編集中の API キーは apiKeyDraft 側にだけ入る。
  settings = signal<AppSettings>(this.initSettings());
  apiKeyDraft = signal(this.settings().apiKey);
  saved = signal(false);
  showKey = signal(false);

  // ── 未保存変更の検知（API キーのみが対象。テーマ・モデル順は即時保存されるため常に保存済み） ──
  isDirty = computed(() => this.apiKeyDraft() !== this.settings().apiKey);

  // ── モデル優先順位のドラッグ&ドロップ並び替え ────────────────────
  private dragIndex = signal<number | null>(null);

  private initSettings(): AppSettings {
    const saved = this.settingsStore.getSettings();
    const validIds = this.models.map((m) => m.value);
    // 保存済み優先順位から未知のモデルIDを除外し、models にあって欠落しているIDを末尾に補完する。
    const known = saved.modelPriority.filter((id) => validIds.includes(id));
    const missing = validIds.filter((id) => !known.includes(id));
    saved.modelPriority = [...known, ...missing];
    return saved;
  }

  modelLabel(modelId: string): string {
    return this.models.find((m) => m.value === modelId)?.label ?? modelId;
  }

  onDragStart(index: number) {
    this.dragIndex.set(index);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onDrop(index: number) {
    const from = this.dragIndex();
    this.dragIndex.set(null);
    if (from === null || from === index) return;
    this.settings.update((s) => {
      const modelPriority = [...s.modelPriority];
      const [moved] = modelPriority.splice(from, 1);
      modelPriority.splice(index, 0, moved);
      return { ...s, modelPriority };
    });
    this.persist();
  }

  // ── テーマ（即時保存。DOM への反映と永続化を同時に行う） ──────────
  updateTheme(theme: AppSettings['theme']) {
    document.documentElement.dataset['theme'] = theme;
    this.settings.update((s) => ({ ...s, theme }));
    this.persist();
  }

  // ── 表示言語（即時保存。I18nService への反映と永続化を同時に行う） ──
  updateLanguage(language: AppSettings['language']) {
    this.i18n.setLang(language);
    this.settings.update((s) => ({ ...s, language }));
    this.persist();
  }

  // ── API キー（草稿のみ更新。保存は saveApiKey() でのみ行う） ───────
  updateApiKey(value: string) {
    // APIキーは貼り付け時に前後の空白・改行・引用符が混入しやすい。そのまま送信すると
    // Gemini 側で原因の分かりにくい 400 になるため、入力の時点で無害化しておく。
    this.apiKeyDraft.set(normalizeApiKey(value));
  }

  saveApiKey() {
    this.settings.update((s) => ({ ...s, apiKey: this.apiKeyDraft() }));
    this.persist();
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }

  // settings() は保存済みの真値のみを持つため、テーマ・モデル順の即時保存で
  // 未確定の apiKeyDraft が漏れて永続化されることはない。
  private persist() {
    this.settingsStore.saveSettings(this.settings());
  }

  // ── 他ページへの遷移時に未保存の API キーを警告（settings.guard.ts から呼ばれる） ──
  canDeactivate(): boolean {
    if (!this.isDirty()) return true;
    return window.confirm(this.i18n.t('settings.confirmLeave'));
  }
}
