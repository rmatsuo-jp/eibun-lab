/**
 * @file 実績タブ等で個別実装されていたプログレスバー（全体進捗・個別実績）を統一する共通コンポーネント。
 * value/max から達成率(%)を算出して幅に反映する。sizeで太さのバリエーションを切り替える。
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-progress-bar',
  imports: [],
  templateUrl: './progress-bar.html',
  styleUrl: './progress-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressBar {
  value = input.required<number>();
  max = input.required<number>();
  size = input<'sm' | 'md'>('md');
  tone = input<'primary' | 'success'>('primary');

  percent = computed(() => {
    const max = this.max();
    if (max <= 0) return 0;
    return Math.min(100, Math.max(0, (this.value() / max) * 100));
  });
}
