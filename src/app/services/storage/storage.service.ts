/**
 * @file LocalStorage への永続化窓口となる薄いファサードサービス。
 * 実体は責務ごとに分割した内部サービスに委譲する:
 *  - SessionStoreService   … セッションCRUD・LocalStorage永続化
 *  - FirestoreSyncService  … ログイン時のクラウド双方向同期
 *  - SettingsStoreService  … APIキー・モデル優先順位・テーマ設定
 *  - DrillProgressService  … ドリル習熟度・レベルアップ進捗
 *  - session-stats.util.ts … 統計集計（純粋関数、sessions配列を引数に取る）
 * このファイルの公開メソッドのシグネチャは分割前と同一に保っており、各ページ（practice/drill/history/
 * mistakes/settings/dev）からの呼び出し方は変更不要。コンポーネントから直接 localStorage を操作せず、
 * 必ずこのサービスを経由すること。
 */
import { Injectable, inject } from '@angular/core';
import { CorrectionSession, DrillProgress, LevelUpItemProgress, Mistake, ReviewItem, WritingEvaluation } from '../../models/session.model';
import { DrillProgressService } from './drill-progress.service';
import { FirestoreSyncService } from './firestore-sync.service';
import * as sessionStats from '../../utils/session-stats.util';
import { SessionStoreService } from './session-store.service';
import { AppSettings, SettingsStoreService } from './settings-store.service';

export type { AppSettings } from './settings-store.service';
export type { StudyStats } from '../../utils/session-stats.util';
export { CEFR_ORDER, cefrToNumber, normalizeCategory, normalizeDrillKey } from '../../utils/session-stats.util';
export { DRILL_MASTERY_STREAK } from './drill-progress.service';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private sessionStore = inject(SessionStoreService);
  private firestoreSync = inject(FirestoreSyncService);
  private settingsStore = inject(SettingsStoreService);
  private drillProgressStore = inject(DrillProgressService);

  // 公開ビューは削除済みを除外。表示・集計はすべてこちらを基準にする。
  readonly sessions = this.sessionStore.sessions;

  // ── セッション管理 ────────────────────────────────────────────────
  // 以下3メソッドはローカル保存に加えFirestoreへのpushも行う。ローカル書き込みを追加する際は
  // firestoreSync.pushSessions() の呼び出しも忘れないこと（クラウド側が乖離する）。
  saveSession(session: CorrectionSession): void {
    this.sessionStore.saveSession(session);
    this.firestoreSync.pushSessions([session]);
  }

  deleteSession(id: string): void {
    this.sessionStore.deleteSession(id);
    const target = this.sessionStore.allSessions().find(s => s.id === id);
    if (target) this.firestoreSync.pushSessions([target]);
  }

  importSessions(incoming: CorrectionSession[]): void {
    const added = this.sessionStore.importSessions(incoming);
    this.firestoreSync.pushSessions(added);
  }

  exportSessions(): string {
    return this.sessionStore.exportSessions();
  }

  // ── 設定管理 ──────────────────────────────────────────────────────
  getSettings(): AppSettings {
    return this.settingsStore.getSettings();
  }

  saveSettings(settings: AppSettings): void {
    this.settingsStore.saveSettings(settings);
  }

  // ── ドリル習熟度・レベルアップ進捗 ───────────────────────────────
  getDrillProgress(key: string): DrillProgress | undefined {
    return this.drillProgressStore.getDrillProgress(key);
  }

  recordDrillResult(key: string, correct: boolean): void {
    this.drillProgressStore.recordDrillResult(key, correct);
  }

  getLevelUpProgress(sessionId: string): Record<string, LevelUpItemProgress> {
    return this.drillProgressStore.getLevelUpProgress(sessionId);
  }

  setLevelUpItemProgress(sessionId: string, itemKey: string, maskLevel: number, completed: boolean): void {
    this.drillProgressStore.setLevelUpItemProgress(sessionId, itemKey, maskLevel, completed);
  }

  // ── 統計集計 ──────────────────────────────────────────────────────
  getMistakeStats(): { category: string; count: number }[] {
    return sessionStats.getMistakeStats(this.sessions());
  }

  getStudyStats(): sessionStats.StudyStats {
    return sessionStats.getStudyStats(this.sessions());
  }

  getEvaluationHistory(): { date: string; evaluation: WritingEvaluation }[] {
    return sessionStats.getEvaluationHistory(this.sessions());
  }

  getFrequentMistakes(): (Mistake & { count: number })[] {
    return sessionStats.getFrequentMistakes(this.sessions());
  }

  getReviewItems(): ReviewItem[] {
    return sessionStats.getReviewItems(this.sessions());
  }

  getSessionsWithLevelUp(): CorrectionSession[] {
    return sessionStats.getSessionsWithLevelUp(this.sessions());
  }
}
