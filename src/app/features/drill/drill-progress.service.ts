/**
 * @file ドリルの習熟度（頻出ミス・復習カードの正解ストリーク）と、穴あきタイピングの
 * マスク段階進捗のローカル永続化を担うサービス。Drill 機能専用のストア（features/drill 内に同居）。
 * 各問題の正誤履歴は drillProgress signal（DRILL_PROGRESS_KEY）で正解ストリーク（出題重み用）と
 * everCorrect（1回でも正解したかの永続フラグ、達成バッジ用）として永続化する。
 * 穴あきタイピングのマスク段階進捗は levelUpProgress signal（LEVELUP_PROGRESS_KEY）で
 * セッションID単位に永続化し、日付選択画面での再開・完了表示に使う。
 * クラウド同期は行わない（ローカル専任）。DrillProgressSyncService が allDrillProgress() /
 * allLevelUpProgress() / allPerfectCounts() / persist() 経由でこのサービスを読み書きし、Firestore との同期を担う。
 * パーフェクト達成数（perfectCounts、キー = `cloze-${sessionId}` / `levelup-${sessionId}`）は、
 * 日程を満点（全問正解）で完了するたびに加算する累積カウンタ。GamificationStatsService の
 * perfectSessionCount とは異なり日程あたり1回に制限しない（再挑戦のたびに増える）ため、
 * クリア済みバッジとは別に日付選択画面のバッジ表示に使う。
 */
import { Injectable, signal } from '@angular/core';
import { DrillProgress, LevelUpItemProgress } from '@core/models/session.model';
import { normalizeDrillKey } from '@core/stats/session-stats.util';
import { readJson, writeJson } from '@shared/utils/local-storage.util';

const DRILL_PROGRESS_KEY = 'eibun-lab-drill-progress';
const LEVELUP_PROGRESS_KEY = 'eibun-lab-levelup-progress';
const PERFECT_COUNT_KEY = 'eibun-lab-drill-perfect-count';
// 連続正解がこの回数に達したら「習熟済み」とみなし、ドリルでの出題重みを下げる。
export const DRILL_MASTERY_STREAK = 3;

@Injectable({ providedIn: 'root' })
export class DrillProgressService {
  // ── ドリル習熟度キャッシュ（key = normalizeDrillKey の結果） ─────────
  private drillProgress = signal<Record<string, DrillProgress>>(this.loadDrillProgress());

  // ── 穴あきタイピング進捗キャッシュ（sessionId → itemKey → 進捗） ─
  private levelUpProgress = signal<Record<string, Record<string, LevelUpItemProgress>>>(
    this.loadLevelUpProgress(),
  );

  // ── パーフェクト達成数キャッシュ（sessionKey = `cloze-${id}`/`levelup-${id}` → 累積回数） ─
  private perfectCounts = signal<Record<string, number>>(this.loadPerfectCounts());

  private loadDrillProgress(): Record<string, DrillProgress> {
    return readJson<Record<string, DrillProgress>>(DRILL_PROGRESS_KEY, {});
  }

  getDrillProgress(key: string): DrillProgress | undefined {
    return this.drillProgress()[normalizeDrillKey(key)];
  }

  // 現在の習熟度全件を返す（DrillProgressSyncService がクラウドへの push / マージ元として使用）。
  allDrillProgress(): Record<string, DrillProgress> {
    return this.drillProgress();
  }

  // 現在のレベルアップ進捗全件を返す（同上）。
  allLevelUpProgress(): Record<string, Record<string, LevelUpItemProgress>> {
    return this.levelUpProgress();
  }

  // 現在のパーフェクト達成数全件を返す（同上）。
  allPerfectCounts(): Record<string, number> {
    return this.perfectCounts();
  }

  // クラウドとマージ済みの状態をローカルへ書き戻す（DrillProgressSyncService.syncFromCloud から使用）。
  persist(
    drillProgress: Record<string, DrillProgress>,
    levelUpProgress: Record<string, Record<string, LevelUpItemProgress>>,
    perfectCounts: Record<string, number>,
  ): void {
    writeJson(DRILL_PROGRESS_KEY, drillProgress);
    this.drillProgress.set(drillProgress);
    writeJson(LEVELUP_PROGRESS_KEY, levelUpProgress);
    this.levelUpProgress.set(levelUpProgress);
    writeJson(PERFECT_COUNT_KEY, perfectCounts);
    this.perfectCounts.set(perfectCounts);
  }

  // 正解なら連続正解数を+1、不正解なら0にリセットして保存する。
  // everCorrect は1回でも正解したら true になり、以後不正解が続いても false には戻らない。
  recordDrillResult(key: string, correct: boolean): void {
    const normalized = normalizeDrillKey(key);
    const current = this.drillProgress();
    const prev = current[normalized];
    const updated: Record<string, DrillProgress> = {
      ...current,
      [normalized]: {
        correctStreak: correct ? (prev?.correctStreak ?? 0) + 1 : 0,
        everCorrect: (prev?.everCorrect ?? false) || correct,
        lastAttemptAt: new Date().toISOString(),
      },
    };
    writeJson(DRILL_PROGRESS_KEY, updated);
    this.drillProgress.set(updated);
  }

  private loadLevelUpProgress(): Record<string, Record<string, LevelUpItemProgress>> {
    return readJson<Record<string, Record<string, LevelUpItemProgress>>>(LEVELUP_PROGRESS_KEY, {});
  }

  // セッション（日付）1件分の進捗（itemKey → maskLevel/completed）を返す。未着手なら空オブジェクト。
  getLevelUpProgress(sessionId: string): Record<string, LevelUpItemProgress> {
    return this.levelUpProgress()[sessionId] ?? {};
  }

  // 1文分の進捗を更新して保存する。maskLevel は現在のマスク段階、completed は maxLevel で正解済みかどうか。
  setLevelUpItemProgress(
    sessionId: string,
    itemKey: string,
    maskLevel: number,
    completed: boolean,
  ): void {
    const current = this.levelUpProgress();
    const updated: Record<string, Record<string, LevelUpItemProgress>> = {
      ...current,
      [sessionId]: {
        ...current[sessionId],
        [itemKey]: { maskLevel, completed },
      },
    };
    writeJson(LEVELUP_PROGRESS_KEY, updated);
    this.levelUpProgress.set(updated);
  }

  private loadPerfectCounts(): Record<string, number> {
    return readJson<Record<string, number>>(PERFECT_COUNT_KEY, {});
  }

  // sessionKey（`cloze-${id}`/`levelup-${id}`）の累積パーフェクト達成数を返す。未達成なら0。
  getPerfectCount(sessionKey: string): number {
    return this.perfectCounts()[sessionKey] ?? 0;
  }

  // 日程を満点で完了するたびに呼び、該当sessionKeyの達成数を+1して保存する。
  incrementPerfectCount(sessionKey: string): void {
    const current = this.perfectCounts();
    const updated: Record<string, number> = {
      ...current,
      [sessionKey]: (current[sessionKey] ?? 0) + 1,
    };
    writeJson(PERFECT_COUNT_KEY, updated);
    this.perfectCounts.set(updated);
  }
}
