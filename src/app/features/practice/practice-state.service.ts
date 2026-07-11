/**
 * @file 添削ページの状態を保持するシングルトンサービス。
 * 状態を signal で持ち providedIn:'root' で生存させることで、タブ遷移（コンポーネント破棄）後も
 * 入力テキスト・添削結果・ローディング状態が消えない。API 送信もこのサービス内で完結するため、
 * 送信中に別タブへ移動しても中断されない。
 * 単発添削はストリーミング受信の実測進捗を progress signal（0〜100）で公開し、待機中クイズの表示可否は
 * showQuiz signal で持つ（完了しても自動で閉じず、ユーザーが「結果を見る」を押すまで結果を隠す）。
 * notice signal は「処理中／完了／エラー」をルートコンポーネントのグローバルバナーへ伝え、
 * どのタブにいても添削の状況が分かるようにする。
 * 一括添削（bulkEntries/bulkProgress/submitBulk）は JSON テンプレートでアップロードした複数日分の
 * 英作文を BULK_CONCURRENCY 件ずつ並列添削・保存する正式機能。セッション組み立ては buildSession() に共通化し、
 * 単発添削（submit）と一括添削（submitBulk）の両方から使う。
 * 「今日」のローカル日付キー算出は date.util.ts の toDayKey() を共用する（重複実装しない）。
 * API 例外は toUserMessage()（core/gemini/gemini-error.util）で日本語の対処案内に変換してから表示する。
 * 変換は表示側のこのサービスで行い、GeminiService の throw 構造（モデルフォールバック判定）は変えない。
 */
import { Injectable, inject, signal } from '@angular/core';
import { GeminiService, CorrectionResult } from '@core/gemini/gemini.service';
import { toUserMessage } from '@core/gemini/gemini-error.util';
import { SessionRepositoryService } from '@core/sessions/session-repository.service';
import { SettingsStoreService } from '@core/settings/settings-store.service';
import { buildPrompt } from '@core/gemini/prompt.util';
import { BulkEntry } from './bulk-import.util';
import { toDayKey } from '@shared/utils/date.util';
import { CorrectionSession, LevelUpItem, Mistake, ReviewItem, WritingEvaluation } from '@core/models/session.model';

@Injectable({ providedIn: 'root' })
export class PracticeState {
  private gemini = inject(GeminiService);
  private repository = inject(SessionRepositoryService);
  private settingsStore = inject(SettingsStoreService);

  // ── 状態管理（signal。コンポーネント破棄後も保持される） ──────────
  userText = signal('');
  selectedDate = signal(toDayKey(new Date().toISOString()));
  loading = signal(false);
  // 添削の進捗率（0〜100）。ストリーミング受信中に GeminiService から通知され、完了時に 100 になる。
  // モデルのフォールバック等で通知値が巻き戻ることがあるため、更新は常に max を取って単調増加させる。
  progress = signal(0);
  // 待機中クイズを表示中か。「クイズで待つ」で true、「結果を見る」で false。添削開始時にリセットする。
  showQuiz = signal(false);
  error = signal('');
  result = signal<{ original: string; corrected: string; correctedText?: string; mistakes: Mistake[]; evaluation?: WritingEvaluation; reviewItems?: ReviewItem[]; levelUpItems?: LevelUpItem[]; levelUpText?: string } | null>(null);

  // ── グローバル通知（ルートのバナーが購読） ────────────────────────
  // null = 非表示。完了/エラーはユーザーが閉じるか添削タブ遷移で消す。
  notice = signal<{ status: 'loading' | 'success' | 'error'; message: string } | null>(null);

  dismissNotice() {
    this.notice.set(null);
  }

  // ── 添削実行: Gemini API 呼び出し → 結果表示 → セッション保存 ───
  // 前回結果は受信時まで保持し、成功して初めて入力欄をクリアする。
  async submit() {
    if (this.loading()) return; // 二重送信防止
    const text = this.userText().trim();
    if (!text) return;

    const settings = this.settingsStore.getSettings();
    if (!settings.apiKey) {
      this.error.set('設定ページで Gemini API キーを入力してください。');
      this.notice.set({ status: 'error', message: this.error() });
      return;
    }

    this.loading.set(true);
    this.progress.set(0);
    this.showQuiz.set(false);
    this.error.set('');
    this.notice.set({ status: 'loading', message: '添削中…' });
    // 注: ここで result はクリアしない（新しい結果を受信して初めて置き換える）。

    try {
      const res = await this.gemini.correct(settings.apiKey, settings.modelPriority, buildPrompt(), text, (p) =>
        this.progress.set(Math.max(this.progress(), p))
      );
      this.progress.set(100);
      this.result.set({ original: text, ...res });
      this.notice.set({ status: 'success', message: '添削が完了しました' });

      const session = this.buildSession(this.selectedDate(), text, res);
      this.repository.saveSession(session);
      // 添削が成功して初めて入力欄をクリアする。
      this.userText.set('');
    } catch (e) {
      this.error.set(toUserMessage(e));
      this.notice.set({ status: 'error', message: this.error() });
    } finally {
      this.loading.set(false);
    }
  }

  clear() {
    this.userText.set('');
    this.result.set(null);
    this.error.set('');
    this.showQuiz.set(false);
    this.progress.set(0);
  }

  // ── CorrectionSession 組み立て（単発添削・一括添削の両方から使う共通処理） ─
  // 'YYYY-MM-DD' を new Date() に渡すと UTC 0時扱いになりずれるため、
  // ローカル正午で生成して指定日付を確実に保持する。
  private buildSession(date: string, text: string, res: CorrectionResult): CorrectionSession {
    const [y, m, day] = date.split('-').map(Number);
    const sessionDate = new Date(y, m - 1, day, 12);
    return {
      // 日付に依存しない一意 ID（同日に複数回添削しても衝突しない）
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      date: sessionDate.toISOString(),
      original: text,
      corrected: res.corrected,
      correctedText: res.correctedText,
      mistakes: res.mistakes,
      evaluation: res.evaluation,
      reviewItems: res.reviewItems,
      levelUpItems: res.levelUpItems,
      levelUpText: res.levelUpText,
    };
  }

  // ── 一括添削: JSONテンプレートからアップロードした複数の英作文を並列添削する ──
  // 同時実行数を BULK_CONCURRENCY 件に制限したワーカープールで処理し、Gemini API のレート制限を超えないようにする。
  private readonly BULK_CONCURRENCY = 3;

  bulkEntries = signal<BulkEntry[]>([]);
  bulkProgress = signal<
    { date: string; text: string; status: 'pending' | 'loading' | 'success' | 'error'; errorMessage?: string }[]
  >([]);
  bulkRunning = signal(false);

  setBulkEntries(entries: BulkEntry[]) {
    this.bulkEntries.set(entries);
    this.bulkProgress.set([]);
  }

  async submitBulk() {
    if (this.bulkRunning()) return; // 二重実行防止
    const entries = this.bulkEntries();
    if (entries.length === 0) return;

    const settings = this.settingsStore.getSettings();
    if (!settings.apiKey) {
      this.error.set('設定ページで Gemini API キーを入力してください。');
      this.notice.set({ status: 'error', message: this.error() });
      return;
    }

    this.bulkRunning.set(true);
    this.bulkProgress.set(entries.map(e => ({ date: e.date, text: e.text, status: 'pending' as const })));

    let successCount = 0;
    let errorCount = 0;
    let completedCount = 0;
    let nextIndex = 0;

    // 各ワーカーは nextIndex を同期的にインクリメントしてから await するため、
    // インデックスの重複・取りこぼしは発生しない。
    const worker = async () => {
      while (nextIndex < entries.length) {
        const i = nextIndex++;
        const entry = entries[i];
        this.updateBulkStatus(i, 'loading');
        try {
          const res = await this.gemini.correct(settings.apiKey, settings.modelPriority, buildPrompt(), entry.text);
          const session = this.buildSession(entry.date, entry.text, res);
          this.repository.saveSession(session);
          this.updateBulkStatus(i, 'success');
          successCount++;
        } catch (e) {
          this.updateBulkStatus(i, 'error', toUserMessage(e));
          errorCount++;
        } finally {
          completedCount++;
          this.notice.set({ status: 'loading', message: `一括添削中 (${completedCount}/${entries.length})` });
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(this.BULK_CONCURRENCY, entries.length) }, () => worker())
    );

    this.bulkRunning.set(false);
    this.notice.set({
      status: errorCount > 0 ? 'error' : 'success',
      message: `一括添削が完了しました（成功: ${successCount}件 / 失敗: ${errorCount}件）`,
    });
  }

  private updateBulkStatus(
    index: number,
    status: 'pending' | 'loading' | 'success' | 'error',
    errorMessage?: string
  ) {
    const progress = [...this.bulkProgress()];
    progress[index] = { ...progress[index], status, errorMessage };
    this.bulkProgress.set(progress);
  }
}
