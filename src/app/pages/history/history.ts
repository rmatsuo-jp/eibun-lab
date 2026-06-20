/**
 * @file 過去の添削セッション一覧ページ。
 * セッションの表示・複数選択削除・展開、日付ソート、キーワード検索、JSON インポート/エクスポートを提供する。
 * StorageService の sessions signal を直接参照し、データ変更を自動反映する。
 */
import { Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { StorageService } from '../../services/storage.service';
import { CorrectionSession } from '../../models/session.model';

@Component({
  selector: 'app-history',
  imports: [FormsModule],
  templateUrl: './history.html',
  styleUrl: './history.scss',
})
export class History {
  private storage = inject(StorageService);
  private sanitizer = inject(DomSanitizer);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // ── 状態管理（signal） ────────────────────────────────────────────
  readonly sessions = this.storage.sessions;
  expandedId = signal<string | null>(null);
  selectionMode = signal(false);
  selectedIds = signal<string[]>([]);
  sortOrder = signal<'asc' | 'desc'>('desc');
  searchQuery = signal('');

  // ── 検索フィルタ → 日付ソートの順で派生（元文・添削文・ミス表現を横断検索） ─
  filteredSessions = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const filtered = q
      ? this.sessions().filter(s =>
          s.original.toLowerCase().includes(q) ||
          s.corrected.toLowerCase().includes(q) ||
          s.mistakes.some(m =>
            m.original.toLowerCase().includes(q) ||
            m.corrected.toLowerCase().includes(q)
          )
        )
      : this.sessions();
    return [...filtered].sort((a, b) => {
      const diff = a.date.localeCompare(b.date);
      return this.sortOrder() === 'asc' ? diff : -diff;
    });
  });

  toHtml(markdown: string): SafeHtml {
    const html = marked.parse(markdown) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  toggle(id: string) {
    if (this.selectionMode()) return;
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  toggleSort() {
    this.sortOrder.set(this.sortOrder() === 'desc' ? 'asc' : 'desc');
  }

  toggleSelectionMode() {
    const next = !this.selectionMode();
    this.selectionMode.set(next);
    if (!next) this.selectedIds.set([]);
  }

  // ── 複数選択（Set ではなく配列で Signal の変化検知を保証） ─────
  toggleSelect(id: string, event: Event) {
    event.stopPropagation();
    const ids = this.selectedIds();
    this.selectedIds.set(
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    );
  }

  isSelected(id: string): boolean {
    return this.selectedIds().includes(id);
  }

  deleteSelected() {
    const ids = this.selectedIds();
    if (ids.length === 0) return;
    if (!confirm(`${ids.length}件の履歴を削除しますか？この操作は元に戻せません。`)) return;
    ids.forEach(id => this.storage.deleteSession(id));
    this.selectedIds.set([]);
    this.selectionMode.set(false);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  }

  // ── インポート / エクスポート ──────────────────────────────────────
  triggerImport() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!Array.isArray(parsed)) {
          alert('配列形式のJSONを指定してください');
          return;
        }
        const valid = parsed.filter(
          (s: unknown) => {
            const session = s as Record<string, unknown>;
            return session['id'] && session['date'] && session['original'] !== undefined &&
              session['corrected'] !== undefined && Array.isArray(session['mistakes']);
          }
        );
        this.storage.importSessions(valid as CorrectionSession[]);
      } catch {
        alert('JSONの形式が正しくありません');
      }
      (event.target as HTMLInputElement).value = '';
    };
    reader.readAsText(file);
  }

  exportJson() {
    const blob = new Blob([this.storage.exportSessions()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `history_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
