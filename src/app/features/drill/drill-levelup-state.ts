/**
 * @file 弱点克服ドリル「穴あきタイピング（levelup）」モード専用の状態・純粋ロジックを保持するサービス。
 * drill-state.ts（オーケストレーター）から利用される。levelup固有のデータ（対象セッション一覧・
 * 達成度・文ごとの進捗）とLevelUpQuiz構築・マスク表示ロジックのみを持ち、出題中の共有UI状態
 * （levelUpQuiz/index/userAnswer/maskLevel等）は持たない（drill-state.ts側で管理し、このサービスは
 * 「日付・文ごとの一覧・進捗・LevelUpQuiz配列の構築・マスク文字列生成」というデータ提供役に専念する設計）。
 * セッション完了判定（isSessionComplete）は「該当日程の全文が完了（maxLevelで正解済み）したか」を
 * 返すだけの純粋判定に留め、パーフェクト達成数の記録・訪問単位ガード・ゲーミフィケーション連携は
 * drill-state.ts 側（checkTyping）が行う（複数モード共通の記録経路のため）。
 */
import { Injectable, computed, inject } from '@angular/core';
import { SessionRepositoryService } from '@core/sessions/session-repository.service';
import { getSessionsWithLevelUp, normalizeDrillKey } from '@core/stats/session-stats.util';
import { DrillProgressSyncService } from './drill-progress-sync.service';
import { CorrectionSession } from '@core/models/session.model';
import { I18nService } from '@core/i18n/i18n.service';
import { buildLevelUpQuiz, LevelUpQuiz, maskedIndices } from '@core/quiz/quiz.util';

@Injectable({ providedIn: 'root' })
export class DrillLevelUpState {
  private repository = inject(SessionRepositoryService);
  private drillProgress = inject(DrillProgressSyncService);
  private i18n = inject(I18nService);

  // ── 出題元（穴あきタイピングは日付選択方式のため、件数ではなく「対象セッション一覧」を保持する） ──
  levelUpDates = computed(() => getSessionsWithLevelUp(this.repository.sessions()));
  levelUpCount = computed(() => this.levelUpDates().length);

  // スタート画面のモード選択カードに表示する達成度（完了数/全体数の合算）。
  levelUpAchievement = computed(() => {
    const totals = this.levelUpDates().map((s) => this.progressForSession(s));
    return {
      done: totals.reduce((a, t) => a + t.done, 0),
      total: totals.reduce((a, t) => a + t.total, 0),
    };
  });

  // 選択中セッションの進捗サマリー（完了数/全体数）。日付選択画面のバッジ表示に使う。
  progressForSession(session: CorrectionSession): { done: number; total: number } {
    const items = session.levelUpItems ?? [];
    const progress = this.drillProgress.getLevelUpProgress(session.id);
    const done = items.filter(
      (item) => progress[normalizeDrillKey(item.leveledUp)]?.completed,
    ).length;
    return { done, total: items.length };
  }

  // 文一覧の1文分の進捗表示用（未着手/マスク段階/習熟済み）を返す。
  progressForItem(
    item: LevelUpQuiz,
    sessionId: string | null,
  ): { maskLevel: number; completed: boolean } {
    const saved = sessionId
      ? this.drillProgress.getLevelUpProgress(sessionId)[item.key]
      : undefined;
    return { maskLevel: saved?.maskLevel ?? 0, completed: saved?.completed ?? false };
  }

  // 選択中セッションのパーフェクト達成数（穴あきタイピング）。日付選択画面のバッジ表示に使う。
  perfectCountForSession(session: CorrectionSession): number {
    return this.drillProgress.getPerfectCount(`levelup-${session.id}`);
  }

  // 選択した日程の levelUpItems を Gemini が返した元の順番のまま LevelUpQuiz[] に変換する。
  // シャッフルは一切行わない（その日の文章の並びのまま、どれからでも選べるようにするため）。
  buildQuizItems(session: CorrectionSession): LevelUpQuiz[] {
    return (session.levelUpItems ?? []).map((item) =>
      buildLevelUpQuiz(item, normalizeDrillKey(item.leveledUp), this.i18n.lang()),
    );
  }

  // 保存済みの完了数（習熟済みの文の数）を数える。日程を開いた直後の masteredCount 初期化に使う。
  masteredCountFor(sessionId: string): number {
    const progress = this.drillProgress.getLevelUpProgress(sessionId);
    return Object.values(progress).filter((p) => p.completed).length;
  }

  // 保存済みの進捗（あれば）から maskLevel を復元する。文選択時に使う。
  savedMaskLevel(sessionId: string | null, item: LevelUpQuiz): number {
    const saved = sessionId
      ? this.drillProgress.getLevelUpProgress(sessionId)[item.key]
      : undefined;
    return saved?.maskLevel ?? 0;
  }

  // 該当日程の全文が完了（maxLevelで正解済み）したかを判定する純粋判定。
  // levelupに「不完全パーフェクト」はなく、全文完了＝パーフェクト扱い。
  isSessionComplete(session: CorrectionSession): boolean {
    const { done, total } = this.progressForSession(session);
    return total > 0 && done === total;
  }

  // 現在の maskLevel で隠れている単語インデックスの集合を返す。
  private maskedIndicesFor(item: LevelUpQuiz, level: number): Set<number> {
    return maskedIndices(item.hideOrder, item.words.length, item.maxLevel, level);
  }

  // ── 表示用: maskLevel に応じて隠れた単語を同じ視覚幅のアンダースコアに置換した文を返す ─
  maskedSentence(item: LevelUpQuiz, maskLevel: number): string {
    const hidden = this.maskedIndicesFor(item, maskLevel);
    return item.words
      .map((w, i) => (hidden.has(i) ? '_'.repeat(Math.max(w.length, 3)) : w))
      .join(' ');
  }
}
