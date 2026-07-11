/**
 * @file 添削の API 送受信を待つ間に表示するミニクイズ。過去セッションの復習カード（ReviewItem）から
 * 4択の穴埋め問題をランダムに出題し、待ち時間を学習時間に変える。
 * これまで添削したことがない新規ユーザー（セッション0件）は復習カードを持たないため、
 * core/quiz/sample-data.ts の静的サンプル問題（isSample=true）を代わりに出題する。
 * 出題ロジックは core/quiz/quiz.util.ts の純粋関数を Drill と共用する（feature 間 import は行わない）。
 * ドリルの習熟度（DrillProgressService）には記録しない — 気晴らし用途であり、
 * 待機時間に左右される回答結果で習熟判定が歪むのを避けるため。
 * 添削送信と同時に自動表示され、添削が完了（成功/失敗いずれも）すると PracticeState 側で
 * 自動的に showQuiz が false になり結果/エラー表示へ切り替わる。完了時点の問題を最後とし、
 * 次の問題への遷移は行わせない（next() は state.loading() が false の間は何もしない）。
 * 出題データ（hint/badge/translation）は生成時点の i18n.lang() で固定される（Drill と同じスナップショット方式）。
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { SessionRepositoryService } from '@core/sessions/session-repository.service';
import { getReviewItems, normalizeDrillKey } from '@core/stats/session-stats.util';
import { buildClozeQuiz, normalizeAnswer, shuffleByWeight } from '@core/quiz/quiz.util';
import { SAMPLE_REVIEW_ITEMS } from '@core/quiz/sample-data';
import { I18nService } from '@core/i18n/i18n.service';
import { PracticeState } from '../practice-state.service';

@Component({
  selector: 'app-waiting-quiz',
  imports: [],
  templateUrl: './waiting-quiz.html',
  styleUrl: './waiting-quiz.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaitingQuiz {
  private repository = inject(SessionRepositoryService);
  state = inject(PracticeState);
  protected i18n = inject(I18nService);

  // これまで添削したことがない新規ユーザー（セッション0件）かどうか。
  // 新規ユーザーには復習カードが存在しないため、静的サンプル問題を代わりに出題する。
  isSample = this.repository.sessions().length === 0;

  // ── 出題リスト（コンポーネント生成時に一度だけ確定させる） ──────────
  // 添削中に新しいセッションが保存されて出題が入れ替わることを避けるため、signal ではなく固定配列で持つ。
  // weight は一律 1（習熟度を参照しないため）で、shuffleByWeight は純粋なランダム並べ替えとして働く。
  private readonly quizzes = shuffleByWeight(
    (this.isSample ? SAMPLE_REVIEW_ITEMS : getReviewItems(this.repository.sessions())).map((r) =>
      buildClozeQuiz(r, normalizeDrillKey(r.sentence), 1, this.i18n.lang()),
    ),
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
  // 添削が完了した後は次の問題へ進ませない（完了時点の問題を最後とする）。
  next() {
    if (!this.state.loading()) return;
    this.selected.set(null);
    this.index.update((i) => i + 1);
  }
}
