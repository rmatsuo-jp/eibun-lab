/**
 * @file 実績一覧ページ。core/achievements の ACHIEVEMENTS 定義と GamificationSyncService の
 * 統計・解除状況を突き合わせて表示するだけの薄いコンポーネント（表示ロジックはテンプレート側）。
 * 実績は対象機能（添削・穴埋めクイズ・穴あきタイピング）ごとに3セクションで表示する。
 * 「制覇」（cloze-mastery/levelup-mastery）はドリル機能側のデータ（features/drill専有）がないと
 * 達成度を算出できないため、未解除時は進捗（現在値/しきい値）を表示せずロック表示のみ行う
 * （achievement.model.ts 参照）。
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ACHIEVEMENTS } from '@core/achievements/achievement-definitions';
import { AchievementGroup } from '@core/achievements/achievement.model';
import { GamificationSyncService } from '@core/achievements/gamification-sync.service';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslationKey } from '@core/i18n/translations';

// AchievementDef.titleKey/descKey は core 層（i18n非依存）のため string 型で定義されている。
// ここで i18n の TranslationKey へキャストする（core/i18n/localized-session.util.ts と同じ方針）。
interface AchievementView {
  id: string;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  unlocked: boolean;
  unlockedAt: string | null;
  progressText: string | null; // 未解除かつ progress 定義がある場合のみ「現在値/しきい値」
  progressRatio: number | null; // 未解除かつ progress 定義がある場合のみ 0-1 の割合
}

const GROUP_ORDER: AchievementGroup[] = ['correction', 'cloze', 'levelup'];

@Component({
  selector: 'app-achievements',
  imports: [DatePipe],
  templateUrl: './achievements.html',
  styleUrl: './achievements.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Achievements {
  protected i18n = inject(I18nService);
  private gamification = inject(GamificationSyncService);

  protected groups = GROUP_ORDER;

  protected views = computed<Record<AchievementGroup, AchievementView[]>>(() => {
    const stats = this.gamification.stats();
    const result: Record<AchievementGroup, AchievementView[]> = {
      correction: [],
      cloze: [],
      levelup: [],
    };
    for (const def of ACHIEVEMENTS) {
      const unlockedAt = stats.unlockedAchievements[def.id] ?? null;
      const current =
        unlockedAt === null && def.progress
          ? Math.min(def.progress.currentValue(stats), def.progress.target)
          : null;
      result[def.group].push({
        id: def.id,
        titleKey: def.titleKey as TranslationKey,
        descKey: def.descKey as TranslationKey,
        unlocked: unlockedAt !== null,
        unlockedAt,
        progressText: current !== null ? `${current}/${def.progress!.target}` : null,
        progressRatio: current !== null ? current / def.progress!.target : null,
      });
    }
    return result;
  });

  // グループ見出しの i18n キー（achievements.category.<group>）。
  protected categoryHeadingKey(group: AchievementGroup): TranslationKey {
    return `achievements.category.${group}` as TranslationKey;
  }

  protected unlockedCount = computed(
    () => Object.keys(this.gamification.stats().unlockedAchievements).length,
  );

  protected totalCount = ACHIEVEMENTS.length;
}
