/**
 * @file 弱点克服ドリルページ。
 * 状態（出題モード・進行状況・スコア等）は DrillState サービスが保持するため、
 * タブ遷移でコンポーネントが破棄されても消えない（practice.ts/PracticeState と同じ設計）。
 * 本コンポーネントは DOM 操作（答え合わせ後の「次へ」ボタンへの自動フォーカス）にのみ専念する。
 * 答え合わせ後（revealed→true）は #nextBtn（levelup/mistakes・cloze で共用のテンプレート参照名）へ
 * 自動フォーカスし、Enterキーだけで次の問題に進めるようにしている。
 */
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '@core/i18n/i18n.service';
import { DrillState } from './drill-state.service';
import { SentenceList } from './sentence-list/sentence-list';

@Component({
  selector: 'app-drill',
  imports: [FormsModule, DatePipe, SentenceList],
  templateUrl: './drill.html',
  styleUrl: './drill.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Drill {
  protected state = inject(DrillState);
  protected i18n = inject(I18nService);

  // 答え合わせ後に表示される「次へ」ボタン（levelup/mistakes・cloze どちらか一方のみ描画される）。
  // revealed() が true になった直後に自動フォーカスし、Enterキーだけで次の問題へ進めるようにする。
  private nextBtn = viewChild<ElementRef<HTMLButtonElement>>('nextBtn');

  constructor() {
    // 答え合わせ直後（revealed→true）にレンダリングが確定してから「次へ」ボタンへフォーカスを移す。
    // setTimeout(0) で描画完了後まで待たないと、切り替わった @if ブロック内の要素がまだ存在しない。
    effect(() => {
      if (this.state.revealed()) {
        setTimeout(() => this.nextBtn()?.nativeElement.focus());
      }
    });
  }
}
