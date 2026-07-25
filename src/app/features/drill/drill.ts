/**
 * @file 弱点克服ドリルページ。
 * 状態（出題モード・進行状況・スコア等）は DrillState サービスが保持するため、
 * タブ遷移でコンポーネントが破棄されても消えない（practice.ts/PracticeState と同じ設計）。
 * 本コンポーネントは DOM 操作（自動フォーカス）にのみ専念する。
 * 答え合わせ後（revealed→true）は #nextBtn（levelup/mistakes・cloze で共用のテンプレート参照名）へ、
 * 穴あきタイピング（levelup）の出題中は #answerInput へ自動フォーカスし、
 * マウス操作なしで「入力→Enter→次へ→入力」と続けられるようにしている。
 * また #answerInput（お手本と桁を揃えるため textarea）の高さを入力内容に応じて自動調整する。
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
import { Badge } from '@shared/ui/badge/badge';
import { Card } from '@shared/ui/card/card';
import { Icon } from '@shared/ui/icon/icon';
import { DrillState } from './drill-state.service';
import { SentenceList } from './sentence-list/sentence-list';

@Component({
  selector: 'app-drill',
  imports: [FormsModule, DatePipe, SentenceList, Badge, Card, Icon],
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

  // 穴あきタイピング（levelup）の英文入力欄。出題中は自動フォーカスし、
  // 次の問題に進んだ直後もクリックなしでそのまま打ち始められるようにする。
  // お手本と折り返し位置を揃えるため textarea で、高さは下の effect が内容に合わせて設定する。
  private answerInput = viewChild<ElementRef<HTMLTextAreaElement>>('answerInput');

  constructor() {
    // 答え合わせ直後（revealed→true）にレンダリングが確定してから「次へ」ボタンへフォーカスを移す。
    // setTimeout(0) で描画完了後まで待たないと、切り替わった @if ブロック内の要素がまだ存在しない。
    effect(() => {
      if (this.state.revealed()) {
        setTimeout(() => this.nextBtn()?.nativeElement.focus());
      }
    });

    // 穴あきタイピングの出題中（revealed=false）は入力欄へフォーカスを戻す。
    // maskLevel()/index() も読むことで、retry() での段階進行や別の文の選択でも再実行される。
    effect(() => {
      const isLevelUp = this.state.mode() === 'levelup';
      const revealed = this.state.revealed();
      this.state.maskLevel();
      this.state.index();
      if (isLevelUp && !revealed) {
        setTimeout(() => this.answerInput()?.nativeElement.focus());
      }
    });

    // 入力量に応じて textarea の高さを実際の行数へ合わせる（rows=1 のままだと2行目以降が隠れる）。
    // 次の問題へ進んで userAnswer が空に戻れば 1 行分に縮む。
    effect(() => {
      this.state.userAnswer();
      this.state.index();
      this.state.maskLevel();
      setTimeout(() => {
        const el = this.answerInput()?.nativeElement;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      });
    });
  }
}
