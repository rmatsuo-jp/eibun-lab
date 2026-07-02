/**
 * @file 設定ページ。アカウント（Google SSO ログイン/同期）・API キー・モデル優先順位（ドラッグ&ドロップ）・テーマ切り替えを管理する。
 * 未保存の変更は isDirty で検知し、保存ボタンの強調表示と離脱時の確認ダイアログ（settings.guard.ts）に使う。
 */
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StorageService, AppSettings } from '../../services/storage.service';
import { AuthService } from '../../services/auth.service';
import { APP_VERSION, RELEASE_DATE } from '../../../version';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  private storage = inject(StorageService);
  private auth = inject(AuthService);

  // ── アカウント（Google SSO） ──────────────────────────────────────
  readonly user = this.auth.user;
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

  // ── バージョン情報（version.ts はビルド時に自動生成） ──
  readonly version = APP_VERSION;
  readonly releaseDate = RELEASE_DATE;

  readonly models = [
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { value: 'gemini-3-flash', label: 'Gemini 3 Flash' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  ];

  // ── 状態管理（signal） ────────────────────────────────────────────
  settings = signal<AppSettings>(this.initSettings());
  saved = signal(false);
  showKey = signal(false);

  // ── 未保存変更の検知（保存済み内容とのスナップショット比較） ──────
  private savedSnapshot = signal<AppSettings>(this.settings());
  isDirty = computed(() => JSON.stringify(this.settings()) !== JSON.stringify(this.savedSnapshot()));

  // ── モデル優先順位のドラッグ&ドロップ並び替え ────────────────────
  private dragIndex = signal<number | null>(null);

  private initSettings(): AppSettings {
    const saved = this.storage.getSettings();
    const validIds = this.models.map(m => m.value);
    // 保存済み優先順位から未知のモデルIDを除外し、models にあって欠落しているIDを末尾に補完する。
    const known = saved.modelPriority.filter(id => validIds.includes(id));
    const missing = validIds.filter(id => !known.includes(id));
    saved.modelPriority = [...known, ...missing];
    return saved;
  }

  modelLabel(modelId: string): string {
    return this.models.find(m => m.value === modelId)?.label ?? modelId;
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
    this.settings.update(s => {
      const modelPriority = [...s.modelPriority];
      const [moved] = modelPriority.splice(from, 1);
      modelPriority.splice(index, 0, moved);
      return { ...s, modelPriority };
    });
  }

  update(field: keyof AppSettings, value: string | boolean) {
    this.settings.update(s => ({ ...s, [field]: value }));
    if (field === 'theme') {
      document.documentElement.dataset['theme'] = value as string;
    }
  }

  save() {
    this.storage.saveSettings(this.settings());
    this.savedSnapshot.set(this.settings());
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }

  // ── 他ページへの遷移時に未保存の変更を警告（settings.guard.ts から呼ばれる） ──
  canDeactivate(): boolean {
    if (!this.isDirty()) return true;
    return window.confirm('保存されていない変更があります。移動しますか？');
  }
}
