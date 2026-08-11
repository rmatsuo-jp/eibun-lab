/**
 * @file 達成の瞬間（文の習熟・パーフェクト・ラボレベル上昇）を祝うモーダル。
 * shared/ui/modal（オーバーレイ＋Escで閉じる）と shared/ui/confetti（紙吹雪）を組み合わせ、
 * タイトル・本文・獲得経験値・解除した実績名の表示と「閉じる」操作だけを担う。
 * 文言はすべて呼び出し側（feature）が i18n.t() 済みの文字列として渡す
 * （shared層は core/i18n に依存できないため。依存方向 features → core → shared）。
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Modal } from '../modal/modal';
import { Confetti } from '../confetti/confetti';

@Component({
  selector: 'app-celebration',
  imports: [Modal, Confetti],
  templateUrl: './celebration.html',
  styleUrl: './celebration.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Celebration {
  title = input.required<string>();
  message = input<string>('');
  // 獲得経験値の表示文字列（例「+50 経験値」）。空文字なら表示しない。
  xpText = input<string>('');
  // 同時に解除された実績のタイトル一覧。トーストと二重に出さないため、
  // お祝いが出る場面ではこちらにまとめて渡す（drill.html 側で出し分ける）。
  achievements = input<string[]>([]);
  closeLabel = input.required<string>();

  closed = output<void>();
}
