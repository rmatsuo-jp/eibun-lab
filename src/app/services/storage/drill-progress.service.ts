/**
 * @file ドリルの習熟度（頻出ミス・復習カードの正解ストリーク）と、レベルアップ・タイピングの
 * マスク段階進捗のローカル永続化を担うサービス。StorageService から切り出した「ドリル進捗」専任部分。
 * 各問題の正誤履歴は drillProgress signal（DRILL_PROGRESS_KEY）で正解ストリークとして永続化する。
 * レベルアップ・タイピングのマスク段階進捗は levelUpProgress signal（LEVELUP_PROGRESS_KEY）で
 * セッションID単位に永続化し、日付選択画面での再開・完了表示に使う。
 */
import { Injectable, signal } from '@angular/core';
import { DrillProgress, LevelUpItemProgress } from '../../models/session.model';
import { normalizeDrillKey } from '../../utils/session-stats.util';

const DRILL_PROGRESS_KEY = 'study-english-drill-progress';
const LEVELUP_PROGRESS_KEY = 'study-english-levelup-progress';
// 連続正解がこの回数に達したら「習熟済み」とみなし、ドリルでの出題重みを下げる。
export const DRILL_MASTERY_STREAK = 3;

@Injectable({ providedIn: 'root' })
export class DrillProgressService {
  // ── ドリル習熟度キャッシュ（key = normalizeDrillKey の結果） ─────────
  private drillProgress = signal<Record<string, DrillProgress>>(this.loadDrillProgress());

  // ── レベルアップ・タイピング進捗キャッシュ（sessionId → itemKey → 進捗） ─
  private levelUpProgress = signal<Record<string, Record<string, LevelUpItemProgress>>>(this.loadLevelUpProgress());

  private loadDrillProgress(): Record<string, DrillProgress> {
    const raw = localStorage.getItem(DRILL_PROGRESS_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, DrillProgress>;
    } catch {
      return {};
    }
  }

  getDrillProgress(key: string): DrillProgress | undefined {
    return this.drillProgress()[normalizeDrillKey(key)];
  }

  // 正解なら連続正解数を+1、不正解なら0にリセットして保存する。
  recordDrillResult(key: string, correct: boolean): void {
    const normalized = normalizeDrillKey(key);
    const current = this.drillProgress();
    const prevStreak = current[normalized]?.correctStreak ?? 0;
    const updated: Record<string, DrillProgress> = {
      ...current,
      [normalized]: {
        correctStreak: correct ? prevStreak + 1 : 0,
        lastAttemptAt: new Date().toISOString(),
      },
    };
    localStorage.setItem(DRILL_PROGRESS_KEY, JSON.stringify(updated));
    this.drillProgress.set(updated);
  }

  private loadLevelUpProgress(): Record<string, Record<string, LevelUpItemProgress>> {
    const raw = localStorage.getItem(LEVELUP_PROGRESS_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, Record<string, LevelUpItemProgress>>;
    } catch {
      return {};
    }
  }

  // セッション（日付）1件分の進捗（itemKey → maskLevel/completed）を返す。未着手なら空オブジェクト。
  getLevelUpProgress(sessionId: string): Record<string, LevelUpItemProgress> {
    return this.levelUpProgress()[sessionId] ?? {};
  }

  // 1文分の進捗を更新して保存する。maskLevel は現在のマスク段階、completed は maxLevel で正解済みかどうか。
  setLevelUpItemProgress(sessionId: string, itemKey: string, maskLevel: number, completed: boolean): void {
    const current = this.levelUpProgress();
    const updated: Record<string, Record<string, LevelUpItemProgress>> = {
      ...current,
      [sessionId]: {
        ...current[sessionId],
        [itemKey]: { maskLevel, completed },
      },
    };
    localStorage.setItem(LEVELUP_PROGRESS_KEY, JSON.stringify(updated));
    this.levelUpProgress.set(updated);
  }
}
