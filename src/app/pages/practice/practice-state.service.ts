/**
 * @file 添削ページの状態を保持するシングルトンサービス。
 * 状態を signal で持ち providedIn:'root' で生存させることで、タブ遷移（コンポーネント破棄）後も
 * 入力テキスト・添削結果・ローディング状態が消えない。API 送信もこのサービス内で完結するため、
 * 送信中に別タブへ移動しても中断されない。
 * notice signal は「処理中／完了／エラー」をルートコンポーネントのグローバルバナーへ伝え、
 * どのタブにいても添削の状況が分かるようにする。
 */
import { Injectable, inject, signal } from '@angular/core';
import { GeminiService } from '../../services/gemini.service';
import { StorageService } from '../../services/storage.service';
import { buildPrompt } from '../../utils/prompt.util';
import { CorrectionSession, Mistake, ReviewItem } from '../../models/session.model';

// ── 日付ユーティリティ ───────────────────────────────────────────
/**
 * ローカルタイムゾーンの「今日」を YYYY-MM-DD 形式で返す純粋関数。
 * toISOString() は UTC 変換のため JST 早朝に前日へずれる。それを避けるため
 * getFullYear/getMonth/getDate（いずれもローカル時刻基準）から組み立てる。
 */
function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable({ providedIn: 'root' })
export class PracticeState {
  private gemini = inject(GeminiService);
  private storage = inject(StorageService);

  // ── 状態管理（signal。コンポーネント破棄後も保持される） ──────────
  userText = signal('');
  selectedDate = signal(todayLocal());
  loading = signal(false);
  error = signal('');
  result = signal<{ original: string; corrected: string; mistakes: Mistake[]; reviewItems?: ReviewItem[] } | null>(null);

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

    const settings = this.storage.getSettings();
    if (!settings.apiKey) {
      this.error.set('設定ページで Gemini API キーを入力してください。');
      this.notice.set({ status: 'error', message: this.error() });
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.notice.set({ status: 'loading', message: '添削中…' });
    // 注: ここで result はクリアしない（新しい結果を受信して初めて置き換える）。

    try {
      const res = await this.gemini.correct(settings.apiKey, settings.model, buildPrompt(), text);
      this.result.set({ original: text, ...res });
      this.notice.set({ status: 'success', message: '添削が完了しました' });

      // 'YYYY-MM-DD' を new Date() に渡すと UTC 0時扱いになりずれるため、
      // ローカル正午で生成して選択日付を確実に保持する。
      const [y, m, day] = this.selectedDate().split('-').map(Number);
      const sessionDate = new Date(y, m - 1, day, 12);
      const session: CorrectionSession = {
        // 日付に依存しない一意 ID（同日に複数回添削しても衝突しない）
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        date: sessionDate.toISOString(),
        original: text,
        corrected: res.corrected,
        mistakes: res.mistakes,
        evaluation: res.evaluation,
        reviewItems: res.reviewItems,
      };
      this.storage.saveSession(session);
      // 添削が成功して初めて入力欄をクリアする。
      this.userText.set('');
    } catch (e) {
      this.error.set('エラーが発生しました: ' + (e instanceof Error ? e.message : String(e)));
      this.notice.set({ status: 'error', message: this.error() });
    } finally {
      this.loading.set(false);
    }
  }

  clear() {
    this.userText.set('');
    this.result.set(null);
    this.error.set('');
  }
}
