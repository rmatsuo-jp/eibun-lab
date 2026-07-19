/**
 * @file 弱点克服ドリルの状態を保持するシングルトンサービス（オーケストレーター）。
 * 2 つの出題モードを持つ:
 *  - 'cloze'    穴埋めクイズ（getSessionsWithReviewItems）: まず日付（＝1回の添削セッション）を選び、
 *               その日の reviewItems だけで出題する（selectClozeDate）。既定は入力、
 *               「ヒント（4択）」ボタンで類似4択に切り替えて答えられる。4択モードはクリック/タップで
 *               即採点する。日付選択画面では各日付ごとに達成数/全体数の
 *               進捗バッジ（progressForClozeSession、判定基準は1回でも正解したか＝everCorrect）を表示する。
 *               出題の重み付け（既に習熟した問題を出にくくする）は別基準で、
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
 *
 * ── ファイル分割方針 ──
 * cloze/levelup それぞれのモード固有データ・純粋ロジック（対象セッション一覧・達成度・進捗集計・
 * Quiz/LevelUpQuiz構築・マスク文字列生成）は DrillClozeState（drill-cloze-state.ts）/
 * DrillLevelUpState（drill-levelup-state.ts）に切り出した。一方、出題中の共有UI状態
 * （quiz/levelUpQuiz/index/userAnswer/revealed/currentCorrect/choiceMode/hintShown/maskLevel/
 * mistakeKind/score/masteredCount/currentSessionId 等）と、check()/checkTyping()/next()/retry()/
 * start()/restart() のような両モードにまたがる状態遷移メソッドは、このファイル（オーケストレーター）に
 * 残している。これらは cloze の grade() と levelup の checkTyping() が同じ signal 群（revealed・
 * currentCorrect・userAnswer 等）を読み書きする一つの状態機械であり、モードごとに機械的に分割すると
 * 逆に見通しが悪くなるための判断（cloze/levelup 双方の「日付・文の一覧を取得してQuizを構築する」
 * データ層はモードごとに独立して編集できるようにしつつ、「出題→回答→採点→次へ」という共有の
 * 状態遷移だけはここに一元化する設計）。
 * signal状態に依存しない純粋ロジック（重み付きシャッフル・回答正規化・マスク順生成・マスク対象計算・
 * Quiz/LevelUpQuiz構築・不正解分類）は core/quiz/quiz.util.ts に切り出しており、単体テスト可能
 * （添削待機中クイズと共用するため core に置く）。
 * Quiz/LevelUpQuiz/MistakeKind の型定義も同ファイルへ移し、このサービスは状態管理と
 * 2モードのオーケストレーションに専念する（DOM操作・フォーカス制御は drill.ts 側に残す）。
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
 * パーフェクト達成数（perfectCountForSession/perfectCountForClozeSession）: 「クリア済み」バッジとは別に、
 * 満点（全問正解）で完了するたびに加算する累積カウンタを DrillProgressService.incrementPerfectCount で
 * 記録し、日付選択画面に表示する（クリア後も繰り返し練習する動機付け）。cloze は next() が最終問題を
 * 抜けるたびに毎回加算される。levelup は完了済みの文が既に多い日程を再訪しても checkLevelUpSessionComplete
 * を毎回呼ぶ必要があるため、代わりに「1回の訪問（selectLevelUpDate〜次にselectLevelUpDateするまで）で
 * 最大1回、訪問中に一度でも不正解があれば加算しない」という訪問単位のガード
 * （levelUpVisitHadMistake/levelUpPerfectRecordedForVisit、selectLevelUpDate()でリセット）で
 * 重複加算を防ぐ。
 */
import { Injectable, computed, inject, signal } from '@angular/core';
import { SessionRepositoryService } from '@core/sessions/session-repository.service';
import { normalizeDrillKey } from '@core/stats/session-stats.util';
import { DrillProgressSyncService } from './drill-progress-sync.service';
import { CorrectionSession } from '@core/models/session.model';
import { SAMPLE_LEVELUP_ITEMS, SAMPLE_REVIEW_ITEMS } from '@core/quiz/sample-data';
import { I18nService } from '@core/i18n/i18n.service';
import { AchievementId } from '@core/achievements/achievement.model';
import { evaluateNewlyUnlocked } from '@core/achievements/achievement-engine.util';
import { GamificationSyncService } from '@core/achievements/gamification-sync.service';
import {
  FEATURE_ID_CLOZE,
  FEATURE_ID_LEVELUP,
} from '@core/achievements/gamification-feature-id';
import { TranslationKey } from '@core/i18n/translations';
import {
  buildLevelUpQuiz,
  classifyMistake,
  LevelUpQuiz,
  MistakeKind,
  normalizeAnswer,
  Quiz,
  shuffleByWeight,
} from '@core/quiz/quiz.util';
import { DrillClozeState } from './drill-cloze-state';
import { DrillLevelUpState } from './drill-levelup-state';

// 出題モード。null は未選択（スタート画面）。
export type DrillMode = 'cloze' | 'levelup';

@Injectable({ providedIn: 'root' })
export class DrillState {
  private repository = inject(SessionRepositoryService);
  private drillProgress = inject(DrillProgressSyncService);
  private i18n = inject(I18nService);
  private gamification = inject(GamificationSyncService);
  private clozeState = inject(DrillClozeState);
  private levelUpState = inject(DrillLevelUpState);

  // 1プレイ内の連続正解数（自己ベスト判定用）。start() でリセットする。
  private sessionCorrectStreak = signal(0);
  // 直近の採点/セッション完了で新規解除された実績ID一覧。UI（drill.html）のトースト表示に使う。
  newlyUnlocked = signal<AchievementId[]>([]);
  // 結果サマリー表示用の累積統計（drill.html が現在の連続記録・継続日数を表示するのに使う）。
  gamificationStats = this.gamification.stats;

  // ── 出題元（モードごとの件数をスタート画面で表示） ───────────────
  // データ本体（対象セッション一覧・達成度）は DrillClozeState/DrillLevelUpState が保持する。
  clozeDates = this.clozeState.clozeDates;
  clozeCount = this.clozeState.clozeCount;
  clozeAchievement = this.clozeState.clozeAchievement;
  levelUpDates = this.levelUpState.levelUpDates;
  levelUpCount = this.levelUpState.levelUpCount;
  levelUpAchievement = this.levelUpState.levelUpAchievement;

  // これまで添削したことがない新規ユーザー（セッション0件）かどうか。
  // 新規ユーザーには復習カード・レベルアップ例文が存在しないため、静的サンプル問題で体験させる。
  isNewUser = computed(() => this.repository.sessions().length === 0);

  // ── 進行状態（signal） ────────────────────────────────────────────
  mode = signal<DrillMode>('cloze');
  started = signal(false);
  finished = signal(false);
  quiz = signal<Quiz[]>([]); // 出題順を固定したスナップショット（cloze用）
  levelUpQuiz = signal<LevelUpQuiz[]>([]); // 出題順を固定したスナップショット（levelup用）
  index = signal(0);
  userAnswer = signal('');
  revealed = signal(false);
  currentCorrect = signal(false); // 現在の問題が正解扱いか
  choiceMode = signal(false); // 4択 UI で出題中か（cloze は常に true、levelup は常に false）
  score = signal(0);
  hintShown = signal(false); // 日本語訳をヒントボタンで表示中か（デフォルト非表示）

  // 穴あきタイピングの進行状態。
  maskLevel = signal(0); // 現在のアイテムのマスク段階（0=全文表示）
  mistakeKind = signal<MistakeKind | null>(null); // 直近の不正解の分類（結果メッセージ用）
  // 穴あきタイピングは「maxLevelで正解」した問題数を結果サマリーの分子として使う。
  masteredCount = signal(0);
  // パーフェクト達成数の「訪問」単位ガード。selectLevelUpDate() で日程を開くたびにリセットする
  // （既に習熟済みの文が多い日程を再訪しても、この訪問中に一度も間違えなければ1回だけ加算するため）。
  private levelUpVisitHadMistake = signal(false);
  private levelUpPerfectRecordedForVisit = signal(false);
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
        this.quiz.set(shuffleByWeight(this.clozeState.buildQuizzes(SAMPLE_REVIEW_ITEMS)));
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
    this.quiz.set(shuffleByWeight(this.clozeState.buildQuizzes(session.reviewItems ?? [])));
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
  progressForClozeSession(session: CorrectionSession): { done: number; total: number } {
    return this.clozeState.progressForClozeSession(session);
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
    this.levelUpQuiz.set(this.levelUpState.buildQuizItems(session));
    this.currentSessionId.set(session.id);
    this.masteredCount.set(this.levelUpState.masteredCountFor(session.id));
    this.levelUpVisitHadMistake.set(false);
    this.levelUpPerfectRecordedForVisit.set(false);

    this.levelUpDateChosen.set(true);
    this.levelUpSentenceChosen.set(false);
  }

  // ── 文選択: 文一覧から選ばれた1文の出題画面へ進む。保存済み進捗があれば maskLevel を復元する ─
  selectLevelUpSentence(index: number) {
    const item = this.levelUpQuiz()[index];
    if (!item) return;

    this.index.set(index);
    this.maskLevel.set(this.levelUpState.savedMaskLevel(this.currentSessionId(), item));
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
    return this.levelUpState.progressForSession(session);
  }

  // 文一覧の1文分の進捗表示用（未着手/マスク段階/習熟済み）を返す。
  progressForItem = (item: LevelUpQuiz): { maskLevel: number; completed: boolean } =>
    this.levelUpState.progressForItem(item, this.currentSessionId());

  // ── 表示用: maskLevel に応じて隠れた単語を同じ視覚幅のアンダースコアに置換した文を返す ─
  maskedSentence(item: LevelUpQuiz): string {
    return this.levelUpState.maskedSentence(item, this.maskLevel());
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
      masteryProgress: {
        [FEATURE_ID_CLOZE]: this.clozeAchievement(),
        [FEATURE_ID_LEVELUP]: this.levelUpAchievement(),
      },
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
        // masteredCount（結果表示の自己ベスト）は既に習熟済みの文の再正解では加算しないが、
        // セッション完了判定（checkLevelUpSessionComplete）は再挑戦のたびに必ず行う。
        // パーフェクト達成数はそちら側で「訪問」単位に重複防止するため、ここではガードしない。
        const alreadyMastered = sessionId
          ? (this.drillProgress.getLevelUpProgress(sessionId)[cur.key]?.completed ?? false)
          : false;
        if (sessionId) this.drillProgress.setLevelUpItemProgress(sessionId, cur.key, level, true);
        if (!alreadyMastered) this.masteredCount.update((c) => c + 1);
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
    this.levelUpVisitHadMistake.set(true);
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
  // パーフェクト達成数（perfectCounts）は、既に習熟済みの文が多い日程を再訪した場合でも
  // 正解のたびに毎回この判定を行う必要があるため、alreadyMastered に関係なく呼ばれる。
  // その代わり「1回の訪問で最大1回」「訪問中に一度でも不正解があれば加算しない」という
  // 訪問単位のガード（levelUpVisitHadMistake/levelUpPerfectRecordedForVisit）でここだけ重複防止する。
  private checkLevelUpSessionComplete(sessionId: string): void {
    const session = this.repository.sessions().find((s) => s.id === sessionId);
    if (!session) return;
    if (!this.levelUpState.isSessionComplete(session)) return;
    this.recordSessionCompleteForGamification(`levelup-${sessionId}`, true);
    if (!this.levelUpVisitHadMistake() && !this.levelUpPerfectRecordedForVisit()) {
      this.drillProgress.incrementPerfectCount(`levelup-${sessionId}`);
      this.levelUpPerfectRecordedForVisit.set(true);
    }
  }

  // 選択中セッションのパーフェクト達成数（穴あきタイピング）。日付選択画面のバッジ表示に使う。
  perfectCountForSession(session: CorrectionSession): number {
    return this.levelUpState.perfectCountForSession(session);
  }

  // 選択中セッションのパーフェクト達成数（穴埋めクイズ）。日付選択画面のバッジ表示に使う。
  perfectCountForClozeSession(session: CorrectionSession): number {
    return this.clozeState.perfectCountForClozeSession(session);
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

  // cloze 専用: 次の問題（配列の次要素）に進む。
  next() {
    const nextIndex = this.index() + 1;
    if (nextIndex >= this.total()) {
      this.finished.set(true);
      if (!this.sampleMode() && this.currentSessionId()) {
        const perfect = this.score() === this.total();
        this.recordSessionCompleteForGamification(`cloze-${this.currentSessionId()}`, perfect);
        if (perfect) this.drillProgress.incrementPerfectCount(`cloze-${this.currentSessionId()}`);
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
