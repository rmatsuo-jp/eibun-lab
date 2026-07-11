/**
 * @file 過去の添削セッション一覧ページ。
 * ページ上部に月表示のカレンダー（添削済みの日を総合スコア/CEFR表示。評価が無い旧データはドット表示）を常設し、その下にセッション一覧を表示する単一画面構成。
 * カレンダーで日付を選ぶと一覧がその日だけに絞り込まれ（キーワード検索と併用可）、複数選択削除・展開表示・日付ソート・JSON インポート/エクスポートも提供する。
 * セッションカードは折りたたみ状態でも総合スコア/CEFRバッジを表示する。
 * SessionRepositoryService の sessions signal を直接参照し、データ変更を自動反映する。
 * 添削解説5項目（proseSections）・ミスのカテゴリ（categoryText）は i18n.lang() に追随して表示言語が切り替わる
 * （英語版が無い旧セッションは core/i18n/localized-session.util.ts のフォールバックで日本語表示のまま）。
 * 解説5項目は1タグずつ独立抽出されているため、1項目が欠けても他の項目は正常表示される。5項目が
 * 1つも無い旧データのみ toHtml() で corrected/correctedEn の単一ブロックにフォールバックする。
 * HTMLキャッシュは言語＋項目ごとに保持し、言語切替時に別セッション・別項目の内容が誤って再利用されないようにする。
 */
import { Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { renderSafeMarkdown } from '@shared/utils/markdown.util';
import { formatTimestampForFilename, toDayKey } from '@shared/utils/date.util';
import { SessionRepositoryService } from '@core/sessions/session-repository.service';
import { CorrectionSession, Mistake, WritingEvaluation } from '@core/models/session.model';
import { I18nService } from '@core/i18n/i18n.service';
import { localizedCategory, localizedField, localizedProse } from '@core/i18n/localized-session.util';
import { PROSE_FIELDS } from '@core/i18n/prose-fields.util';

interface CalendarCell {
  date: Date;
  dayKey: string;
  inMonth: boolean;
  hasSession: boolean;
  isToday: boolean;
  evaluation?: WritingEvaluation;
}

@Component({
  selector: 'app-history',
  imports: [FormsModule, NgTemplateOutlet],
  templateUrl: './history.html',
  styleUrl: './history.scss',
})
export class History {
  private repository = inject(SessionRepositoryService);
  private sanitizer = inject(DomSanitizer);
  protected i18n = inject(I18nService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // ── 状態管理（signal） ────────────────────────────────────────────
  readonly sessions = this.repository.sessions;
  expandedId = signal<string | null>(null);
  selectionMode = signal(false);
  selectedIds = signal<string[]>([]);
  sortOrder = signal<'asc' | 'desc'>('desc');
  searchQuery = signal('');

  // ── カレンダー表示（一覧の日付フィルタとして機能） ──────────────
  calendarMonth = signal<Date>(new Date());
  selectedDate = signal<string | null>(null);

  // 日付キー（YYYY-MM-DD）ごとにセッションをグルーピングし、カレンダー描画と日付クリック両方で使う。
  sessionsByDay = computed(() => {
    const map = new Map<string, CorrectionSession[]>();
    for (const s of this.sessions()) {
      const key = toDayKey(s.date);
      const list = map.get(key);
      if (list) list.push(s);
      else map.set(key, [s]);
    }
    return map;
  });

  // 表示月を含む週の日曜から、月末を含む週の土曜までのセルを生成する。
  calendarCells = computed<CalendarCell[]>(() => {
    const month = this.calendarMonth();
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstOfMonth = new Date(year, monthIndex, 1);
    const lastOfMonth = new Date(year, monthIndex + 1, 0);

    const start = new Date(firstOfMonth);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(lastOfMonth);
    end.setDate(end.getDate() + (6 - end.getDay()));

    const byDay = this.sessionsByDay();
    const todayKey = toDayKey(new Date().toISOString());

    const cells: CalendarCell[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const dayKey = toDayKey(cursor.toISOString());
      const daySessions = byDay.get(dayKey);
      cells.push({
        date: new Date(cursor),
        dayKey,
        inMonth: cursor.getMonth() === monthIndex,
        hasSession: byDay.has(dayKey),
        isToday: dayKey === todayKey,
        evaluation: daySessions?.at(-1)?.evaluation,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return cells;
  });

  weekdayLabels = computed(() =>
    this.i18n.lang() === 'en'
      ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      : ['日', '月', '火', '水', '木', '金', '土']
  );

  calendarMonthLabel = computed(() =>
    this.calendarMonth().toLocaleDateString(this.i18n.lang() === 'en' ? 'en-US' : 'ja-JP', { year: 'numeric', month: 'long' })
  );

  // ── 日付フィルタ → 検索フィルタ → 日付ソートの順で派生（元文・添削文・ミス表現を横断検索） ─
  // カレンダーで日付を選んでいれば、まずその日のセッションに絞り込んでから検索フィルタを適用する（AND条件）。
  filteredSessions = computed(() => {
    const selectedDate = this.selectedDate();
    const base = selectedDate ? (this.sessionsByDay().get(selectedDate) ?? []) : this.sessions();

    const q = this.searchQuery().trim().toLowerCase();
    const filtered = q
      ? base.filter(s =>
          s.original.toLowerCase().includes(q) ||
          s.corrected.toLowerCase().includes(q) ||
          s.mistakes.some(m =>
            m.original.toLowerCase().includes(q) ||
            m.corrected.toLowerCase().includes(q)
          )
        )
      : base;
    return [...filtered].sort((a, b) => {
      const diff = a.date.localeCompare(b.date);
      return this.sortOrder() === 'asc' ? diff : -diff;
    });
  });

  // セッションID＋表示言語単位でキャッシュし、[innerHTML] へ毎回同じ参照を返す。
  // 参照が変わるとテンプレート再評価のたびに innerHTML が再設定され、
  // ユーザーがドラッグ選択したテキストが消えてしまうため。言語をキーに含めるのは、
  // 言語トグル時に前の言語のHTMLが誤って使い回されないようにするため。
  private htmlCache = new Map<string, SafeHtml>();

  toHtml(session: CorrectionSession): SafeHtml {
    return this.cachedHtml(`legacy:${session.id}:${this.i18n.lang()}`, localizedProse(session, this.i18n.lang()));
  }

  // 解説5項目を、抽出できたものだけ見出し付きで返す。1項目もタグ抽出できていない旧データの場合は
  // 空配列を返すので、テンプレート側で toHtml() の単一ブロックにフォールバックする。
  proseSections(session: CorrectionSession): { heading: string; html: SafeHtml }[] {
    const lang = this.i18n.lang();
    return PROSE_FIELDS.map((f) => {
      const text = localizedField(session[f.ja], session[f.en], lang);
      return text
        ? { heading: this.i18n.t(f.headingKey), html: this.cachedHtml(`${session.id}:${lang}:${f.ja}`, text) }
        : undefined;
    }).filter((s): s is { heading: string; html: SafeHtml } => !!s);
  }

  private cachedHtml(cacheKey: string, markdown: string): SafeHtml {
    let html = this.htmlCache.get(cacheKey);
    if (!html) {
      // marked → DOMPurify でサニタイズした HTML のみ信頼済みとして渡す。
      html = this.sanitizer.bypassSecurityTrustHtml(renderSafeMarkdown(markdown));
      this.htmlCache.set(cacheKey, html);
    }
    return html;
  }

  categoryText(m: Mistake): string {
    return localizedCategory(m, this.i18n);
  }

  toggle(id: string) {
    if (this.selectionMode()) return;
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  toggleSort() {
    this.sortOrder.set(this.sortOrder() === 'desc' ? 'asc' : 'desc');
  }

  // ── カレンダー操作 ────────────────────────────────────────────────
  prevMonth() {
    const m = this.calendarMonth();
    this.calendarMonth.set(new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  nextMonth() {
    const m = this.calendarMonth();
    this.calendarMonth.set(new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  selectDay(dayKey: string) {
    this.selectedDate.set(this.selectedDate() === dayKey ? null : dayKey);
    this.expandedId.set(null);
  }

  clearDateFilter() {
    this.selectedDate.set(null);
  }

  formatDayKey(dayKey: string): string {
    return this.formatDate(new Date(dayKey).toISOString());
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

  selectAll() {
    this.selectedIds.set(this.filteredSessions().map(s => s.id));
  }

  deselectAll() {
    this.selectedIds.set([]);
  }

  deleteSelected() {
    const ids = this.selectedIds();
    if (ids.length === 0) return;
    if (!confirm(this.i18n.t('history.confirmDelete', { count: ids.length }))) return;
    ids.forEach(id => this.repository.deleteSession(id));
    this.selectedIds.set([]);
    this.selectionMode.set(false);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(this.i18n.lang() === 'en' ? 'en-US' : 'ja-JP', {
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
          alert(this.i18n.t('history.alertArrayJson'));
          return;
        }
        const valid = parsed.filter(
          (s: unknown) => {
            const session = s as Record<string, unknown>;
            return session['id'] && session['date'] && session['original'] !== undefined &&
              session['corrected'] !== undefined && Array.isArray(session['mistakes']);
          }
        );
        this.repository.importSessions(valid as CorrectionSession[]);
      } catch {
        alert(this.i18n.t('history.alertInvalidJson'));
      }
      (event.target as HTMLInputElement).value = '';
    };
    reader.readAsText(file);
  }

  exportJson() {
    const blob = new Blob([this.repository.exportSessions()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `history_${formatTimestampForFilename()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
