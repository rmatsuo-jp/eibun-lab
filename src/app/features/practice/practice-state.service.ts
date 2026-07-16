/**
 * @file 添削ページの状態を保持するシングルトンサービス。
 * 状態を signal で持ち providedIn:'root' で生存させることで、タブ遷移（コンポーネント破棄）後も
 * 入力テキスト・添削結果・ローディング状態が消えない。API 送信もこのサービス内で完結するため、
 * 送信中に別タブへ移動しても中断されない。
 * 単発添削はストリーミング受信の実測進捗を progress signal（0〜100）で公開し、待機中クイズの表示可否は
 * showQuiz signal で持つ（送信開始と同時に自動表示し、成功/失敗いずれで完了しても自動で閉じて結果/エラー表示へ切り替える）。
 * notice signal は「処理中／完了／エラー」をルートコンポーネントのグローバルバナーへ伝え、
 * どのタブにいても添削の状況が分かるようにする。
 * 一括添削（bulkEntries/bulkProgress/submitBulk）は JSON テンプレートでアップロードした複数日分の
 * 英作文を BULK_CONCURRENCY 件ずつ並列添削・保存する正式機能。セッション組み立ては buildSession() に共通化し、
 * 単発添削（submit）と一括添削（submitBulk）の両方から使う。
 * 「今日」のローカル日付キー算出は date.util.ts の toDayKey() を共用する（重複実装しない）。
 * API 例外は toUserMessage()（core/gemini/gemini-error.util）で日本語の対処案内に変換してから表示する。
 * 変換は表示側のこのサービスで行い、GeminiService の throw 構造（モデルフォールバック判定）は変えない。
 * テーマ提案（suggestedTheme/handleThemeCardClick）は書く内容に迷うユーザー向けの表示専用の静的候補で、
 * PRACTICE_THEMES から1件だけランダムに選ぶ。入力欄は自分で書いた英文専用のため、
 * テーマ文を入力欄へ挿入する処理は持たない。
 * カードの枠自体は最初から表示し、中身（テーマ文）だけを themeRevealed で出し分ける
 * （practice.html 側はプレースホルダー文言を表示）。カードは常時クリック可能な1つの要素で、
 * 未表示（themeRevealed=false）のクリックで初めて候補を選んで表示し、表示済みのクリックでは
 * 別の候補に入れ替える。この分岐を handleThemeCardClick() に一本化する。
 * ゲーミフィケーション（添削の統計・実績）: submit()/submitBulk() の saveSession() 直後に
 * recordCorrectionForGamification() を呼び、GamificationSyncService.recordCorrectionSaved() で
 * 添削回数・継続日数を更新する。記録直後に achievement-engine.util.ts の evaluateNewlyUnlocked() で
 * 新規解除を判定し、newlyUnlocked signal に積んで practice.html のトースト表示に渡す
 * （dismissNewlyUnlocked()で消去。features/drill/drill-state.service.ts と同じ方針）。
 */
import { Injectable, inject, signal } from '@angular/core';
import { GeminiService, CorrectionResult } from '@core/gemini/gemini.service';
import { toUserMessage } from '@core/gemini/gemini-error.util';
import { SessionRepositoryService } from '@core/sessions/session-repository.service';
import { SettingsStoreService } from '@core/settings/settings-store.service';
import { buildPrompt } from '@core/gemini/prompt.util';
import { BulkEntry, buildBulkTemplateFromSessions } from './bulk-import.util';
import { toDayKey } from '@shared/utils/date.util';
import { CorrectionSession } from '@core/models/session.model';
import { PRACTICE_THEMES, PracticeTheme } from '@core/practice/practice-themes.data';
import { AchievementId } from '@core/achievements/achievement.model';
import { evaluateNewlyUnlocked } from '@core/achievements/achievement-engine.util';
import { GamificationSyncService } from '@core/achievements/gamification-sync.service';
import { TranslationKey } from '@core/i18n/translations';

@Injectable({ providedIn: 'root' })
export class PracticeState {
  private gemini = inject(GeminiService);
  private repository = inject(SessionRepositoryService);
  private settingsStore = inject(SettingsStoreService);
  private gamification = inject(GamificationSyncService);

  // 直近の添削保存で新規解除された実績ID一覧。UI（practice.html）のトースト表示に使う。
  newlyUnlocked = signal<AchievementId[]>([]);

  dismissNewlyUnlocked(): void {
    this.newlyUnlocked.set([]);
  }

  // 実績IDから i18n タイトルキー（achievements.<id>.title）を組み立てる。
  // AchievementId は core/achievements 側で string リテラルユニオンとして定義されており
  // i18n の TranslationKey を知らないため、ここでキャストする
  // （core/i18n/localized-session.util.ts / features/drill/drill-state.service.ts と同じ方針）。
  achievementTitleKey(id: AchievementId): TranslationKey {
    return `achievements.${id}.title` as TranslationKey;
  }

  // 添削保存のたびに呼ぶ。添削の累積統計（回数・継続日数）を記録し、新規解除された実績があれば積む。
  private recordCorrectionForGamification(): void {
    this.gamification.recordCorrectionSaved();
    const ids = evaluateNewlyUnlocked(this.gamification.stats(), {
      clozeAchievement: { done: 0, total: 0 },
      levelUpAchievement: { done: 0, total: 0 },
    });
    if (ids.length === 0) return;
    this.gamification.markUnlocked(ids);
    this.newlyUnlocked.update((prev) => [...prev, ...ids]);
  }

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
  result = signal<({ original: string } & CorrectionResult) | null>(null);

  // ── グローバル通知（ルートのバナーが購読） ────────────────────────
  // null = 非表示。完了/エラーはユーザーが閉じるか添削タブ遷移で消す。
  notice = signal<{ status: 'loading' | 'success' | 'error'; message: string } | null>(null);

  dismissNotice() {
    this.notice.set(null);
  }

  // ── テーマ提案: カードの枠は常時表示、中身は未クリックのあいだ隠す ────────
  themeRevealed = signal(false);
  suggestedTheme = signal<PracticeTheme>(this.pickRandomTheme());

  // 未表示時のクリックは「初めて表示」、表示済み時のクリックは「別の候補に入れ替え」を兼ねる。
  handleThemeCardClick() {
    this.suggestedTheme.set(this.pickRandomTheme());
    this.themeRevealed.set(true);
  }

  private pickRandomTheme(): PracticeTheme {
    return PRACTICE_THEMES[Math.floor(Math.random() * PRACTICE_THEMES.length)];
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
    this.showQuiz.set(true);
    this.error.set('');
    this.notice.set({ status: 'loading', message: '添削中…' });
    // 注: ここで result はクリアしない（新しい結果を受信して初めて置き換える）。

    try {
      const res = await this.gemini.correct(
        settings.apiKey,
        settings.modelPriority,
        buildPrompt(),
        text,
        (p) => this.progress.set(Math.max(this.progress(), p)),
      );
      this.progress.set(100);
      this.result.set({ original: text, ...res });
      this.showQuiz.set(false);
      this.notice.set({ status: 'success', message: '添削が完了しました' });

      const session = this.buildSession(this.selectedDate(), text, res);
      this.repository.saveSession(session);
      this.recordCorrectionForGamification();
      // 添削が成功して初めて入力欄をクリアする。
      this.userText.set('');
    } catch (e) {
      this.error.set(toUserMessage(e));
      this.showQuiz.set(false);
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
      correctedEn: res.correctedEn,
      correctedText: res.correctedText,
      grammarNotes: res.grammarNotes,
      grammarNotesEn: res.grammarNotesEn,
      naturalExpressions: res.naturalExpressions,
      naturalExpressionsEn: res.naturalExpressionsEn,
      grammarTendency: res.grammarTendency,
      grammarTendencyEn: res.grammarTendencyEn,
      cefrRationale: res.cefrRationale,
      cefrRationaleEn: res.cefrRationaleEn,
      studyPlan: res.studyPlan,
      studyPlanEn: res.studyPlanEn,
      mistakes: res.mistakes,
      evaluation: res.evaluation,
      reviewItems: res.reviewItems,
      levelUpItems: res.levelUpItems,
      levelUpText: res.levelUpText,
      model: res.model,
    };
  }

  // ── 一括添削: JSONテンプレートからアップロードした複数の英作文をバッチ添削する ──
  // Gemini API のレート制限（1分あたり5リクエスト）に合わせ、BULK_BATCH_SIZE 件ずつ並列送信し、
  // 各バッチの開始から BULK_WINDOW_MS 経過するまで次のバッチを送らない。
  private readonly BULK_BATCH_SIZE = 5;
  private readonly BULK_WINDOW_MS = 60_000;

  bulkEntries = signal<BulkEntry[]>([]);
  bulkProgress = signal<
    {
      date: string;
      text: string;
      status: 'pending' | 'loading' | 'success' | 'error';
      errorMessage?: string;
    }[]
  >([]);
  bulkRunning = signal(false);

  setBulkEntries(entries: BulkEntry[]) {
    this.bulkEntries.set(entries);
    this.bulkProgress.set([]);
  }

  // 履歴の全セッションを一括添削テンプレートJSONへ変換する。SessionRepositoryService への
  // アクセスはこのサービス内に閉じ、component からの直接inject（core→feature-componentの直接依存）を避ける。
  buildHistoryTemplateJson(): string {
    return buildBulkTemplateFromSessions(this.repository.sessions());
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
    this.bulkProgress.set(
      entries.map((e) => ({ date: e.date, text: e.text, status: 'pending' as const })),
    );

    let successCount = 0;
    let errorCount = 0;
    let completedCount = 0;

    for (let start = 0; start < entries.length; start += this.BULK_BATCH_SIZE) {
      const batch = entries.slice(start, start + this.BULK_BATCH_SIZE);
      const batchStartedAt = Date.now();

      await Promise.all(
        batch.map(async (entry, offset) => {
          const i = start + offset;
          this.updateBulkStatus(i, 'loading');
          try {
            const res = await this.gemini.correct(
              settings.apiKey,
              settings.modelPriority,
              buildPrompt(),
              entry.text,
            );
            const session = this.buildSession(entry.date, entry.text, res);
            this.repository.saveSession(session);
            this.recordCorrectionForGamification();
            this.updateBulkStatus(i, 'success');
            successCount++;
          } catch (e) {
            this.updateBulkStatus(i, 'error', toUserMessage(e));
            errorCount++;
          } finally {
            completedCount++;
            this.notice.set({
              status: 'loading',
              message: `一括添削中 (${completedCount}/${entries.length})`,
            });
          }
        }),
      );

      const isLastBatch = start + this.BULK_BATCH_SIZE >= entries.length;
      if (!isLastBatch) {
        const elapsed = Date.now() - batchStartedAt;
        const waitMs = this.BULK_WINDOW_MS - elapsed;
        if (waitMs > 0) {
          this.notice.set({
            status: 'loading',
            message: `一括添削中 (${completedCount}/${entries.length}) — レート制限のため待機中...`,
          });
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }
    }

    this.bulkRunning.set(false);
    this.notice.set({
      status: errorCount > 0 ? 'error' : 'success',
      message: `一括添削が完了しました（成功: ${successCount}件 / 失敗: ${errorCount}件）`,
    });
  }

  private updateBulkStatus(
    index: number,
    status: 'pending' | 'loading' | 'success' | 'error',
    errorMessage?: string,
  ) {
    const progress = [...this.bulkProgress()];
    progress[index] = { ...progress[index], status, errorMessage };
    this.bulkProgress.set(progress);
  }
}
