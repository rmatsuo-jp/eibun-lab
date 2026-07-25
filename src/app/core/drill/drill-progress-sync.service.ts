/**
 * @file ドリル習熟度・レベルアップ進捗の Firestore 双方向同期を担うサービス。
 * core/sessions/firestore-sync.service.ts と同じパターン（ログイン監視→自動同期、
 * 書き込み直後の fire-and-forget push）を Drill 機能専用に適用する。
 * DrillProgressService の signal を直接は書き換えず、allDrillProgress() / allLevelUpProgress() /
 * allPerfectCounts() / persist() 経由で読み書きする。ドリル進捗を読み書きする各機能
 * （features/drill, features/mistakes）はこのサービスを唯一の窓口として使い、
 * DrillProgressService を直接 inject しない。
 * ドリル進捗には「削除」概念がないため tombstone は不要。競合は各値の新しさ（lastAttemptAt /
 * maskLevel）、パーフェクト達成数と問題ごとの累積カウンタ（correctCount/attemptCount）は
 * 大きい方（Math.max）で解決する。
 * 同期エラー signal・ログイン監視・push の成否ハンドリングは CloudSyncBase（core/sync）から継承する。
 */
import { Injectable, inject } from '@angular/core';
import { getDoc, setDoc } from 'firebase/firestore';
import { DrillProgress, LevelUpItemProgress } from '@core/models/session.model';
import { userDoc } from '@core/firebase/firestore-paths';
import { CloudSyncBase } from '@core/sync/cloud-sync.base';
import { DrillProgressService } from './drill-progress.service';

// 同期失敗時にユーザーへ見せるメッセージ（ローカル保存は成功している旨を必ず添える）。
const SYNC_ERROR_MESSAGE = 'ドリル進捗のクラウド同期に失敗しました。ローカルには保存されています。';

interface DrillProgressDoc {
  drillProgress?: Record<string, DrillProgress>;
  levelUpProgress?: Record<string, Record<string, LevelUpItemProgress>>;
  perfectCounts?: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class DrillProgressSyncService extends CloudSyncBase {
  private store = inject(DrillProgressService);

  constructor() {
    super('DrillProgressSyncService', SYNC_ERROR_MESSAGE);
    this.initCloudSync();
  }

  // ── 読み取り（DrillProgressService への単純な委譲） ──────────────
  getDrillProgress(key: string): DrillProgress | undefined {
    return this.store.getDrillProgress(key);
  }

  getLevelUpProgress(sessionId: string): Record<string, LevelUpItemProgress> {
    return this.store.getLevelUpProgress(sessionId);
  }

  // ── 書き込み（ローカル保存 + クラウド push を必ずペアで実行） ────────
  recordDrillResult(key: string, correct: boolean): void {
    this.store.recordDrillResult(key, correct);
    this.pushProgress();
  }

  setLevelUpItemProgress(
    sessionId: string,
    itemKey: string,
    maskLevel: number,
    completed: boolean,
  ): void {
    this.store.setLevelUpItemProgress(sessionId, itemKey, maskLevel, completed);
    this.pushProgress();
  }

  getPerfectCount(sessionKey: string): number {
    return this.store.getPerfectCount(sessionKey);
  }

  incrementPerfectCount(sessionKey: string): void {
    this.store.incrementPerfectCount(sessionKey);
    this.pushProgress();
  }

  // apps/eibun_lab/users/{uid}/drillProgress/data の単一ドキュメント参照を返す（パス組み立ては firestore-paths）。
  // セッションと異なり件数の多い配列ではないため、1ドキュメントに両方のマップをまとめて保存する。
  private progressDoc(uid: string) {
    return userDoc(uid, 'drillProgress', 'data');
  }

  // ドリル進捗の書き込み直後に呼び、ログイン中なら現在の全件をクラウドへ反映する（fire-and-forget）。
  private pushProgress(): void {
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    const data: DrillProgressDoc = {
      drillProgress: this.store.allDrillProgress(),
      levelUpProgress: this.store.allLevelUpProgress(),
      perfectCounts: this.store.allPerfectCounts(),
    };
    this.runPush(setDoc(this.progressDoc(uid), data));
  }

  // ログイン直後に呼ぶ双方向同期:
  //   1. ローカルとクラウドをキー単位でマージ（drillProgress は lastAttemptAt が新しい方、
  //      levelUpProgress は maskLevel が大きい方を採用。削除概念がないため上書きベースで良い）。
  //   2. マージ結果をローカルへ反映し、クラウドと食い違う場合のみ push で反映する。
  async syncFromCloud(uid: string): Promise<void> {
    const snap = await getDoc(this.progressDoc(uid));
    const cloud: DrillProgressDoc = snap.exists() ? (snap.data() as DrillProgressDoc) : {};

    const localDrill = this.store.allDrillProgress();
    const localLevelUp = this.store.allLevelUpProgress();
    const localPerfect = this.store.allPerfectCounts();
    const cloudDrill = cloud.drillProgress ?? {};
    const cloudLevelUp = cloud.levelUpProgress ?? {};
    const cloudPerfect = cloud.perfectCounts ?? {};

    const mergedDrill = this.mergeDrillProgress(localDrill, cloudDrill);
    const mergedLevelUp = this.mergeLevelUpProgress(localLevelUp, cloudLevelUp);
    const mergedPerfect = this.mergePerfectCounts(localPerfect, cloudPerfect);
    this.store.persist(mergedDrill, mergedLevelUp, mergedPerfect);

    const changed =
      JSON.stringify(mergedDrill) !== JSON.stringify(cloudDrill) ||
      JSON.stringify(mergedLevelUp) !== JSON.stringify(cloudLevelUp) ||
      JSON.stringify(mergedPerfect) !== JSON.stringify(cloudPerfect);
    if (changed) {
      await setDoc(this.progressDoc(uid), {
        drillProgress: mergedDrill,
        levelUpProgress: mergedLevelUp,
        perfectCounts: mergedPerfect,
      });
    }
  }

  // sessionKeyごとに大きい方（累積回数が多い方）を採用する。
  private mergePerfectCounts(
    local: Record<string, number>,
    cloud: Record<string, number>,
  ): Record<string, number> {
    const keys = new Set([...Object.keys(local), ...Object.keys(cloud)]);
    const merged: Record<string, number> = {};
    for (const key of keys) {
      merged[key] = Math.max(local[key] ?? 0, cloud[key] ?? 0);
    }
    return merged;
  }

  // キーごとに lastAttemptAt が新しい方を採用する。
  // ただし累積カウンタ（correctCount/attemptCount）だけは新しい方をそのまま採るともう一方の端末で
  // 解いた分が失われるため、perfectCounts と同じく大きい方（Math.max）で上書きする
  // （単純な合算は同じ解答を二重に数えてしまうため採らない）。
  private mergeDrillProgress(
    local: Record<string, DrillProgress>,
    cloud: Record<string, DrillProgress>,
  ): Record<string, DrillProgress> {
    const keys = new Set([...Object.keys(local), ...Object.keys(cloud)]);
    const merged: Record<string, DrillProgress> = {};
    for (const key of keys) {
      const l = local[key];
      const c = cloud[key];
      const base =
        !c || (l && new Date(l.lastAttemptAt).getTime() >= new Date(c.lastAttemptAt).getTime())
          ? l
          : c;
      merged[key] = {
        ...base,
        correctCount: Math.max(l?.correctCount ?? 0, c?.correctCount ?? 0),
        attemptCount: Math.max(l?.attemptCount ?? 0, c?.attemptCount ?? 0),
      };
    }
    return merged;
  }

  // sessionId → itemKey ごとに maskLevel が大きい方（進んでいる方）を採用する。
  private mergeLevelUpProgress(
    local: Record<string, Record<string, LevelUpItemProgress>>,
    cloud: Record<string, Record<string, LevelUpItemProgress>>,
  ): Record<string, Record<string, LevelUpItemProgress>> {
    const sessionIds = new Set([...Object.keys(local), ...Object.keys(cloud)]);
    const merged: Record<string, Record<string, LevelUpItemProgress>> = {};
    for (const sessionId of sessionIds) {
      const l = local[sessionId] ?? {};
      const c = cloud[sessionId] ?? {};
      const itemKeys = new Set([...Object.keys(l), ...Object.keys(c)]);
      const items: Record<string, LevelUpItemProgress> = {};
      for (const itemKey of itemKeys) {
        const li = l[itemKey];
        const ci = c[itemKey];
        items[itemKey] = !ci || (li && li.maskLevel >= ci.maskLevel) ? li : ci;
      }
      merged[sessionId] = items;
    }
    return merged;
  }
}
