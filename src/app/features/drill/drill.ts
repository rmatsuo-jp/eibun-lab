/**
 * @file 弱点克服ドリルページ。
 * 状態（出題モード・進行状況・スコア等）は DrillState サービスが保持するため、
 * タブ遷移でコンポーネントが破棄されても消えない（practice.ts/PracticeState と同じ設計）。
 * 本コンポーネントは DOM 操作（自動フォーカス）にのみ専念する。
 * 答え合わせ後（revealed→true）は #nextBtn（levelup/mistakes・cloze で共用のテンプレート参照名）へ、
 * 穴あきタイピング（levelup）の出題中は #answerInput へ自動フォーカスし、
 * マウス操作なしで「入力→Enter→次へ→入力」と続けられるようにしている。
 * また #answerInput（お手本と桁を揃えるため textarea）の高さを入力内容に応じて自動調整する。
 * お祝いモーダル（shared/ui/celebration）へ渡す文言は、shared層が core/i18n に依存できないため
 * celebrationTitle/celebrationMessage/celebrationAchievements として本コンポーネントで翻訳して渡す。
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
import { Celebration } from '@shared/ui/celebration/celebration';
import { ProgressBar } from '@shared/ui/progress-bar/progress-bar';
import { DrillState } from './drill-state.service';
import { SentenceList } from './sentence-list/sentence-list';
import { DailyMissions } from './daily-missions/daily-missions';

@Component({
  selector: 'app-drill',
  imports: [
    FormsModule,
    DatePipe,
    SentenceList,
    DailyMissions,
    Badge,
    Card,
    Icon,
    Celebration,
    ProgressBar,
  ],
  templateUrl: './drill.html',
  styleUrl: './drill.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Drill {
  protected state = inject(DrillState);
  protected i18n = inject(I18nService);

  // ── お祝いモーダルへ渡す表示文字列 ──────────────────────────────
  // shared/ui/celebration は core/i18n に依存できない（依存方向 features → core → shared）ため、
  // 翻訳済みの文字列をこの層で組み立てて入力として渡す。
  protected celebrationTitle = computed(() => {
    const kind = this.state.celebrationKind();
    if (kind === 'labLevel') {
      return this.i18n.t('drill.celebrate.labLevelTitle', {
        level: this.state.leveledUpTo() ?? this.state.labLevel().level,
      });
    }
    return this.i18n.t(
      kind === 'perfect' ? 'drill.celebrate.perfectTitle' : 'drill.celebrate.masteredTitle',
    );
  });

  protected celebrationMessage = computed(() => {
    const kind = this.state.celebrationKind();
    if (kind === 'labLevel') return this.i18n.t('drill.celebrate.labLevelMessage');
    return this.i18n.t(
      kind === 'perfect' ? 'drill.celebrate.perfectMessage' : 'drill.celebrate.masteredMessage',
    );
  });

  // お祝いの中に並べる達成の内訳。同時解除された実績に加え、習熟・パーフェクトのお祝いと
  // 同時にラボレベルが上がった場合はその1行も足す（お祝いは常に1つに集約する）。
  protected celebrationAchievements = computed(() => {
    const lines = this.state
      .newlyUnlocked()
      .map((id) => this.i18n.t(this.state.achievementTitleKey(id)));
    const level = this.state.leveledUpTo();
    if (level !== null && this.state.celebrationKind() !== 'labLevel') {
      lines.push(this.i18n.t('drill.celebrate.labLevelLine', { level }));
    }
    return lines;
  });

  // 穴埋めクイズの結果サマリーがパーフェクトかどうか（お祝いを閉じた後も残る目印の出し分けに使う）。
  protected isPerfectResult = computed(
    () => this.state.total() > 0 && this.state.score() === this.state.total(),
  );

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
