/**
 * @file ドリル習熟度・レベルアップ進捗の Firestore 双方向同期を担うサービス。
 * core/sessions/firestore-sync.service.ts と同じパターン（ログイン監視→自動同期、
 * 書き込み直後の fire-and-forget push）を Drill 機能専用に適用する。
 * DrillProgressService の signal を直接は書き換えず、allDrillProgress() / allLevelUpProgress() /
 * persist() 経由で読み書きする。Drill ページ（drill.ts）はこのサービスを窓口として使い、
 * DrillProgressService を直接 inject しない。
 * ドリル進捗には「削除」概念がないため tombstone は不要。競合は各値の新しさ（lastAttemptAt /
 * maskLevel）で解決する。
 */
import { effect, Injectable, inject } from '@angular/core';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { DrillProgress, LevelUpItemProgress } from '@core/models/session.model';
import { AuthService } from '@core/firebase/auth.service';
import { firestore } from '@core/firebase/firebase.init';
import { DrillProgressService } from './drill-progress.service';

interface DrillProgressDoc {
  drillProgress?: Record<string, DrillProgress>;
  levelUpProgress?: Record<string, Record<string, LevelUpItemProgress>>;
}

@Injectable({ providedIn: 'root' })
export class DrillProgressSyncService {
  private auth = inject(AuthService);
  private store = inject(DrillProgressService);

  constructor() {
    // ログイン状態を監視し、ログインした瞬間にクラウドと双方向同期する。
    // ログアウト時（user が null）はローカルキャッシュをそのまま残す。
    effect(() => {
      const user = this.auth.user();
      if (user) {
        this.syncFromCloud(user.uid).catch(err =>
          console.error('[DrillProgressSyncService] クラウド同期に失敗:', err)
        );
      }
    });
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

  setLevelUpItemProgress(sessionId: string, itemKey: string, maskLevel: number, completed: boolean): void {
    this.store.setLevelUpItemProgress(sessionId, itemKey, maskLevel, completed);
    this.pushProgress();
  }

  // apps/study_english/users/{uid}/drillProgress/data の単一ドキュメント参照を返す。
  // セッションと異なり件数の多い配列ではないため、1ドキュメントに両方のマップをまとめて保存する。
  private progressDoc(uid: string) {
    return doc(firestore, 'apps', 'study_english', 'users', uid, 'drillProgress', 'data');
  }

  // ドリル進捗の書き込み直後に呼び、ログイン中なら現在の全件をクラウドへ反映する（fire-and-forget）。
  private pushProgress(): void {
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    const data: DrillProgressDoc = {
      drillProgress: this.store.allDrillProgress(),
      levelUpProgress: this.store.allLevelUpProgress(),
    };
    setDoc(this.progressDoc(uid), data).catch(err =>
      console.error('[DrillProgressSyncService] 同期に失敗:', err)
    );
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
    const cloudDrill = cloud.drillProgress ?? {};
    const cloudLevelUp = cloud.levelUpProgress ?? {};

    const mergedDrill = this.mergeDrillProgress(localDrill, cloudDrill);
    const mergedLevelUp = this.mergeLevelUpProgress(localLevelUp, cloudLevelUp);
    this.store.persist(mergedDrill, mergedLevelUp);

    const changed =
      JSON.stringify(mergedDrill) !== JSON.stringify(cloudDrill) ||
      JSON.stringify(mergedLevelUp) !== JSON.stringify(cloudLevelUp);
    if (changed) {
      await setDoc(this.progressDoc(uid), { drillProgress: mergedDrill, levelUpProgress: mergedLevelUp });
    }
  }

  // キーごとに lastAttemptAt が新しい方を採用する。
  private mergeDrillProgress(
    local: Record<string, DrillProgress>,
    cloud: Record<string, DrillProgress>
  ): Record<string, DrillProgress> {
    const keys = new Set([...Object.keys(local), ...Object.keys(cloud)]);
    const merged: Record<string, DrillProgress> = {};
    for (const key of keys) {
      const l = local[key];
      const c = cloud[key];
      merged[key] = !c || (l && new Date(l.lastAttemptAt).getTime() >= new Date(c.lastAttemptAt).getTime()) ? l : c;
    }
    return merged;
  }

  // sessionId → itemKey ごとに maskLevel が大きい方（進んでいる方）を採用する。
  private mergeLevelUpProgress(
    local: Record<string, Record<string, LevelUpItemProgress>>,
    cloud: Record<string, Record<string, LevelUpItemProgress>>
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
