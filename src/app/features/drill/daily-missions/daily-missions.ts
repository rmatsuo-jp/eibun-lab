/**
 * @file ドリルのモード選択画面に出す「今日のデイリーミッション」一覧。
 * drill.html から切り出した表示専用のUIブロックで、状態は一切持たない
 * （sentence-list と同じ設計）。当日ぶんのミッションは DrillState.dailyMissions() が
 * 組み立てたものを input() で受け取るだけで、core のサービスは直接参照しない
 * （依存方向 features → core → shared を features 内でも素直に保つため）。
 * 進捗表示は shared/ui/progress-bar、達成済みの印は shared/ui/icon を再利用する。
 */
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslationKey } from '@core/i18n/translations';
import { ProgressBar } from '@shared/ui/progress-bar/progress-bar';
import { Icon } from '@shared/ui/icon/icon';

// 表示に必要な1件分の情報。DrillState.dailyMissions() が返す形。
export interface DailyMissionView {
  id: string;
  titleKey: string;
  target: number;
  current: number;
  completed: boolean;
}

@Component({
  selector: 'app-daily-missions',
  imports: [ProgressBar, Icon],
  templateUrl: './daily-missions.html',
  styleUrl: './daily-missions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DailyMissions {
  protected i18n = inject(I18nService);

  missions = input.required<DailyMissionView[]>();

  // DailyMissionDef.titleKey は core 層（i18n非依存）のため string 型。
  // ここで TranslationKey へキャストする（features/achievements と同じ方針）。
  protected titleKey(key: string): TranslationKey {
    return key as TranslationKey;
  }
}
