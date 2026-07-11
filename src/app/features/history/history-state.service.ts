/**
 * @file 履歴ページの状態・集計・インポート/エクスポートロジックを保持するシングルトンサービス。
 * SessionRepositoryService への参照はこのサービス内に閉じ、history.ts はテンプレートとの橋渡し・
 * DOM操作（ファイル選択トリガー、confirm/alertダイアログ、Blobダウンロード）のみに専念する
 * （drill/mistakesの{feature}-state.serviceと同じ設計）。
 * HTMLキャッシュは言語＋項目ごとに保持し、言語切替時に別セッション・別項目の内容が誤って再利用されないようにする。
 */
import { Injectable, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { renderSafeMarkdown } from '@shared/utils/markdown.util';
import { toDayKey } from '@shared/utils/date.util';
import { SessionRepositoryService } from '@core/sessions/session-repository.service';
import { CorrectionSession, Mistake } from '@core/models/session.model';
import { I18nService } from '@core/i18n/i18n.service';
import {
  localizedCategory,
  localizedField,
  localizedProse,
} from '@core/i18n/localized-session.util';
import { PROSE_FIELDS } from '@core/i18n/prose-fields.util';
import { GEMINI_MODELS } from '@core/gemini/gemini-models.constants';

@Injectable({ providedIn: 'root' })
export class HistoryState {
  private repository = inject(SessionRepositoryService);
  private sanitizer = inject(DomSanitizer);
  private i18n = inject(I18nService);

  // ── 状態管理（signal） ────────────────────────────────────────────
  readonly sessions = this.repository.sessions;
  expandedId = signal<string | null>(null);
  selectionMode = signal(false);
  selectedIds = signal<string[]>([]);
  sortOrder = signal<'asc' | 'desc'>('desc');
  searchQuery = signal('');

  // ── 日付フィルタ（history-calendar の dateSelected 出力で更新） ──────
  selectedDate = signal<string | null>(null);

  // ── 日付フィルタ → 検索フィルタ → 日付ソートの順で派生（元文・添削文・ミス表現を横断検索） ─
  // カレンダーで日付を選んでいれば、まずその日のセッションに絞り込んでから検索フィルタを適用する（AND条件）。
  filteredSessions = computed(() => {
    const selectedDate = this.selectedDate();
    const base = selectedDate
      ? this.sessions().filter((s) => toDayKey(s.date) === selectedDate)
      : this.sessions();

    const q = this.searchQuery().trim().toLowerCase();
    const filtered = q
      ? base.filter(
          (s) =>
            s.original.toLowerCase().includes(q) ||
            s.corrected.toLowerCase().includes(q) ||
            s.mistakes.some(
              (m) => m.original.toLowerCase().includes(q) || m.corrected.toLowerCase().includes(q),
            ),
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
    return this.cachedHtml(
      `legacy:${session.id}:${this.i18n.lang()}`,
      localizedProse(session, this.i18n.lang()),
    );
  }

  // 解説5項目を、抽出できたものだけ見出し付きで返す。1項目もタグ抽出できていない旧データの場合は
  // 空配列を返すので、テンプレート側で toHtml() の単一ブロックにフォールバックする。
  proseSections(session: CorrectionSession): { heading: string; html: SafeHtml }[] {
    const lang = this.i18n.lang();
    return PROSE_FIELDS.map((f) => {
      const text = localizedField(session[f.ja], session[f.en], lang);
      return text
        ? {
            heading: this.i18n.t(f.headingKey),
            html: this.cachedHtml(`${session.id}:${lang}:${f.ja}`, text),
          }
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

  // 添削に使用されたモデルの人間可読ラベルを返す。GEMINI_MODELS に見つからない場合（廃止モデル等）は
  // 生のモデルIDへフォールバックする。
  modelLabel(modelId: string): string {
    return GEMINI_MODELS.find((m) => m.value === modelId)?.label ?? modelId;
  }

  toggle(id: string) {
    if (this.selectionMode()) return;
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  toggleSort() {
    this.sortOrder.set(this.sortOrder() === 'desc' ? 'asc' : 'desc');
  }

  // ── カレンダーからの日付選択（history-calendar の dateSelected 出力から呼ばれる） ──
  onDateSelected(dayKey: string | null) {
    this.selectedDate.set(dayKey);
    this.expandedId.set(null);
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
    this.selectedIds.set(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  }

  isSelected(id: string): boolean {
    return this.selectedIds().includes(id);
  }

  selectAll() {
    this.selectedIds.set(this.filteredSessions().map((s) => s.id));
  }

  deselectAll() {
    this.selectedIds.set([]);
  }

  // confirmダイアログの表示自体は component 層（DOM操作）に残し、このメソッドは削除の実行のみ担う。
  deleteSessions(ids: string[]) {
    ids.forEach((id) => this.repository.deleteSession(id));
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
  // JSON文字列を検証してから取り込む。壊れたJSON・非配列は呼び出し側にエラー種別を返す
  // （alert表示はDOM操作のためcomponent層に残す）。
  importFromJson(
    jsonText: string,
  ): { ok: true } | { ok: false; reason: 'not-array' | 'invalid-json' } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return { ok: false, reason: 'invalid-json' };
    }
    if (!Array.isArray(parsed)) return { ok: false, reason: 'not-array' };
    const valid = parsed.filter((s: unknown) => {
      const session = s as Record<string, unknown>;
      return (
        session['id'] &&
        session['date'] &&
        session['original'] !== undefined &&
        session['corrected'] !== undefined &&
        Array.isArray(session['mistakes'])
      );
    });
    this.repository.importSessions(valid as CorrectionSession[]);
    return { ok: true };
  }

  exportJson(): string {
    return this.repository.exportSessions();
  }
}
