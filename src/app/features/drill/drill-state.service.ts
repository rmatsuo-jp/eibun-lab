/**
 * @file 弱点克服ドリルの状態を保持するシングルトンサービス。
 * 2 つの出題モードを持つ:
 *  - 'cloze'    穴埋めクイズ（getSessionsWithReviewItems）: まず日付（＝1回の添削セッション）を選び、
 *               その日の reviewItems だけで出題する（selectClozeDate）。既定は入力、
 *               「ヒント（4択）」ボタンで類似4択に切り替えて答えられる。4択モードはクリック/タップで
 *               即採点する。日付選択画面では各日付ごとに達成数/全体数の
 *               進捗バッジ（progressForClozeSession、判定基準は1回でも正解したか＝everCorrect）を表示する。
 *               出題の重み付け（weightFor、既に習熟した問題を出にくくする）は別基準で、
 *               引き続き DRILL_MASTERY_STREAK（3回連続正解）を使う。
 *  - 'levelup'  穴あきタイピング（getSessionsWithLevelUp）: まず日付（＝1回の添削セッション）を選び、
 *               次にその日の文一覧から取り組みたい1文を選んで出題する（セッション横断のシャッフルはしない。
 *               文の並びは Gemini が返した元の順番のまま）。
 *               各文は「maskLevel（0=全文表示 〜 maxLevel=全単語マスク）」の一本道で進行する。
 *               正解するたびに隠れる単語が増え、全単語が隠れた状態で正解すると習熟済みとして記録する。
 *               不正解時は単語単位の diff で「タイポ（見えている単語のミス）」か「理解度不足（隠れている単語の
 *               ミス）」かを判別し、タイポなら maskLevel 据え置き、理解度不足なら1段階引き下げる。
 *               日付ごとの進捗（各文の maskLevel/完了状態）は DrillProgressSyncService.setLevelUpItemProgress で
 *               セッションID単位に永続化（ログイン中は Firestore にも同期）し、日付選択画面で再開・完了確認ができる。
 * 回答後に正解・解説を表示し、自動採点＋自己判定で最終スコアを集計する。
 * 出題順は完全ランダムではなく、頻度（ミスの出現回数）と習熟度（正解ストリーク）で重み付けし、
 * 頻出かつ未習熟の問題ほど手前に出やすくする。回答結果は DrillProgressSyncService.recordDrillResult で永続化し、
 * 習熟済み（DRILL_MASTERY_STREAK 以上）の問題は次回以降の出題重みを下げる。
 * levelup の答え合わせ後ボタンは「次へ」（同じ文を更新後の maskLevel のまま再出題、実体は retry()）と
 * 「中断」（backToSentenceList() で文一覧選択画面に戻る）の2つのみ。
 * ただし全単語マスクの状態（maskLevel === maxLevel）で正答し習熟達成した瞬間だけは、この2ボタンの代わりに
 * 「文一覧に戻る」1ボタンのみを表示する（判定・遷移先はテンプレート側の条件分岐のみで完結し、
 * ロジック側の変更は不要。習熟の記録自体は checkTyping() が既に行う）。
 * signal状態に依存しない純粋ロジック（重み付きシャッフル・回答正規化・マスク順生成・マスク対象計算・
 * Quiz/LevelUpQuiz構築・不正解分類）は core/quiz/quiz.util.ts に切り出しており、単体テスト可能
 * （添削待機中クイズと共用するため core に置く）。
 * Quiz/LevelUpQuiz/MistakeKind の型定義も同ファイルへ移し、このサービスは状態管理と
 * 3モードのオーケストレーションに専念する（DOM操作・フォーカス制御は drill.ts 側に残す）。
 * Quiz/LevelUpQuiz の hint/badge/translation は buildXxxQuiz に i18n.lang() を渡して生成した
 * 時点の言語で固定される（スナップショット方式。出題順の固定と同じ設計）。
 * これまで添削したことがない新規ユーザー（isNewUser、セッション0件）は日付選択をスキップし、
 * core/quiz/sample-data.ts の静的サンプル問題（cloze5問/levelup3文）を直接出題する（sampleMode=true）。
 * サンプル出題中は DrillProgressSyncService への進捗永続化（recordDrillResult/setLevelUpItemProgress）を
 * 行わない（levelupはcurrentSessionId=nullで自動的にスキップされ、clozeはsampleMode()で明示的にガードする）。
 * サンプル出題中は実セッションが存在せず日付選択画面が空になるため、backToDateSelect() は
 * sampleMode() を見てモード選択画面（restart()）へ戻す特別扱いをする。
 * ゲーミフィケーション（統計・実績）: サンプル出題を除く採点のたびに GamificationSyncService.
 * recordAnswer() で累積統計を更新し、cloze は結果サマリー到達時、levelup は日程内全文完了時に
 * recordSessionComplete() でセッション完了（パーフェクト判定含む）を記録する。両者とも記録直後に
 * core/achievements/achievement-engine.util.ts の evaluateNewlyUnlocked() で新規解除を判定し、
 * newlyUnlocked signal に積んで drill.html のトースト表示に渡す（dismissNewlyUnlocked()で消去）。
 */
import { Injectable, computed, inject, signal } from '@angular/core';
import { SessionRepositoryService } from '@core/sessions/session-repository.service';
import {
  getSessionsWithLevelUp,
  getSessionsWithReviewItems,
  normalizeDrillKey,
} from '@core/stats/session-stats.util';
import { DRILL_MASTERY_STREAK } from './drill-progress.service';
import { DrillProgressSyncService } from './drill-progress-sync.service';
import { CorrectionSession, ReviewItem } from '@core/models/session.model';
import { SAMPLE_LEVELUP_ITEMS, SAMPLE_REVIEW_ITEMS } from '@core/quiz/sample-data';
import { I18nService } from '@core/i18n/i18n.service';
import { AchievementId } from '@core/achievements/achievement.model';
import { evaluateNewlyUnlocked } from '@core/achievements/achievement-engine.util';
import { GamificationSyncService } from '@core/achievements/gamification-sync.service';
import { TranslationKey } from '@core/i18n/translations';
import {
  buildClozeQuiz,
  buildLevelUpQuiz,
  classifyMistake,
  LevelUpQuiz,
  maskedIndices,
  MistakeKind,
  normalizeAnswer,
  Quiz,
  shuffleByWeight,
} from '@core/quiz/quiz.util';

// 出題モード。null は未選択（スタート画面）。
export type DrillMode = 'cloze' | 'levelup';

@Injectable({ providedIn: 'root' })
export class DrillState {
  private repository = inject(SessionRepositoryService);
  private drillProgress = inject(DrillProgressSyncService);
  private i18n = inject(I18nService);
  private gamification = inject(GamificationSyncService);

  // 1プレイ内の連続正解数（自己ベスト判定用）。start() でリセットする。
  private sessionCorrectStreak = signal(0);
  // 直近の採点/セッション完了で新規解除された実績ID一覧。UI（drill.html）のトースト表示に使う。
  newlyUnlocked = signal<AchievementId[]>([]);
  // 結果サマリー表示用の累積統計（drill.html が現在の連続記録・継続日数を表示するのに使う）。
  gamificationStats = this.gamification.stats;

  // ── 出題元（モードごとの件数をスタート画面で表示） ───────────────
  // 穴埋めクイズ・穴あきタイピングともに日付選択方式のため、件数ではなく「対象セッション一覧」を保持する。
  clozeDates = computed(() => getSessionsWithReviewItems(this.repository.sessions()));
  clozeCount = computed(() => this.clozeDates().length);
  levelUpDates = computed(() => getSessionsWithLevelUp(this.repository.sessions()));
  levelUpCount = computed(() => this.levelUpDates().length);

  // これまで添削したことがない新規ユーザー（セッション0件）かどうか。
  // 新規ユーザーには復習カード・レベルアップ例文が存在しないため、静的サンプル問題で体験させる。
  isNewUser = computed(() => this.repository.sessions().length === 0);

  // スタート画面のモード選択カードに表示する達成度（完了数/全体数の合算）。
  levelUpAchievement = computed(() => {
    const totals = this.levelUpDates().map((s) => this.progressForSession(s));
    return {
      done: totals.reduce((a, t) => a + t.done, 0),
      total: totals.reduce((a, t) => a + t.total, 0),
    };
  });
  clozeAchievement = computed(() => {
    const totals = this.clozeDates().map((s) => this.progressForClozeSession(s));
    return {
      done: totals.reduce((a, t) => a + t.done, 0),
      total: totals.reduce((a, t) => a + t.total, 0),
    };
  });

  // ── 進行状態（signal） ────────────────────────────────────────────
  mode = signal<DrillMode>('cloze');
  started = signal(false);
  finished = signal(false);
  quiz = signal<Quiz[]>([]); // 出題順を固定したスナップショット（mistakes/cloze用）
  levelUpQuiz = signal<LevelUpQuiz[]>([]); // 出題順を固定したスナップショット（levelup用）
  index = signal(0);
  userAnswer = signal('');
  revealed = signal(false);
  currentCorrect = signal(false); // 現在の問題が正解扱いか
  choiceMode = signal(false); // 4択 UI で出題中か（cloze は常に true、mistakes は常に false）
  score = signal(0);
  hintShown = signal(false); // 日本語訳をヒントボタンで表示中か（デフォルト非表示）

  // 穴あきタイピングの進行状態。
  maskLevel = signal(0); // 現在のアイテムのマスク段階（0=全文表示）
  mistakeKind = signal<MistakeKind | null>(null); // 直近の不正解の分類（結果メッセージ用）
  // 穴あきタイピングは「maxLevelで正解」した問題数を結果サマリーの分子として使う。
  masteredCount = signal(0);
  // levelup モードは 日付選択 → 文一覧選択 → 出題 の3段階。
  // levelUpDateChosen=false: 日付選択画面。true & levelUpSentenceChosen=false: 文一覧選択画面。両方true: 出題画面。
  levelUpDateChosen = signal(false);
  levelUpSentenceChosen = signal(false);
  currentSessionId = signal<string | null>(null); // 選択中セッションID（進捗保存キー）

  // 穴埋めクイズも「日付（＝1回の添削セッション）を選ぶ→その日のカードで出題」の2段階。
  clozeDateChosen = signal(false);

  // 新規ユーザー向け静的サンプル問題で出題中かどうか。true の間は DrillProgressSyncService への
  // 進捗永続化を行わない（実データを汚さないため）。
  sampleMode = signal(false);

  current = computed(() => this.quiz()[this.index()] ?? null);
  currentLevelUp = computed(() => this.levelUpQuiz()[this.index()] ?? null);
  total = computed(() =>
    this.mode() === 'levelup' ? this.levelUpQuiz().length : this.quiz().length,
  );

  // ── ドリル開始: モードのデータを重み付きシャッフルしてスナップショット ───
  // weight * Math.random() の降順ソートで、頻出・未習熟の問題ほど手前に出やすくしつつ、
  // 完全な固定順にはならないよう毎回ランダム性を持たせる（軽量な重み付きシャッフル）。
  start(mode: DrillMode) {
    this.mode.set(mode);
    this.index.set(0);
    this.score.set(0);
    this.userAnswer.set('');
    this.revealed.set(false);
    this.currentCorrect.set(false);
    this.choiceMode.set(mode === 'cloze');
    this.finished.set(false);
    this.hintShown.set(false);
    this.maskLevel.set(0);
    this.mistakeKind.set(null);
    this.masteredCount.set(0);
    this.levelUpDateChosen.set(false);
    this.levelUpSentenceChosen.set(false);
    this.levelUpQuiz.set([]);
    this.currentSessionId.set(null);
    this.clozeDateChosen.set(false);
    this.sessionCorrectStreak.set(0);
    this.newlyUnlocked.set([]);

    // 新規ユーザー（セッション0件）は日付選択をスキップし、静的サンプル問題を直接出題する。
    this.sampleMode.set(this.isNewUser());
    if (this.isNewUser()) {
      if (mode === 'cloze') {
        this.quiz.set(shuffleByWeight(this.buildClozeQuizzes(SAMPLE_REVIEW_ITEMS)));
        this.clozeDateChosen.set(true);
      } else {
        this.levelUpQuiz.set(
          SAMPLE_LEVELUP_ITEMS.map((item) =>
            buildLevelUpQuiz(item, normalizeDrillKey(item.leveledUp), this.i18n.lang()),
          ),
        );
        this.levelUpDateChosen.set(true);
      }
    }

    // 通常ユーザーは日付選択後に selectClozeDate()/selectLevelUpDate() が quiz を構築するため、
    // ここでは何も積まない。
    this.started.set(true);
  }

  // ── 日付選択（穴埋めクイズ）: 選んだセッションの reviewItems だけを重み付きシャッフルして出題する ─
  selectClozeDate(session: CorrectionSession) {
    this.quiz.set(shuffleByWeight(this.buildClozeQuizzes(session.reviewItems ?? [])));
    this.currentSessionId.set(session.id);
    this.index.set(0);
    this.score.set(0);
    this.finished.set(false);
    this.userAnswer.set('');
    this.revealed.set(false);
    this.currentCorrect.set(false);
    this.choiceMode.set(true);
    this.hintShown.set(false);
    this.clozeDateChosen.set(true);
  }

  // 選択中セッションの進捗サマリー（達成数/全体数）。穴埋めクイズの日付選択画面のバッジ表示に使う。
  // 達成は「1回でも正解したか（everCorrect）」で判定する（後で間違えても達成は取り消さない）。
  progressForClozeSession(session: CorrectionSession): { done: number; total: number } {
    const items = session.reviewItems ?? [];
    const done = items.filter((r) => {
      const key = normalizeDrillKey(`${r.sentence}${r.answer}`);
      return this.drillProgress.getDrillProgress(key)?.everCorrect ?? false;
    }).length;
    return { done, total: items.length };
  }

  // 日付選択画面に戻る（cloze/levelup 共通。出題中に日付を選び直したい場合）。
  // サンプル出題中（sampleMode）は実セッションが1件もなく日付選択画面が空のデッドエンドになるため、
  // restart() でモード選択画面まで戻す。
  backToDateSelect() {
    if (this.sampleMode()) {
      this.restart();
      return;
    }
    this.levelUpDateChosen.set(false);
    this.levelUpSentenceChosen.set(false);
    this.levelUpQuiz.set([]);
    this.clozeDateChosen.set(false);
    this.currentSessionId.set(null);
  }

  // ── 日付選択: 選んだセッションの levelUpItems を Gemini が返した元の順番のまま並べ、文一覧選択画面へ進む ─
  // シャッフルは一切行わない（その日の文章の並びのまま、どれからでも選べるようにするため）。
  // ここでは特定の文へ自動ジャンプせず、levelUpSentenceChosen は false のまま文一覧を表示させる。
  selectLevelUpDate(session: CorrectionSession) {
    const progress = this.drillProgress.getLevelUpProgress(session.id);
    const items = (session.levelUpItems ?? []).map((item) =>
      buildLevelUpQuiz(item, normalizeDrillKey(item.leveledUp), this.i18n.lang()),
    );
    this.levelUpQuiz.set(items);
    this.currentSessionId.set(session.id);
    this.masteredCount.set(Object.values(progress).filter((p) => p.completed).length);

    this.levelUpDateChosen.set(true);
    this.levelUpSentenceChosen.set(false);
  }

  // ── 文選択: 文一覧から選ばれた1文の出題画面へ進む。保存済み進捗があれば maskLevel を復元する ─
  selectLevelUpSentence(index: number) {
    const item = this.levelUpQuiz()[index];
    if (!item) return;
    const sessionId = this.currentSessionId();
    const saved = sessionId
      ? this.drillProgress.getLevelUpProgress(sessionId)[item.key]
      : undefined;

    this.index.set(index);
    this.maskLevel.set(saved?.maskLevel ?? 0);
    this.userAnswer.set('');
    this.revealed.set(false);
    this.currentCorrect.set(false);
    this.hintShown.set(false);
    this.mistakeKind.set(null);
    this.levelUpSentenceChosen.set(true);
  }

  // 文一覧選択画面に戻る（levelUpQuiz・currentSessionId は保持したまま）
  backToSentenceList() {
    this.levelUpSentenceChosen.set(false);
  }

  // 選択中セッションの進捗サマリー（完了数/全体数）。日付選択画面のバッジ表示に使う。
  progressForSession(session: CorrectionSession): { done: number; total: number } {
    const items = session.levelUpItems ?? [];
    const progress = this.drillProgress.getLevelUpProgress(session.id);
    const done = items.filter(
      (item) => progress[normalizeDrillKey(item.leveledUp)]?.completed,
    ).length;
    return { done, total: items.length };
  }

  // 文一覧の1文分の進捗表示用（未着手/マスク段階/習熟済み）を返す。
  progressForItem(item: LevelUpQuiz): { maskLevel: number; completed: boolean } {
    const sessionId = this.currentSessionId();
    const saved = sessionId
      ? this.drillProgress.getLevelUpProgress(sessionId)[item.key]
      : undefined;
    return { maskLevel: saved?.maskLevel ?? 0, completed: saved?.completed ?? false };
  }

  // 復習カード → Quiz へ正規化。基準重みは一律1とし、習熟度による減衰をかける。
  private buildClozeQuizzes(reviewItems: ReviewItem[]): Quiz[] {
    return reviewItems.map((r: ReviewItem) => {
      const key = normalizeDrillKey(`${r.sentence}${r.answer}`);
      return buildClozeQuiz(r, key, this.weightFor(key, 1), this.i18n.lang());
    });
  }

  // 習熟済み（連続正解が DRILL_MASTERY_STREAK 以上）なら重みを大きく減衰させ、出題頻度を下げる。
  // （levelup モードは日付選択後に元の順番のまま出題するため使わない。mistakes/cloze 用。）
  private weightFor(key: string, baseWeight: number): number {
    const streak = this.drillProgress.getDrillProgress(key)?.correctStreak ?? 0;
    return streak >= DRILL_MASTERY_STREAK ? baseWeight * 0.2 : baseWeight;
  }

  // 現在の maskLevel で隠れている単語インデックスの集合を返す。
  private maskedIndicesFor(item: LevelUpQuiz, level: number): Set<number> {
    return maskedIndices(item.hideOrder, item.words.length, item.maxLevel, level);
  }

  // ── 表示用: maskLevel に応じて隠れた単語を同じ視覚幅のアンダースコアに置換した文を返す ─
  maskedSentence(item: LevelUpQuiz): string {
    const hidden = this.maskedIndicesFor(item, this.maskLevel());
    return item.words
      .map((w, i) => (hidden.has(i) ? '_'.repeat(Math.max(w.length, 3)) : w))
      .join(' ');
  }

  // ヒント（日本語訳）の表示切り替え。答え合わせ後は自動表示されるため、その前にだけ使う。
  toggleHint() {
    this.hintShown.update((v) => !v);
  }

  // ── 入力での回答チェック: 正規化した文字列一致で自動採点 ─────────
  check() {
    if (this.revealed()) return;
    if (!this.userAnswer().trim()) return; // 空回答（Enter押下含む）では答え合わせしない
    this.grade(this.userAnswer());
  }

  // ── 4択での回答: 選んだ選択肢で即採点 ─────────────────────────────
  choose(choice: string) {
    if (this.revealed()) return;
    this.userAnswer.set(choice);
    this.grade(choice);
  }

  // 共通採点処理。結果は DrillProgressService に永続化し、次回以降の出題重みに反映する。
  private grade(answer: string) {
    const cur = this.current();
    if (!cur) return;
    const correct = normalizeAnswer(answer) === normalizeAnswer(cur.answer);
    this.currentCorrect.set(correct);
    if (correct) this.score.update((s) => s + 1);
    this.revealed.set(true);
    if (!this.sampleMode()) {
      this.drillProgress.recordDrillResult(cur.key, correct);
      this.recordAnswerForGamification(correct);
    }
  }

  // 採点結果を統計に反映し、新規解除された実績があれば newlyUnlocked に積む。
  // サンプルモード中は呼ばない（sampleMode() のガードは呼び出し元で行う）。
  private recordAnswerForGamification(correct: boolean): void {
    this.sessionCorrectStreak.update((n) => (correct ? n + 1 : 0));
    this.gamification.recordAnswer(this.mode(), correct, this.sessionCorrectStreak());
    this.evaluateAchievements();
  }

  // セッション（1回の出題セット/日程）完了を統計に反映し、新規解除された実績があれば積む。
  private recordSessionCompleteForGamification(sessionKey: string, perfect: boolean): void {
    this.gamification.recordSessionComplete(this.mode(), sessionKey, perfect);
    this.evaluateAchievements();
  }

  private evaluateAchievements(): void {
    const ids = evaluateNewlyUnlocked(this.gamification.stats(), {
      clozeAchievement: this.clozeAchievement(),
      levelUpAchievement: this.levelUpAchievement(),
    });
    if (ids.length === 0) return;
    this.gamification.markUnlocked(ids);
    this.newlyUnlocked.update((prev) => [...prev, ...ids]);
  }

  // 実績解除トーストを閉じる。
  dismissNewlyUnlocked(): void {
    this.newlyUnlocked.set([]);
  }

  // 実績IDから i18n タイトルキー（achievements.<id>.title）を組み立てる。
  // AchievementId は core/achievements 側で string リテラルユニオンとして定義されており
  // i18n の TranslationKey を知らないため、ここでキャストする
  // （core/i18n/localized-session.util.ts と同じ方針）。
  achievementTitleKey(id: AchievementId): TranslationKey {
    return `achievements.${id}.title` as TranslationKey;
  }

  // ── 穴あきタイピングの回答チェック ─────────────────────
  // 正解: maxLevel未満なら maskLevel を+1、maxLevelなら習熟として記録。
  // 不正解: 単語単位の diff で「タイポ（見えている単語のミス）」か「理解度不足（隠れている単語のミス）」かを
  // 判別し、タイポなら maskLevel 据え置き、理解度不足なら1段階引き下げる。
  checkTyping() {
    if (this.revealed()) return;
    if (!this.userAnswer().trim()) return;
    const cur = this.currentLevelUp();
    if (!cur) return;

    const correct = normalizeAnswer(this.userAnswer()) === normalizeAnswer(cur.leveledUp);
    this.currentCorrect.set(correct);
    this.revealed.set(true);

    const sessionId = this.currentSessionId();

    if (!this.sampleMode()) this.recordAnswerForGamification(correct);

    if (correct) {
      this.mistakeKind.set(null);
      const level = this.maskLevel();
      if (level >= cur.maxLevel) {
        if (sessionId) this.drillProgress.setLevelUpItemProgress(sessionId, cur.key, level, true);
        this.masteredCount.update((c) => c + 1);
        if (sessionId && !this.sampleMode()) this.checkLevelUpSessionComplete(sessionId);
      } else {
        const nextLevel = level + 1;
        this.maskLevel.set(nextLevel);
        if (sessionId)
          this.drillProgress.setLevelUpItemProgress(sessionId, cur.key, nextLevel, false);
      }
      return;
    }

    const kind = classifyMistake(cur, this.userAnswer(), this.maskLevel());
    this.mistakeKind.set(kind);
    if (kind === 'gap') {
      const lowered = Math.max(0, this.maskLevel() - 1);
      this.maskLevel.set(lowered);
      if (sessionId) this.drillProgress.setLevelUpItemProgress(sessionId, cur.key, lowered, false);
    } else if (sessionId) {
      this.drillProgress.setLevelUpItemProgress(sessionId, cur.key, this.maskLevel(), false);
    }
  }

  // 該当日程の全文が完了（maxLevelで正解済み）したかを判定し、完了していれば
  // levelup版の「セッション完了」として統計に記録する（levelupに「不完全パーフェクト」はなく、
  // 全文完了＝パーフェクト扱い）。重複カウントは GamificationStatsService.completedSessionKeys で防止する。
  private checkLevelUpSessionComplete(sessionId: string): void {
    const session = this.repository.sessions().find((s) => s.id === sessionId);
    if (!session) return;
    const { done, total } = this.progressForSession(session);
    if (total > 0 && done === total) {
      this.recordSessionCompleteForGamification(`levelup-${sessionId}`, true);
    }
  }

  // 同じ問題にもう一度挑戦する（mistakesの「もう一度」／levelupの「次へ」の実体。
  // index・maskLevelには触れないため、levelupでは直前の答え合わせで更新済みのmaskLevelのまま
  // 同じ文が再出題される）。
  retry() {
    this.userAnswer.set('');
    this.revealed.set(false);
    this.currentCorrect.set(false);
    this.mistakeKind.set(null);
    this.hintShown.set(false);
  }

  // mistakes/cloze 専用: 次の問題（配列の次要素）に進む。
  next() {
    const nextIndex = this.index() + 1;
    if (nextIndex >= this.total()) {
      this.finished.set(true);
      if (!this.sampleMode() && this.currentSessionId()) {
        this.recordSessionCompleteForGamification(
          `cloze-${this.currentSessionId()}`,
          this.score() === this.total(),
        );
      }
      return;
    }
    this.index.set(nextIndex);
    this.userAnswer.set('');
    this.revealed.set(false);
    this.currentCorrect.set(false);
    this.choiceMode.set(this.mode() === 'cloze');
    this.hintShown.set(false);
    this.mistakeKind.set(null);
  }

  // スタート画面（モード選択）に戻る
  restart() {
    this.started.set(false);
    this.finished.set(false);
    this.maskLevel.set(0);
    this.mistakeKind.set(null);
    this.levelUpDateChosen.set(false);
    this.levelUpSentenceChosen.set(false);
    this.levelUpQuiz.set([]);
    this.currentSessionId.set(null);
    this.clozeDateChosen.set(false);
    this.hintShown.set(false);
    this.sampleMode.set(false);
  }
}
