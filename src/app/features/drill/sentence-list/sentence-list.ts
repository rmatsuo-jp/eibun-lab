/**
 * @file 穴あきタイピングの「文一覧選択」画面。drill.html から切り出したUIブロック。
 * 選択中セッションの levelUpItems（LevelUpQuiz[]）を input() で受け取り、進捗表示付きの一覧から
 * 1文を選ぶと selectIndex を output() する（waiting-quiz/history-calendar と同じ設計）。
 * 各文の進捗表示（未着手/マスク段階/習熟済み）は progressFor に委譲する（DrillState.progressForItem をそのまま渡す）。
 */
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { LevelUpQuiz } from '@core/quiz/quiz.util';
import { I18nService } from '@core/i18n/i18n.service';

@Component({
  selector: 'app-sentence-list',
  imports: [],
  templateUrl: './sentence-list.html',
  styleUrl: './sentence-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SentenceList {
  protected i18n = inject(I18nService);

  items = input.required<LevelUpQuiz[]>();
  progressFor = input.required<(item: LevelUpQuiz) => { maskLevel: number; completed: boolean }>();
  selectIndex = output<number>();
  back = output<void>();
}
