/**
 * @file 実績解除トーストの表示状態を保持する小さなプレーンクラス。
 * 「新規解除された実績IDを積み、一定時間で自動的に消す」だけを担う。
 * practice / drill が同じ挙動を各 state service に複製していたのを1箇所へまとめたもの。
 * DI 経由の共有シングルトンにすると画面をまたいでトーストが混ざるため、
 * providedIn は付けず、各 state service が new して専有インスタンスとして持つ。
 */
import { signal } from '@angular/core';
import { AchievementId } from './achievement.model';
import { TranslationKey } from '@core/i18n/translations';

// トーストの自動消滅までの時間（グローバル通知バナーと同じ4秒）。
const ACHIEVEMENT_TOAST_MS = 4000;

export class AchievementToast {
  // 表示中の新規解除実績ID一覧。テンプレートが直接読む。
  readonly items = signal<AchievementId[]>([]);
  private timer?: ReturnType<typeof setTimeout>;

  /**
   * 解除された実績を積み、自動消滅タイマーを張り直す
   * （連続で解除された場合は最後の解除から ACHIEVEMENT_TOAST_MS 表示する）。
   */
  push(ids: AchievementId[]): void {
    clearTimeout(this.timer);
    this.items.update((prev) => [...prev, ...ids]);
    this.timer = setTimeout(() => this.items.set([]), ACHIEVEMENT_TOAST_MS);
  }

  /** トーストを閉じる（自動消滅タイマーも解除する）。 */
  dismiss(): void {
    clearTimeout(this.timer);
    this.items.set([]);
  }
}

/**
 * 実績IDから i18n タイトルキー（achievements.<id>.title）を組み立てる。
 * AchievementId は core/achievements 側で string リテラルユニオンとして定義されており
 * i18n の TranslationKey を知らないため、ここでキャストする
 * （core/i18n/localized-session.util.ts と同じ方針）。
 */
export function achievementTitleKey(id: AchievementId): TranslationKey {
  return `achievements.${id}.title` as TranslationKey;
}
