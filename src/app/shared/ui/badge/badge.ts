/**
 * @file 各featureで個別実装されていたpillバッジ（カテゴリ・実績達成度・スコア等）を統一する共通コンポーネント。
 * variant で色（トークン）を切り替えるのみで、文言は呼び出し側の <ng-content> に委ねる。
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type BadgeVariant = 'default' | 'success' | 'error' | 'warning';

@Component({
  selector: 'app-badge',
  imports: [],
  templateUrl: './badge.html',
  styleUrl: './badge.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Badge {
  variant = input<BadgeVariant>('default');
}
