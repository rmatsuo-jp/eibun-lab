/**
 * @file 対象機能別（添削／穴埋めクイズ／穴あきタイピング）の累積統計（GamificationStats）の
 * Firestore 双方向同期を担うサービス。features/drill/drill-progress-sync.service.ts と同じパターン
 * （ログイン監視→自動同期、書き込み直後の fire-and-forget push）を適用する。
 * GamificationStatsService の signal を直接は書き換えず、allStats() / persist() 経由で読み書きする。
 * カウンタ系フィールドはマージ時に大きい方を採用し、unlockedAchievements/completedSessionKeys は
 * キー和集合でマージする（一度解除された実績・完了済みセッションは失われない）。
 * lastActiveDate は新しい方を採用する。マージロジックは3機能（correction/cloze/levelup）で
 * 共通の mergeFeatureStats() を使い回す。
 * 同期失敗は syncError signal（読み取り専用）にメッセージを流し、app.ts がグローバルバナーで
 * ユーザーに知らせる（次回の同期成功時に自動でクリアされる）。
 */
import { effect, Injectable, inject, signal } from '@angular/core';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FeatureGamificationStats, GamificationStats } from '@core/models/session.model';
import { AuthService } from '@core/firebase/auth.service';
import { firestore } from '@core/firebase/firebase.init';
import { AchievementId } from './achievement.model';
import { GamificationStatsService, isValidStats } from './gamification-stats.service';

@Injectable({ providedIn: 'root' })
export class GamificationSyncService {
  private auth = inject(AuthService);
  private store = inject(GamificationStatsService);

  // クラウド同期の直近の失敗メッセージ（成功時は null に戻る）。app.ts が購読して通知バナーに出す。
  private _syncError = signal<string | null>(null);
  readonly syncError = this._syncError.asReadonly();

  readonly stats = this.store.stats;

  constructor() {
    // ログイン状態を監視し、ログインした瞬間にクラウドと双方向同期する。
    effect(() => {
      const user = this.auth.user();
      if (user) {
        this.syncFromCloud(user.uid)
          .then(() => this._syncError.set(null))
          .catch((err) => {
            console.error('[GamificationSyncService] クラウド同期に失敗:', err);
            this._syncError.set(
              '実績・統計のクラウド同期に失敗しました。ローカルには保存されています。',
            );
          });
      }
    });
  }

  // ── 書き込み（ローカル保存 + クラウド push を必ずペアで実行） ────────
  recordCorrectionSaved(): void {
    this.store.recordCorrectionSaved();
    this.pushStats();
  }

  recordAnswer(mode: 'cloze' | 'levelup', correct: boolean, currentSessionStreak: number): void {
    this.store.recordAnswer(mode, correct, currentSessionStreak);
    this.pushStats();
  }

  recordSessionComplete(mode: 'cloze' | 'levelup', sessionKey: string, perfect: boolean): void {
    this.store.recordSessionComplete(mode, sessionKey, perfect);
    this.pushStats();
  }

  markUnlocked(ids: AchievementId[]): void {
    this.store.markUnlocked(ids);
    this.pushStats();
  }

  // apps/eibun_lab/users/{uid}/gamification/data の単一ドキュメント参照を返す。
  private statsDoc(uid: string) {
    return doc(firestore, 'apps', 'eibun_lab', 'users', uid, 'gamification', 'data');
  }

  // 書き込み直後に呼び、ログイン中なら現在の全件をクラウドへ反映する（fire-and-forget）。
  private pushStats(): void {
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    setDoc(this.statsDoc(uid), this.store.allStats())
      .then(() => this._syncError.set(null))
      .catch((err) => {
        console.error('[GamificationSyncService] 同期に失敗:', err);
        this._syncError.set(
          '実績・統計のクラウド同期に失敗しました。ローカルには保存されています。',
        );
      });
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
    const merged: GamificationStats = {
      correction: this.mergeFeatureStats(local.correction, cloud.correction),
      cloze: this.mergeFeatureStats(local.cloze, cloud.cloze),
      levelup: this.mergeFeatureStats(local.levelup, cloud.levelup),
      unlockedAchievements: { ...cloud.unlockedAchievements, ...local.unlockedAchievements },
    };
    this.store.persist(merged);

    if (JSON.stringify(merged) !== JSON.stringify(cloud)) {
      await setDoc(this.statsDoc(uid), merged);
    }
  }

  // 1機能分（添削／穴埋めクイズ／穴あきタイピング）の統計をローカル・クラウド間でマージする共通処理。
  private mergeFeatureStats(
    local: FeatureGamificationStats,
    cloud: FeatureGamificationStats,
  ): FeatureGamificationStats {
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
}
