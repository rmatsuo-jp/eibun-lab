/**
 * @file 添削の API 送受信を待つ間に表示するミニクイズ。過去セッションの復習カード（ReviewItem）から
 * 4択の穴埋め問題をランダムに出題し、待ち時間を学習時間に変える。
 * 出題ロジックは core/quiz/quiz.util.ts の純粋関数を Drill と共用する（feature 間 import は行わない）。
 * ドリルの習熟度（DrillProgressService）には記録しない — 気晴らし用途であり、
 * 待機時間に左右される回答結果で習熟判定が歪むのを避けるため。
 * 添削が完了しても自動では閉じず、完了通知と「結果を見る」ボタンを出して遷移をユーザーに委ねる。
 */
import { Component, computed, inject, signal } from '@angular/core';
import { SessionRepositoryService } from '@core/sessions/session-repository.service';
import { getReviewItems, normalizeDrillKey } from '@core/stats/session-stats.util';
import { buildClozeQuiz, normalizeAnswer, shuffleByWeight } from '@core/quiz/quiz.util';
import { PracticeState } from '../practice-state.service';

@Component({
  selector: 'app-waiting-quiz',
  imports: [],
  templateUrl: './waiting-quiz.html',
  styleUrl: './waiting-quiz.scss',
})
export class WaitingQuiz {
  private repository = inject(SessionRepositoryService);
  state = inject(PracticeState);

  // ── 出題リスト（コンポーネント生成時に一度だけ確定させる） ──────────
  // 添削中に新しいセッションが保存されて出題が入れ替わることを避けるため、signal ではなく固定配列で持つ。
  // weight は一律 1（習熟度を参照しないため）で、shuffleByWeight は純粋なランダム並べ替えとして働く。
  private readonly quizzes = shuffleByWeight(
    getReviewItems(this.repository.sessions()).map(r => buildClozeQuiz(r, normalizeDrillKey(r.sentence), 1))
  );

  hasQuiz = this.quizzes.length > 0;

  index = signal(0);
  selected = signal<string | null>(null);

  current = computed(() => this.quizzes[this.index() % this.quizzes.length]);
  isCorrect = computed(() => {
    const s = this.selected();
    return s !== null && normalizeAnswer(s) === normalizeAnswer(this.current().answer);
  });

  // ── 解答 ─────────────────────────────────────────────────────────
  // 一度選んだら選択を固定する（選び直しでの正解探しを防ぐ）。
  choose(choice: string) {
    if (this.selected() !== null) return;
    this.selected.set(choice);
  }

  // 出題数が尽きたら先頭へ戻って周回する（待ち時間の長さに関わらず問題が切れないようにする）。
  next() {
    this.selected.set(null);
    this.index.update(i => i + 1);
  }

  // 添削結果へ遷移する。practice.html は showQuiz() が false になると結果セクションを表示する。
  showResult() {
    this.state.showQuiz.set(false);
  }
}
