/**
 * @file 達成の瞬間に画面全体へ紙吹雪を降らせる演出用コンポーネント。
 * 外部ライブラリを使わず CSS アニメーションのみで実装する（依存を増やさないため）。
 * 各紙片の水平位置・開始遅延・色相・回転量はコンストラクタで一度だけ算出して
 * CSS カスタムプロパティ（--x/--delay/--hue/--spin）として渡し、以降は再計算しない
 * （signal 化すると変更検知のたびに位置が飛ぶため、意図的に不変のスナップショットにする）。
 * pointer-events: none で操作を一切妨げない。OSの「動きを減らす」設定時は
 * src/styles.scss のグローバル指定で実質的に無効化される。
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

// 1つの紙片の見た目を決める不変パラメータ。
interface ConfettiPiece {
  x: number; // 画面幅に対する水平位置（%）
  delay: number; // 落下開始までの遅延（秒）
  duration: number; // 落下しきるまでの時間（秒）
  hue: number; // 色相（deg）
  spin: number; // 落下中の回転量（deg）
}

@Component({
  selector: 'app-confetti',
  imports: [],
  templateUrl: './confetti.html',
  styleUrl: './confetti.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Confetti {
  count = input(24);

  // 紙片のパラメータは生成時に固定する（描画のたびに変わらないように）。
  readonly pieces: ConfettiPiece[] = Array.from({ length: 40 }, () => ({
    x: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 2.2 + Math.random() * 1.4,
    hue: Math.floor(Math.random() * 360),
    spin: 360 + Math.random() * 720,
  }));

  // count() が pieces の総数より少ない場合に備え、必要数だけ切り出す。
  get visiblePieces(): ConfettiPiece[] {
    return this.pieces.slice(0, this.count());
  }
}
