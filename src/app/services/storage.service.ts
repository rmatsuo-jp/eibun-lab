/**
 * @file LocalStorage への永続化を担うサービス。
 * セッション管理（CRUD）・設定管理・ミス統計集計・学習統計（streak等）を一元管理する。
 * sessions signal でリアクティブなキャッシュを提供する。
 * ログイン中（AuthService）は Firestore とも双方向同期し、複数端末でセッションを共有する。
 * 削除は物理削除せず deleted フラグ（tombstone）で表現し、削除も多端末へ伝播させる。
 * コンポーネントから直接 localStorage を操作せず、必ずこのサービスを経由すること。
 */
import { computed, effect, Injectable, inject, signal } from '@angular/core';
import {
  collection,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { CorrectionSession, Mistake, ReviewItem, WritingEvaluation } from '../models/session.model';
import { AuthService } from './auth.service';
import { firestore } from './firebase.init';

// CEFR レベルを数値化（グラフ描画用）。未知の値は 0 として扱う。
export const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export function cefrToNumber(level: string): number {
  const idx = CEFR_ORDER.indexOf(level.toUpperCase().trim() as (typeof CEFR_ORDER)[number]);
  return idx === -1 ? 0 : idx + 1;
}

const SESSIONS_KEY = 'correction_sessions';
const SETTINGS_KEY = 'app_settings';

// ── 学習統計型（ダッシュボード表示用） ──────────────────────────────
export interface StudyStats {
  totalSessions: number;     // 総添削数
  totalMistakes: number;     // 総ミス数
  avgMistakes: number;       // 1回あたり平均ミス数（小数1桁）
  currentStreak: number;     // 連続学習日数
  last7DaysCount: number;    // 直近7日のセッション数
}

// ── 設定型・デフォルト値 ──────────────────────────────────────────
export interface AppSettings {
  apiKey: string;
  modelPriority: string[]; // API送信の試行順（先頭が最優先、失敗したら次のモデルへフォールバック）
  theme: 'light' | 'dark';
}

const DEFAULT_MODEL_PRIORITY = [
  'gemini-3.5-flash',
  'gemini-3-flash',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
];

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  modelPriority: DEFAULT_MODEL_PRIORITY,
  theme: 'dark',
};

@Injectable({ providedIn: 'root' })
export class StorageService {
  // ── Signal キャッシュ ─────────────────────────────────────────────
  // _sessions は tombstone（deleted=true）も含む全件の源泉。localStorage / Firestore と一致する。
  private _sessions = signal<CorrectionSession[]>(this.loadFromStorage());
  // 公開ビューは削除済みを除外。表示・集計はすべてこちらを基準にする。
  private activeSessions = computed(() => this._sessions().filter(s => !s.deleted));
  readonly sessions = this.activeSessions;

  private auth = inject(AuthService);

  constructor() {
    // ログイン状態を監視し、ログインした瞬間にクラウドと双方向同期する。
    // ログアウト時（user が null）はローカルキャッシュをそのまま残す。
    effect(() => {
      const user = this.auth.user();
      if (user) {
        this.syncFromCloud(user.uid).catch(err =>
          console.error('[StorageService] クラウド同期に失敗:', err)
        );
      }
    });
  }

  private loadFromStorage(): CorrectionSession[] {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as CorrectionSession[];
    } catch {
      return [];
    }
  }

  private persist(sessions: CorrectionSession[]): void {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    this._sessions.set(sessions);
  }

  // ── セッション管理 ────────────────────────────────────────────────
  saveSession(session: CorrectionSession): void {
    this.persist([session, ...this._sessions()]);
    // ログイン中なら該当 1 件だけクラウドへ反映（fire-and-forget）。
    const uid = this.auth.user()?.uid;
    if (uid) {
      setDoc(this.sessionDoc(uid, session.id), this.toDocData(session)).catch(err =>
        console.error('[StorageService] セッション保存の同期に失敗:', err)
      );
    }
  }

  // 物理削除せず deleted フラグを立てる（tombstone）。これによりクラウド側へ削除を伝播でき、
  // 他端末の syncFromCloud で「削除済み」として反映され、再 push による復活を防ぐ。
  deleteSession(id: string): void {
    const updated = this._sessions().map(s =>
      s.id === id ? { ...s, deleted: true } : s
    );
    this.persist(updated);
    const uid = this.auth.user()?.uid;
    if (uid) {
      const target = updated.find(s => s.id === id);
      if (target) {
        setDoc(this.sessionDoc(uid, id), this.toDocData(target)).catch(err =>
          console.error('[StorageService] セッション削除の同期に失敗:', err)
        );
      }
    }
  }

  // ── Firestore 同期 ────────────────────────────────────────────────
  // apps/study_english/users/{uid}/sessions/{sessionId} のドキュメント参照を返す。
  // 先頭の apps/study_english は、同一 Firebase プロジェクトに別アプリを追加しても衝突しないための名前空間。
  private sessionDoc(uid: string, sessionId: string) {
    return doc(firestore, 'apps', 'study_english', 'users', uid, 'sessions', sessionId);
  }

  // apps/study_english/users/{uid}/sessions コレクション参照を返す
  private sessionsCol(uid: string) {
    return collection(firestore, 'apps', 'study_english', 'users', uid, 'sessions');
  }

  // Firestore は undefined を受け付けないため、値が undefined の任意フィールド（evaluation / reviewItems）を
  // フィールドごと除外する。任意フィールドが増えても OPTIONAL_FIELDS に足すだけで対応できる。
  private toDocData(session: CorrectionSession): Record<string, unknown> {
    const OPTIONAL_FIELDS: (keyof CorrectionSession)[] = ['evaluation', 'reviewItems'];
    const data: Record<string, unknown> = { ...session };
    for (const field of OPTIONAL_FIELDS) {
      if (data[field] === undefined) delete data[field];
    }
    return data;
  }

  // ログイン直後に呼ぶ双方向同期（tombstone 対応）:
  //   1. ローカルとクラウドを id で突き合わせ、同一 id は deleted の OR を採用（片方でも削除なら削除）。
  //   2. クラウドと状態が食い違うローカル分（未登録 or deleted 状態の差）をクラウドへ push。
  // これにより、削除した端末の tombstone が他端末へ伝播し、未削除端末からの再 push による復活を防ぐ。
  async syncFromCloud(uid: string): Promise<void> {
    const snap = await getDocs(this.sessionsCol(uid));
    const cloud = snap.docs.map(d => d.data() as CorrectionSession);

    const local = this._sessions();
    const localById = new Map(local.map(s => [s.id, s]));
    const cloudById = new Map(cloud.map(s => [s.id, s]));

    // 1. union を取り、同一 id は deleted を OR してマージ
    const allIds = new Set([...localById.keys(), ...cloudById.keys()]);
    const merged: CorrectionSession[] = [...allIds].map(id => {
      const l = localById.get(id);
      const c = cloudById.get(id);
      const base = l ?? c!;
      const deleted = Boolean(l?.deleted) || Boolean(c?.deleted);
      return deleted ? { ...base, deleted: true } : { ...base };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    this.persist(merged);

    // 2. クラウドと食い違うローカル分（未登録、または deleted 状態が異なる）を push
    const toPush = merged.filter(s => {
      const c = cloudById.get(s.id);
      return !c || Boolean(c.deleted) !== Boolean(s.deleted);
    });
    await Promise.all(
      toPush.map(s => setDoc(this.sessionDoc(uid, s.id), this.toDocData(s)))
    );
  }

  // ── 設定管理 ──────────────────────────────────────────────────────
  // 旧バージョン（単一モデル文字列 `model` を持つ設定）からの移行にも対応する:
  // `modelPriority` が無く `model` のみ持つ場合、その値を先頭に置きデフォルト順で残りを埋める。
  getSettings(): AppSettings {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      const parsed = JSON.parse(raw) as Partial<AppSettings> & { model?: string };
      const merged: AppSettings = { ...DEFAULT_SETTINGS, ...parsed };
      if (!parsed.modelPriority && parsed.model) {
        merged.modelPriority = [
          parsed.model,
          ...DEFAULT_MODEL_PRIORITY.filter(m => m !== parsed.model),
        ];
      }
      return merged;
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(settings: AppSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  // ── インポート / エクスポート ──────────────────────────────────────
  importSessions(incoming: CorrectionSession[]): void {
    const existing = this._sessions();
    const existingIds = new Set(existing.map(s => s.id));
    const added = incoming.filter(s => !existingIds.has(s.id));
    const merged = [...existing, ...added]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    this.persist(merged);
    // ログイン中なら新規取り込み分をクラウドへも反映
    const uid = this.auth.user()?.uid;
    if (uid) {
      Promise.all(
        added.map(s => setDoc(this.sessionDoc(uid, s.id), this.toDocData(s)))
      ).catch(err => console.error('[StorageService] インポートの同期に失敗:', err));
    }
  }

  exportSessions(): string {
    return JSON.stringify(this.activeSessions(), null, 2);
  }

  // ── ミス統計集計（sessions signal を読むため computed() 内で依存追跡される） ─
  getMistakeStats(): { category: string; count: number }[] {
    const counts: Record<string, number> = {};
    for (const session of this.activeSessions()) {
      for (const m of session.mistakes) {
        counts[m.category] = (counts[m.category] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }

  // ── 学習統計（streak は日付単位で連続日数を算出） ───────────────────
  getStudyStats(): StudyStats {
    const sessions = this.activeSessions();
    const totalSessions = sessions.length;
    const totalMistakes = sessions.reduce((sum, s) => sum + s.mistakes.length, 0);
    const avgMistakes = totalSessions === 0
      ? 0
      : Math.round((totalMistakes / totalSessions) * 10) / 10;

    // セッションが存在する日付（ローカル時刻 YYYY-MM-DD）の集合
    const dayKeys = new Set(sessions.map(s => this.toDayKey(s.date)));

    // 連続学習日数: 今日 or 昨日を起点に、連続して遡れる日数を数える
    let currentStreak = 0;
    const cursor = new Date();
    if (!dayKeys.has(this.toDayKey(cursor.toISOString()))) {
      // 今日まだ未学習なら昨日を起点にする（昨日があれば streak 継続中とみなす）
      cursor.setDate(cursor.getDate() - 1);
    }
    while (dayKeys.has(this.toDayKey(cursor.toISOString()))) {
      currentStreak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    // 直近7日のセッション数
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const last7DaysCount = sessions.filter(
      s => new Date(s.date).getTime() >= sevenDaysAgo.getTime()
    ).length;

    return { totalSessions, totalMistakes, avgMistakes, currentStreak, last7DaysCount };
  }

  // ── 評価推移: evaluation を持つセッションを日付昇順で返す（同一日付は最新を採用） ─
  // スコア推移グラフ・CEFR推移グラフの両方がこの履歴を参照する。
  // CEFR は AI の実判定値をそのまま用いる（スコア由来で上書きすると過大評価に戻るため正規化しない）。
  getEvaluationHistory(): { date: string; evaluation: WritingEvaluation }[] {
    const byDay = new Map<string, { date: string; evaluation: WritingEvaluation }>();
    for (const s of this.activeSessions()) {
      if (!s.evaluation) continue;
      const key = this.toDayKey(s.date);
      const existing = byDay.get(key);
      // 同一日付は date（ISO）が新しい方を採用
      if (!existing || s.date > existing.date) {
        byDay.set(key, { date: s.date, evaluation: s.evaluation });
      }
    }
    return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  // ── 日付をローカル時刻の YYYY-MM-DD キーに正規化 ──────────────────
  private toDayKey(iso: string): string {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  getFrequentMistakes(): (Mistake & { count: number })[] {
    const all = this.activeSessions().flatMap(s => s.mistakes);
    const seen = new Map<string, Mistake & { count: number }>();
    for (const m of all) {
      const key = m.original.toLowerCase().trim();
      const existing = seen.get(key);
      if (existing) {
        existing.count++;
      } else {
        seen.set(key, { ...m, count: 1 });
      }
    }
    return [...seen.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  // ── 復習カード集計: 全セッションの reviewItems を平坦化して返す（Drill の穴埋め復習で出題） ─
  getReviewItems(): ReviewItem[] {
    return this.activeSessions().flatMap(s => s.reviewItems ?? []);
  }
}
