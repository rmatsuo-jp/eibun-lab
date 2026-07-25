/**
 * @file ミス傾向分析ページ。
 * 集計・表示データの組み立ては MistakesState サービスに委譲する（テンプレートから state.xxx で参照）。
 * 本コンポーネントは DOM を持たない薄い橋渡しに専念する（practice.ts/PracticeState と同じ設計）。
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { Badge } from '@shared/ui/badge/badge';
import { MistakesState } from './mistakes-state.service';

@Component({
  selector: 'app-mistakes',
  imports: [Badge],
  templateUrl: './mistakes.html',
  styleUrl: './mistakes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Mistakes {
  protected state = inject(MistakesState);
  protected i18n = inject(I18nService);
}
