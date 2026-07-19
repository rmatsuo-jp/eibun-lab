/**
 * @file 弱点克服ドリル「穴埋めクイズ（cloze）」モード専用の状態・純粋ロジックを保持するサービス。
 * drill-state.ts（オーケストレーター）から利用される。cloze固有のデータ（対象セッション一覧・
 * 達成度・進捗）とQuiz構築ロジックのみを持ち、出題中の共有UI状態（quiz/index/userAnswer等）は
 * 持たない（drill-state.ts側で管理し、このサービスは「日付ごとの一覧・進捗・Quiz配列の構築」という
 * データ提供役に専念する設計）。
 * 出題の重み付け（weightFor、既に習熟した問題を出にくくする）は DRILL_MASTERY_STREAK（3回連続正解）
 * を基準に減衰させる。
 */
import { Injectable, computed, inject } from '@angular/core';
import { SessionRepositoryService } from '@core/sessions/session-repository.service';
import { getSessionsWithReviewItems, normalizeDrillKey } from '@core/stats/session-stats.util';
import { DRILL_MASTERY_STREAK } from './drill-progress.service';
import { DrillProgressSyncService } from './drill-progress-sync.service';
import { CorrectionSession, ReviewItem } from '@core/models/session.model';
import { I18nService } from '@core/i18n/i18n.service';
import { buildClozeQuiz, Quiz } from '@core/quiz/quiz.util';

@Injectable({ providedIn: 'root' })
export class DrillClozeState {
  private repository = inject(SessionRepositoryService);
  private drillProgress = inject(DrillProgressSyncService);
  private i18n = inject(I18nService);

  // ── 出題元（穴埋めクイズは日付選択方式のため、件数ではなく「対象セッション一覧」を保持する） ──
  clozeDates = computed(() => getSessionsWithReviewItems(this.repository.sessions()));
  clozeCount = computed(() => this.clozeDates().length);

  // スタート画面のモード選択カードに表示する達成度（完了数/全体数の合算）。
  clozeAchievement = computed(() => {
    const totals = this.clozeDates().map((s) => this.progressForClozeSession(s));
    return {
      done: totals.reduce((a, t) => a + t.done, 0),
      total: totals.reduce((a, t) => a + t.total, 0),
    };
  });

  // 選択中セッションの進捗サマリー（達成数/全体数）。穴埋めクイズの日付選択画面のバッジ表示に使う。
  // 達成は「1回でも正解したか（everCorrect）」で判定する（後で間違えても達成は取り消さない）。
  progressForClozeSession(session: CorrectionSession): { done: number; total: number } {
    const items = session.reviewItems ?? [];
    const done = items.filter((r) => {
      const key = normalizeDrillKey(`${r.sentence}${r.answer}`);
      return this.drillProgress.getDrillProgress(key)?.everCorrect ?? false;
    }).length;
    return { done, total: items.length };
  }

  // 選択中セッションのパーフェクト達成数（穴埋めクイズ）。日付選択画面のバッジ表示に使う。
  perfectCountForClozeSession(session: CorrectionSession): number {
    return this.drillProgress.getPerfectCount(`cloze-${session.id}`);
  }

  // 復習カード → Quiz へ正規化。基準重みは一律1とし、習熟度による減衰をかける。
  // shuffleByWeight はスナップショット構築（出題順の固定）を伴うため呼び出し側（drill-state.ts）で行う。
  buildQuizzes(reviewItems: ReviewItem[]): Quiz[] {
    return reviewItems.map((r: ReviewItem) => {
      const key = normalizeDrillKey(`${r.sentence}${r.answer}`);
      return buildClozeQuiz(r, key, this.weightFor(key, 1), this.i18n.lang());
    });
  }

  // 習熟済み（連続正解が DRILL_MASTERY_STREAK 以上）なら重みを大きく減衰させ、出題頻度を下げる。
  private weightFor(key: string, baseWeight: number): number {
    const streak = this.drillProgress.getDrillProgress(key)?.correctStreak ?? 0;
    return streak >= DRILL_MASTERY_STREAK ? baseWeight * 0.2 : baseWeight;
  }
}
