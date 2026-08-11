/**
 * @file 対象機能別（添削／穴埋めクイズ／穴あきタイピング）の累積統計（GamificationStats）の
 * Firestore 双方向同期を担うサービス。core/drill/drill-progress-sync.service.ts と同じパターン
 * （ログイン監視→自動同期、書き込み直後の fire-and-forget push）を CloudSyncBase から継承する。
 * GamificationStatsService の signal を直接は書き換えず、allStats() / persist() 経由で読み書きする。
 * カウンタ系フィールドはマージ時に大きい方を採用し、unlockedAchievements/completedSessionKeys は
 * キー和集合でマージする（一度解除された実績・完了済みセッションは失われない）。
 * lastActiveDate は新しい方を採用する。
 * totalXp（累積経験値）も大きい方を採用する。2端末が同時にオフラインで稼いだ分は合算されず
 * 最大値になるが、合算方式は採れない（pushStats() が書き込みのたびに発火し、書き込み単位の
 * 冪等キーを持たないため、同じドキュメントの再同期で二重計上してしまう）。
 * 最大値方式は冪等で、このファイル内の他のカウンタ全てと一貫し、損失も小さい方の端末の
 * オフライン獲得分に限定される。
 * dailyMissions（当日ぶんのデイリーミッション進捗）だけは最大値方式を採れない。dayKey が
 * 異なる場合は新しい日付の方を丸ごと採用し（前日ぶんの進捗を今日へ持ち越さないため）、
 * 同一日付の場合のみミッション別に大きい方を採り、達成済みはキー和集合でマージする
 * （mergeDailyMissions 参照）。マージロジックは GamificationStats.features のキー（featureId）の
 * 和集合に対して共通の mergeFeatureStats() を使い回す（featureId別に分岐しない汎用実装）。
 * 同期エラー signal・ログイン監視・push の成否ハンドリングは CloudSyncBase（core/sync）から継承する。
 * setDoc 直前は必ず stripUndefinedDeep()（core/sync/strip-undefined.util）を通し、lastActiveDate 等
 * undefined になり得る任意フィールドを取り除く（Firestore は undefined を受け付けないため）。
 */
import { Injectable, inject } from '@angular/core';
import { getDoc, setDoc } from 'firebase/firestore';
import {
  DailyMissionState,
  FeatureGamificationStats,
  GamificationStats,
} from '@core/models/session.model';
import { userDoc } from '@core/firebase/firestore-paths';
import { CloudSyncBase } from '@core/sync/cloud-sync.base';
import { stripUndefinedDeep } from '@core/sync/strip-undefined.util';
import { AchievementId } from './achievement.model';
import { DailyMissionMetric, pickMissionsFor } from './daily-mission';
import { GamificationStatsService, isValidStats } from './gamification-stats.service';

// 同期失敗時にユーザーへ見せるメッセージ（ローカル保存は成功している旨を必ず添える）。
const SYNC_ERROR_MESSAGE = '実績・統計のクラウド同期に失敗しました。ローカルには保存されています。';

// mergeFeatureStats() でどちらか一方にしかfeatureIdが存在しない場合のフォールバック初期値。
const EMPTY_FEATURE_STATS: FeatureGamificationStats = {
  totalAttempts: 0,
  totalCorrect: 0,
  totalWrong: 0,
  sessionsCompleted: 0,
  perfectSessionCount: 0,
  currentPerfectStreak: 0,
  longestPerfectStreak: 0,
  currentDailyStreak: 0,
  longestDailyStreak: 0,
  bestInSessionCorrectStreak: 0,
  completedSessionKeys: {},
};

@Injectable({ providedIn: 'root' })
export class GamificationSyncService extends CloudSyncBase {
  private store = inject(GamificationStatsService);

  readonly stats = this.store.stats;
  // 当日ぶんのデイリーミッション状態（日付境界の判定は store 側が読み出しのたびに行う）。
  readonly dailyMissions = this.store.dailyMissions;

  constructor() {
    super('GamificationSyncService', SYNC_ERROR_MESSAGE);
    this.initCloudSync();
  }

  // ── 書き込み（ローカル保存 + クラウド push を必ずペアで実行） ────────
  recordCorrectionSaved(): void {
    this.store.recordCorrectionSaved();
    this.pushStats();
  }

  recordAnswer(featureId: string, correct: boolean, currentSessionStreak: number): void {
    this.store.recordAnswer(featureId, correct, currentSessionStreak);
    this.pushStats();
  }

  // 実際に計上されたかを呼び出し元へ伝える（重複完了なら false。デイリーミッションの
  // パーフェクト系をこの戻り値でガードする）。
  recordSessionComplete(featureId: string, sessionKey: string, perfect: boolean): boolean {
    const counted = this.store.recordSessionComplete(featureId, sessionKey, perfect);
    this.pushStats();
    return counted;
  }

  recordMissionMetric(metric: DailyMissionMetric, amount: number): string[] {
    const newlyCompleted = this.store.recordMissionMetric(metric, amount);
    this.pushStats();
    return newlyCompleted;
  }

  addXp(amount: number): void {
    this.store.addXp(amount);
    this.pushStats();
  }

  markUnlocked(ids: AchievementId[]): void {
    this.store.markUnlocked(ids);
    this.pushStats();
  }

  // apps/eibun_lab/users/{uid}/gamification/data の単一ドキュメント参照を返す（パス組み立ては firestore-paths）。
  private statsDoc(uid: string) {
    return userDoc(uid, 'gamification', 'data');
  }

  // 書き込み直後に呼び、ログイン中なら現在の全件をクラウドへ反映する（fire-and-forget）。
  private pushStats(): void {
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    this.runPush(setDoc(this.statsDoc(uid), stripUndefinedDeep(this.store.allStats())));
  }

  // ログイン直後に呼ぶ双方向同期:
  //   1. ローカルとクラウドをフィールド単位でマージ（カウンタ系は大きい方、unlockedAchievements/
  //      completedSessionKeys はキー和集合、lastActiveDateは新しい方）。
  //   2. マージ結果をローカルへ反映し、クラウドと食い違う場合のみ push で反映する。
  async syncFromCloud(uid: string): Promise<void> {
    const snap = await getDoc(this.statsDoc(uid));
    const rawCloud = snap.exists() ? snap.data() : undefined;
    // 実績のグルーピングを対象機能別に再設計した際の旧形状（フラットなGamificationStats）が
    // Firestore に残っている場合、そのまま使うと undefined 参照で壊れるため無視する
    // （本番未リリースのため移行処理は不要な方針、docs/todo.md 参照）。
    const cloud = isValidStats(rawCloud) ? rawCloud : undefined;
    if (!cloud) return;

    const local = this.store.allStats();
    const featureIds = new Set([...Object.keys(local.features), ...Object.keys(cloud.features)]);
    const features: Record<string, FeatureGamificationStats> = {};
    for (const featureId of featureIds) {
      features[featureId] = this.mergeFeatureStats(
        local.features[featureId],
        cloud.features[featureId],
      );
    }
    const merged: GamificationStats = {
      features,
      unlockedAchievements: { ...cloud.unlockedAchievements, ...local.unlockedAchievements },
      totalXp: Math.max(local.totalXp ?? 0, cloud.totalXp ?? 0),
      dailyMissions: this.mergeDailyMissions(local.dailyMissions, cloud.dailyMissions),
    };
    this.store.persist(merged);

    if (JSON.stringify(merged) !== JSON.stringify(cloud)) {
      await setDoc(this.statsDoc(uid), stripUndefinedDeep(merged));
    }
  }

  // 1機能分（featureIdごと）の統計をローカル・クラウド間でマージする共通処理。
  // どちらか一方にしか存在しないfeatureId（新機能追加直後など）は初期値扱いでマージする。
  private mergeFeatureStats(
    localIn: FeatureGamificationStats | undefined,
    cloudIn: FeatureGamificationStats | undefined,
  ): FeatureGamificationStats {
    const local = localIn ?? EMPTY_FEATURE_STATS;
    const cloud = cloudIn ?? EMPTY_FEATURE_STATS;
    const lastActiveDate =
      !local.lastActiveDate || (cloud.lastActiveDate && cloud.lastActiveDate > local.lastActiveDate)
        ? cloud.lastActiveDate
        : local.lastActiveDate;
    return {
      totalAttempts: Math.max(local.totalAttempts, cloud.totalAttempts),
      totalCorrect: Math.max(local.totalCorrect, cloud.totalCorrect),
      totalWrong: Math.max(local.totalWrong, cloud.totalWrong),
      sessionsCompleted: Math.max(local.sessionsCompleted, cloud.sessionsCompleted),
      perfectSessionCount: Math.max(local.perfectSessionCount, cloud.perfectSessionCount),
      currentPerfectStreak: Math.max(local.currentPerfectStreak, cloud.currentPerfectStreak),
      longestPerfectStreak: Math.max(local.longestPerfectStreak, cloud.longestPerfectStreak),
      currentDailyStreak: Math.max(local.currentDailyStreak, cloud.currentDailyStreak),
      longestDailyStreak: Math.max(local.longestDailyStreak, cloud.longestDailyStreak),
      lastActiveDate,
      bestInSessionCorrectStreak: Math.max(
        local.bestInSessionCorrectStreak,
        cloud.bestInSessionCorrectStreak,
      ),
      completedSessionKeys: { ...local.completedSessionKeys, ...cloud.completedSessionKeys },
    };
  }

  // 当日ぶんのデイリーミッション進捗をローカル・クラウド間でマージする。
  // 他のフィールドと違い、ここだけは Math.max 一辺倒にできない:
  //  1. 片側にしか無ければそれをそのまま採用する。
  //  2. dayKey が違う場合は「新しい dayKey の方を丸ごと」採用する（'YYYY-MM-DD' なので辞書順比較で足りる）。
  //     日をまたいだ進捗の合成は行わない。前日ぶんの進捗を今日のカウンタへ漏らしてはいけないため、
  //     この分岐で Math.max を使うのは誤りになる。
  //  3. dayKey が同じ場合は、ミッション別に進捗の大きい方を採り、達成済みはキー和集合でマージする
  //     （completedSessionKeys と同じ考え方）。missionIds は dayKey から決定論的に決まるため
  //     両者一致するはずだが、件数が食い違った場合は pickMissionsFor で作り直して防御する。
  private mergeDailyMissions(
    local: DailyMissionState | undefined,
    cloud: DailyMissionState | undefined,
  ): DailyMissionState | undefined {
    if (!local) return cloud;
    if (!cloud) return local;
    if (local.dayKey !== cloud.dayKey) return local.dayKey > cloud.dayKey ? local : cloud;

    const missionIds =
      local.missionIds.length === cloud.missionIds.length
        ? local.missionIds
        : pickMissionsFor(local.dayKey).map((m) => m.id);

    const progress: Record<string, number> = { ...cloud.progress };
    for (const [id, value] of Object.entries(local.progress)) {
      progress[id] = Math.max(value, cloud.progress[id] ?? 0);
    }

    return {
      dayKey: local.dayKey,
      missionIds,
      progress,
      completed: { ...local.completed, ...cloud.completed },
    };
  }
}
