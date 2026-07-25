/**
 * @file 各featureが個別に再定義していたカード（背面色・枠線・角丸・パディング）のrecipeを統一する共通コンポーネント。
 * 見た目は既存の .card グローバルクラス（styles.scss）と同一。paddingでバリエーションを切り替える。
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-card',
  imports: [],
  templateUrl: './card.html',
  styleUrl: './card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Card {
  padding = input<'sm' | 'md'>('md');
}
