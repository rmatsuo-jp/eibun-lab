/**
 * @file 対象機能別（添削／穴埋めクイズ／穴あきタイピング）の累積統計（GamificationStats）の
 * ローカル永続化を担うサービス。features/drill/drill-progress.service.ts と同じ構造
 * （signal + readJson/writeJson）で、core層に置くことで features/practice（添削記録）・
 * features/drill（記録・実績判定）・features/achievements（一覧表示）の全てから参照できるようにする
 * （feature間import禁止のため）。
 * クラウド同期は行わない（ローカル専任）。gamification-sync.service.ts が allStats()/persist() 経由で
 * このサービスを読み書きし、Firestore との同期を担う。
 */
import { Injectable, signal } from '@angular/core';
import { FeatureGamificationStats, GamificationStats } from '@core/models/session.model';
import { readJson, writeJson } from '@shared/utils/local-storage.util';
import { toDayKey } from '@shared/utils/date.util';
import { AchievementId } from './achievement.model';
import {
  FEATURE_ID_CLOZE,
  FEATURE_ID_CORRECTION,
  FEATURE_ID_LEVELUP,
} from './gamification-feature-id';

const GAMIFICATION_STATS_KEY = 'eibun-lab-gamification-stats';

function initialFeatureStats(): FeatureGamificationStats {
  return {
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
}

function initialStats(): GamificationStats {
  return {
    features: {
      [FEATURE_ID_CORRECTION]: initialFeatureStats(),
      [FEATURE_ID_CLOZE]: initialFeatureStats(),
      [FEATURE_ID_LEVELUP]: initialFeatureStats(),
    },
    unlockedAchievements: {},
  };
}

// GamificationStats の保存形状を変更した際、LocalStorage の保存キーはそのまま流用したため、
// 旧形状（featuresマップに一般化する前のフラットな correction/cloze/levelup フィールド構造）の
// データが残っている端末では起動時に壊れる。読み込んだJSONが新形状かを検証し、一致しなければ
// 初期値にフォールバックする（マイグレーションは行わない方針、docs/data-design.md §6参照）。
export function isValidStats(value: unknown): value is GamificationStats {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<GamificationStats>;
  return typeof v.features === 'object' && v.features !== null;
}

// 前回活動日からの日数差に応じて日次ストリークを更新する（対象機能を問わず共通のロジック）。
// 同日中の再プレイ/再添削は維持、翌日なら+1、2日以上空いたら1にリセット。
// 日付キーは toDayKey()（ローカル日付）で統一し、添削とドリルの日付境界を一致させる。
function nextDailyStreak(
  prev: FeatureGamificationStats,
  today: string,
): { currentDailyStreak: number; longestDailyStreak: number } {
  if (!prev.lastActiveDate) {
    return { currentDailyStreak: 1, longestDailyStreak: Math.max(1, prev.longestDailyStreak) };
  }
  const diff = daysBetween(prev.lastActiveDate, today);
  const currentDailyStreak =
    diff === 0
      ? Math.max(1, prev.currentDailyStreak)
      : diff === 1
        ? prev.currentDailyStreak + 1
        : 1;
  return {
    currentDailyStreak,
    longestDailyStreak: Math.max(prev.longestDailyStreak, currentDailyStreak),
  };
}

function daysBetween(fromDayKey: string, toDayKeyValue: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (new Date(toDayKeyValue).getTime() - new Date(fromDayKey).getTime()) / msPerDay,
  );
}

@Injectable({ providedIn: 'root' })
export class GamificationStatsService {
  private _stats = signal<GamificationStats>(this.loadStats());
  readonly stats = this._stats.asReadonly();

  private loadStats(): GamificationStats {
    const loaded = readJson<unknown>(GAMIFICATION_STATS_KEY, initialStats());
    return isValidStats(loaded) ? loaded : initialStats();
  }

  // 現在の統計全件を返す（GamificationSyncService がクラウドへの push / マージ元として使用）。
  allStats(): GamificationStats {
    return this._stats();
  }

  // クラウドとマージ済みの状態をローカルへ書き戻す（GamificationSyncService.syncFromCloud から使用）。
  persist(stats: GamificationStats): void {
    writeJson(GAMIFICATION_STATS_KEY, stats);
    this._stats.set(stats);
  }

  // featureId の現在の統計を返す（未登録なら初期値）。
  private featureStats(stats: GamificationStats, featureId: string): FeatureGamificationStats {
    return stats.features[featureId] ?? initialFeatureStats();
  }

  // 添削が保存されるたびに呼ぶ。添削回数を加算し、日次ストリークを更新する。
  recordCorrectionSaved(): void {
    const prev = this._stats();
    const feature = this.featureStats(prev, FEATURE_ID_CORRECTION);
    const today = toDayKey(new Date().toISOString());
    const { currentDailyStreak, longestDailyStreak } = nextDailyStreak(feature, today);
    this.save({
      ...prev,
      features: {
        ...prev.features,
        [FEATURE_ID_CORRECTION]: {
          ...feature,
          totalAttempts: feature.totalAttempts + 1,
          currentDailyStreak,
          longestDailyStreak,
          lastActiveDate: today,
        },
      },
    });
  }

  // ドリル1問分の正誤を加算する。1プレイ内連続正解の自己ベスト更新は呼び出し元（DrillState）が
  // sessionCorrectStreak を管理し、bestInSessionCorrectStreak の更新のみここで行う。
  recordAnswer(featureId: string, correct: boolean, currentSessionStreak: number): void {
    const prev = this._stats();
    const feature = this.featureStats(prev, featureId);
    const updated: FeatureGamificationStats = {
      ...feature,
      totalAttempts: feature.totalAttempts + 1,
      totalCorrect: feature.totalCorrect + (correct ? 1 : 0),
      totalWrong: feature.totalWrong + (correct ? 0 : 1),
      bestInSessionCorrectStreak: Math.max(
        feature.bestInSessionCorrectStreak,
        currentSessionStreak,
      ),
    };
    this.save({ ...prev, features: { ...prev.features, [featureId]: updated } });
  }

  // ドリルの1セッション（1回の出題セット/日程）完了時に呼ぶ。同じ sessionKey は重複カウントしない。
  recordSessionComplete(featureId: string, sessionKey: string, perfect: boolean): void {
    const prev = this._stats();
    const feature = this.featureStats(prev, featureId);
    if (feature.completedSessionKeys[sessionKey]) return;

    const today = toDayKey(new Date().toISOString());
    const { currentDailyStreak, longestDailyStreak } = nextDailyStreak(feature, today);
    const currentPerfectStreak = perfect ? feature.currentPerfectStreak + 1 : 0;

    const updated: FeatureGamificationStats = {
      ...feature,
      sessionsCompleted: feature.sessionsCompleted + 1,
      perfectSessionCount: feature.perfectSessionCount + (perfect ? 1 : 0),
      currentPerfectStreak,
      longestPerfectStreak: Math.max(feature.longestPerfectStreak, currentPerfectStreak),
      currentDailyStreak,
      longestDailyStreak,
      lastActiveDate: today,
      completedSessionKeys: { ...feature.completedSessionKeys, [sessionKey]: true },
    };
    this.save({ ...prev, features: { ...prev.features, [featureId]: updated } });
  }

  // 新規解除された実績IDを解除済みとして記録する（解除日時はISO文字列で保存）。
  markUnlocked(ids: AchievementId[]): void {
    if (ids.length === 0) return;
    const prev = this._stats();
    const now = new Date().toISOString();
    const unlockedAchievements = { ...prev.unlockedAchievements };
    for (const id of ids) unlockedAchievements[id] = now;
    this.save({ ...prev, unlockedAchievements });
  }

  private save(stats: GamificationStats): void {
    writeJson(GAMIFICATION_STATS_KEY, stats);
    this._stats.set(stats);
  }
}
