/**
 * @file 見出しクリックで本文を格納/展開する共通セクションコンポーネント。
 * 開閉状態は自身では持たず（open input / toggled output の制御コンポーネント）、
 * 複数セクションの開閉をまとめて管理・永続化したい呼び出し側（MistakesState 等）に委ねる。
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-collapsible',
  imports: [],
  templateUrl: './collapsible.html',
  styleUrl: './collapsible.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Collapsible {
  title = input.required<string>();
  open = input.required<boolean>();
  toggled = output<void>();
}
