/**
 * @file 正誤マーク・Enterキー表示などの意味的アイコンをUnicode文字依存から統一するための共通コンポーネント。
 * フォント・OSに依存しないよう、インラインSVGで描画する。
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName = 'correct' | 'incorrect' | 'enter';

@Component({
  selector: 'app-icon',
  imports: [],
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  name = input.required<IconName>();
}
