/**
 * @file 対象機能別（添削／穴埋めクイズ／穴あきタイピング）の累積統計（GamificationStats）と、
 * 機能をまたいだ累積経験値（totalXp。ラボレベルの算出元）、および当日ぶんの
 * デイリーミッション進捗（dailyMissions）のローカル永続化を担うサービス。
 * デイリーミッションの日付境界は rolledMissions() が読み書きのたびに判定し、
 * dayKey が変わっていれば pickMissionsFor() で当日ぶんを組み直す（タイマーは持たない。
 * 表示側は _today signal 経由で、タブ再表示・フォーカス復帰のタイミングで日付を読み直す）。
 * core/drill/drill-progress.service.ts と同じ構造
 * （signal + readJson/writeJson）で、core層に置くことで features/practice（添削記録）・
 * features/drill（記録・実績判定）・features/achievements（一覧表示）の全てから参照できるようにする
 * （feature間import禁止のため）。
 * クラウド同期は行わない（ローカル専任）。gamification-sync.service.ts が allStats()/persist() 経由で
 * このサービスを読み書きし、Firestore との同期を担う。
 */
import { Injectable, computed, signal } from '@angular/core';
import {
  DailyMissionState,
  FeatureGamificationStats,
  GamificationStats,
} from '@core/models/session.model';
import { readJson, writeJson } from '@shared/utils/local-storage.util';
import { toDayKey } from '@shared/utils/date.util';
import { AchievementId } from './achievement.model';
import { DailyMissionMetric, findMission, pickMissionsFor } from './daily-mission';
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
    totalXp: 0,
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

// 保存済みのデイリーミッション状態を「今日ぶん」に整える。
// dayKey が今日でなければ（未設定・前日ぶちを含む）、今日の3件を決定論的に選び直して進捗を空に戻す。
// 前日ぶんの進捗は引き継がない（日をまたいだ持ち越しをさせないため）。
export function rolledMissions(saved: DailyMissionState | undefined): DailyMissionState {
  const today = toDayKey(new Date().toISOString());
  if (saved?.dayKey === today) return saved;
  return {
    dayKey: today,
    missionIds: pickMissionsFor(today).map((m) => m.id),
    progress: {},
    completed: {},
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

  // dailyMissions（computed）を日付境界で再評価させるための「今日」。_stats が変わらない限り
  // computed は再計算されないため、日付そのものを依存 signal として持つ必要がある。
  // タイマーは持たず、タブが再び見えた時／ウィンドウにフォーカスが戻った時にだけ読み直す。
  private readonly _today = signal(toDayKey(new Date().toISOString()));

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.refreshToday();
      });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => this.refreshToday());
    }
  }

  private refreshToday(): void {
    const today = toDayKey(new Date().toISOString());
    if (today !== this._today()) this._today.set(today);
  }

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
  // 実際に計上したかを返す（false = 既に完了済みで無視した）。デイリーミッションのパーフェクト系を
  // 重複加算させないため、呼び出し側はこの戻り値を見てからミッション指標を加算する。
  recordSessionComplete(featureId: string, sessionKey: string, perfect: boolean): boolean {
    const prev = this._stats();
    const feature = this.featureStats(prev, featureId);
    if (feature.completedSessionKeys[sessionKey]) return false;

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
    return true;
  }

  // 累積経験値を加算する。付与量の決定は core/achievements/xp.util.ts の純関数側の責務で、
  // ここは保存のみを担う（recordAnswer 等のシグネチャを変えずに済ませるため独立したメソッドにする）。
  addXp(amount: number): void {
    if (amount <= 0) return;
    const prev = this._stats();
    this.save({ ...prev, totalXp: (prev.totalXp ?? 0) + amount });
  }

  // ── デイリーミッション ────────────────────────────────────
  // 当日ぶんのミッション状態。保存済みの dayKey が今日と違えば、その場で新しい3件を組み直す。
  // _today を依存として読むことで、画面を開いたまま日付をまたいでも（タブ復帰・フォーカス復帰の
  // タイミングで refreshToday() が走り）表示が当日ぶんへ切り替わる。
  readonly dailyMissions = computed<DailyMissionState>(() => {
    this._today();
    return rolledMissions(this._stats().dailyMissions);
  });

  // 指標を1件加算し、新たに達成したミッションのidを返す（呼び出し元が経験値付与に使う）。
  // 'bestStreak' は累積ではなくその日の最大値で判定する。
  recordMissionMetric(metric: DailyMissionMetric, amount: number): string[] {
    if (amount <= 0) return [];
    const prev = this._stats();
    const state = rolledMissions(prev.dailyMissions);

    const progress = { ...state.progress };
    const completed = { ...state.completed };
    const newlyCompleted: string[] = [];

    for (const id of state.missionIds) {
      const def = findMission(id);
      if (!def || def.metric !== metric || completed[id]) continue;

      const current = progress[id] ?? 0;
      progress[id] = metric === 'bestStreak' ? Math.max(current, amount) : current + amount;
      if (progress[id] >= def.target) {
        completed[id] = true;
        newlyCompleted.push(id);
      }
    }

    this.save({ ...prev, dailyMissions: { ...state, progress, completed } });
    return newlyCompleted;
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
