/**
 * @file 設定ページのモデル優先順位パネル（ドラッグ&ドロップ並び替え）。settings.html から切り出したUIブロック。
 * 選択可能なモデル一覧は gemini-models.constants.ts を共用する（settings-store.service.ts のデフォルト優先順位と同一ソース）。
 * 並び替えは操作時に即時保存する。永続化は SettingsStoreService.saveSettings() 経由で行う。
 */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AppSettings, SettingsStoreService } from '@core/settings/settings-store.service';
import { GEMINI_MODELS } from '@core/gemini/gemini-models.constants';
import { I18nService } from '@core/i18n/i18n.service';

@Component({
  selector: 'app-model-priority-panel',
  imports: [],
  templateUrl: './model-priority-panel.html',
  styleUrl: './model-priority-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelPriorityPanel {
  private settingsStore = inject(SettingsStoreService);
  protected i18n = inject(I18nService);

  readonly models = GEMINI_MODELS;

  settings = signal<AppSettings>(this.initSettings());

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
    const modelPriority = [...this.settings().modelPriority];
    const [moved] = modelPriority.splice(from, 1);
    modelPriority.splice(index, 0, moved);
    this.settings.update((s) => ({ ...s, modelPriority }));
    this.persist(modelPriority);
  }

  // api-key-panel / settings.ts（テーマ・表示言語）が独立して保存を行うため、保存直前に
  // ストアから最新値を読み直してから modelPriority のみを上書きする（他パネルの変更を巻き戻さないため）。
  private persist(modelPriority: string[]) {
    this.settingsStore.saveSettings({ ...this.settingsStore.getSettings(), modelPriority });
  }
}
