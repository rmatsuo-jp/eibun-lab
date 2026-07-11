/**
 * @file 弱点克服ドリルページ。
 * 2 つの出題モードを持つ:
 *  - 'cloze'    穴埋め復習（getSessionsWithReviewItems）: まず日付（＝1回の添削セッション）を選び、
 *               その日の reviewItems だけで出題する（selectClozeDate）。既定は入力、
 *               「ヒント（4択）」ボタンで類似4択に切り替えて答えられる。4択モードはキー1〜4で
 *               選択肢をハイライト（selectedChoiceIndex）し、Enterで確定して採点する
 *               （マウスクリックは従来通り即採点）。日付選択画面では各日付ごとに習熟済み数/全体数の
 *               進捗バッジ（progressForClozeSession、判定基準は DRILL_MASTERY_STREAK）を表示する。
 *  - 'levelup'  レベルアップ・タイピング（getSessionsWithLevelUp）: まず日付（＝1回の添削セッション）を選び、
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
 * 答え合わせ後（revealed→true）は #nextBtn（levelup/mistakes・cloze で共用のテンプレート参照名）へ
 * 自動フォーカスし、Enterキーだけで次の問題に進めるようにしている。
 * levelup の答え合わせ後ボタンは「次へ」（同じ文を更新後の maskLevel のまま再出題、実体は retry()）と
 * 「中断」（backToSentenceList() で文一覧選択画面に戻る）の2つのみで、mistakes/cloze にある
 * 「正解にする」（markCorrect）は levelup では提供しない。
 * ただし全単語マスクの状態（maskLevel === maxLevel）で正答し習熟達成した瞬間だけは、この2ボタンの代わりに
 * 「文一覧に戻る」1ボタンのみを表示する（判定・遷移先はテンプレート側の条件分岐のみで完結し、
 * ロジック側の変更は不要。習熟の記録自体は checkTyping() が既に行う）。
 * signal状態に依存しない純粋ロジック（重み付きシャッフル・回答正規化・マスク順生成・マスク対象計算・
 * Quiz/LevelUpQuiz構築・不正解分類）は core/quiz/quiz.util.ts に切り出しており、単体テスト可能
 * （添削待機中クイズと共用するため core に置く）。
 * Quiz/LevelUpQuiz/MistakeKind の型定義も同ファイルへ移し、このファイルは状態管理と
 * 3モードのオーケストレーションに専念する。
 * Quiz/LevelUpQuiz の hint/badge/translation は buildXxxQuiz に i18n.lang() を渡して生成した
 * 時点の言語で固定される（スナップショット方式。出題順の固定と同じ設計）。
 */
import { Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SessionRepositoryService } from '@core/sessions/session-repository.service';
import { getSessionsWithLevelUp, getSessionsWithReviewItems, normalizeDrillKey } from '@core/stats/session-stats.util';
import { DRILL_MASTERY_STREAK } from './drill-progress.service';
import { DrillProgressSyncService } from './drill-progress-sync.service';
import { CorrectionSession, ReviewItem } from '@core/models/session.model';
import { I18nService } from '@core/i18n/i18n.service';
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
type Mode = 'cloze' | 'levelup';

@Component({
  selector: 'app-drill',
  imports: [FormsModule, DatePipe],
  templateUrl: './drill.html',
  styleUrl: './drill.scss',
})
export class Drill {
  private repository = inject(SessionRepositoryService);
  private drillProgress = inject(DrillProgressSyncService);
  protected i18n = inject(I18nService);

  // 答え合わせ後に表示される「次へ」ボタン（levelup/mistakes・cloze どちらか一方のみ描画される）。
  // revealed() が true になった直後に自動フォーカスし、Enterキーだけで次の問題へ進めるようにする。
  private nextBtn = viewChild<ElementRef<HTMLButtonElement>>('nextBtn');

  // ── 出題元（モードごとの件数をスタート画面で表示） ───────────────
  // 穴埋め復習・レベルアップ・タイピングともに日付選択方式のため、件数ではなく「対象セッション一覧」を保持する。
  clozeDates = computed(() => getSessionsWithReviewItems(this.repository.sessions()));
  clozeCount = computed(() => this.clozeDates().length);
  levelUpDates = computed(() => getSessionsWithLevelUp(this.repository.sessions()));
  levelUpCount = computed(() => this.levelUpDates().length);

  // ── 進行状態（signal） ────────────────────────────────────────────
  mode = signal<Mode>('cloze');
  started = signal(false);
  finished = signal(false);
  quiz = signal<Quiz[]>([]);          // 出題順を固定したスナップショット（mistakes/cloze用）
  levelUpQuiz = signal<LevelUpQuiz[]>([]); // 出題順を固定したスナップショット（levelup用）
  index = signal(0);
  userAnswer = signal('');
  revealed = signal(false);
  currentCorrect = signal(false);     // 現在の問題が正解扱いか
  choiceMode = signal(false);         // 4択 UI で出題中か（cloze は常に true、mistakes は常に false）
  selectedChoiceIndex = signal<number | null>(null); // 4択でキー(1〜4)選択中の選択肢インデックス（Enterで確定するまで採点しない）
  score = signal(0);
  hintShown = signal(false);          // 日本語訳をヒントボタンで表示中か（デフォルト非表示）

  // レベルアップ・タイピングの進行状態。
  maskLevel = signal(0);              // 現在のアイテムのマスク段階（0=全文表示）
  mistakeKind = signal<MistakeKind | null>(null); // 直近の不正解の分類（結果メッセージ用）
  // レベルアップ・タイピングは「maxLevelで正解」した問題数を結果サマリーの分子として使う。
  masteredCount = signal(0);
  // levelup モードは 日付選択 → 文一覧選択 → 出題 の3段階。
  // levelUpDateChosen=false: 日付選択画面。true & levelUpSentenceChosen=false: 文一覧選択画面。両方true: 出題画面。
  levelUpDateChosen = signal(false);
  levelUpSentenceChosen = signal(false);
  currentSessionId = signal<string | null>(null); // 選択中セッションID（進捗保存キー）

  // 穴埋め復習も「日付（＝1回の添削セッション）を選ぶ→その日のカードで出題」の2段階。
  clozeDateChosen = signal(false);

  current = computed(() => this.quiz()[this.index()] ?? null);
  currentLevelUp = computed(() => this.levelUpQuiz()[this.index()] ?? null);
  total = computed(() => this.mode() === 'levelup' ? this.levelUpQuiz().length : this.quiz().length);

  constructor() {
    // 答え合わせ直後（revealed→true）にレンダリングが確定してから「次へ」ボタンへフォーカスを移す。
    // setTimeout(0) で描画完了後まで待たないと、切り替わった @if ブロック内の要素がまだ存在しない。
    effect(() => {
      if (this.revealed()) {
        setTimeout(() => this.nextBtn()?.nativeElement.focus());
      }
    });
  }

  // ── ドリル開始: モードのデータを重み付きシャッフルしてスナップショット ───
  // weight * Math.random() の降順ソートで、頻出・未習熟の問題ほど手前に出やすくしつつ、
  // 完全な固定順にはならないよう毎回ランダム性を持たせる（軽量な重み付きシャッフル）。
  start(mode: Mode) {
    this.mode.set(mode);
    this.index.set(0);
    this.score.set(0);
    this.userAnswer.set('');
    this.revealed.set(false);
    this.currentCorrect.set(false);
    this.choiceMode.set(mode === 'cloze');
    this.selectedChoiceIndex.set(null);
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

    // cloze/levelup ともに日付選択後に selectClozeDate()/selectLevelUpDate() が quiz を構築するため、
    // ここでは何も積まない。
    this.started.set(true);
  }

  // ── 日付選択（穴埋め復習）: 選んだセッションの reviewItems だけを重み付きシャッフルして出題する ─
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
    this.selectedChoiceIndex.set(null);
    this.hintShown.set(false);
    this.clozeDateChosen.set(true);
  }

  // 選択中セッションの進捗サマリー（習熟済み数/全体数）。穴埋め復習の日付選択画面のバッジ表示に使う。
  progressForClozeSession(session: CorrectionSession): { done: number; total: number } {
    const items = session.reviewItems ?? [];
    const done = items.filter(r => {
      const key = normalizeDrillKey(`${r.sentence}${r.answer}`);
      return (this.drillProgress.getDrillProgress(key)?.correctStreak ?? 0) >= DRILL_MASTERY_STREAK;
    }).length;
    return { done, total: items.length };
  }

  // 日付選択画面に戻る（cloze/levelup 共通。出題中に日付を選び直したい場合）
  backToDateSelect() {
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
    const items = (session.levelUpItems ?? []).map(item =>
      buildLevelUpQuiz(item, normalizeDrillKey(item.leveledUp), this.i18n.lang())
    );
    this.levelUpQuiz.set(items);
    this.currentSessionId.set(session.id);
    this.masteredCount.set(Object.values(progress).filter(p => p.completed).length);

    this.levelUpDateChosen.set(true);
    this.levelUpSentenceChosen.set(false);
  }

  // ── 文選択: 文一覧から選ばれた1文の出題画面へ進む。保存済み進捗があれば maskLevel を復元する ─
  selectLevelUpSentence(index: number) {
    const item = this.levelUpQuiz()[index];
    if (!item) return;
    const sessionId = this.currentSessionId();
    const saved = sessionId ? this.drillProgress.getLevelUpProgress(sessionId)[item.key] : undefined;

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
    const done = items.filter(item => progress[normalizeDrillKey(item.leveledUp)]?.completed).length;
    return { done, total: items.length };
  }

  // 文一覧の1文分の進捗表示用（未着手/マスク段階/習熟済み）を返す。
  progressForItem(item: LevelUpQuiz): { maskLevel: number; completed: boolean } {
    const sessionId = this.currentSessionId();
    const saved = sessionId ? this.drillProgress.getLevelUpProgress(sessionId)[item.key] : undefined;
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
    this.hintShown.update(v => !v);
  }

  // ── 入力での回答チェック: 正規化した文字列一致で自動採点 ─────────
  check() {
    if (this.revealed()) return;
    if (!this.userAnswer().trim()) return;   // 空回答（Enter押下含む）では答え合わせしない
    this.grade(this.userAnswer());
  }

  // ── 4択での回答: 選んだ選択肢で即採点 ─────────────────────────────
  choose(choice: string) {
    if (this.revealed()) return;
    this.userAnswer.set(choice);
    this.grade(choice);
  }

  // ── 4択のキーボード操作: 数字キー(1〜4)で選択肢をハイライトし、Enterで確定して採点する ─
  // マウスクリック（choose()の直接呼び出し）とは異なり、数字キー単独では採点しない
  // （選択とEnterでの確定を分離することで、押し間違いをEnter前に選び直せるようにしている）。
  onChoiceKeydown(event: KeyboardEvent) {
    if (!this.choiceMode() || this.revealed()) return;
    const choices = this.current()?.choices;
    if (!choices) return;

    if (event.key >= '1' && event.key <= '4') {
      const idx = Number(event.key) - 1;
      if (idx < choices.length) {
        this.selectedChoiceIndex.set(idx);
        event.preventDefault();
      }
      return;
    }

    if (event.key === 'Enter') {
      const idx = this.selectedChoiceIndex();
      if (idx === null) return;
      event.preventDefault();
      this.choose(choices[idx]);
    }
  }

  // 共通採点処理。結果は DrillProgressService に永続化し、次回以降の出題重みに反映する。
  private grade(answer: string) {
    const cur = this.current();
    if (!cur) return;
    const correct = normalizeAnswer(answer) === normalizeAnswer(cur.answer);
    this.currentCorrect.set(correct);
    if (correct) this.score.update(s => s + 1);
    this.revealed.set(true);
    this.drillProgress.recordDrillResult(cur.key, correct);
  }

  // ── レベルアップ・タイピングの回答チェック ─────────────────────
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

    if (correct) {
      this.mistakeKind.set(null);
      const level = this.maskLevel();
      if (level >= cur.maxLevel) {
        if (sessionId) this.drillProgress.setLevelUpItemProgress(sessionId, cur.key, level, true);
        this.masteredCount.update(c => c + 1);
      } else {
        const nextLevel = level + 1;
        this.maskLevel.set(nextLevel);
        if (sessionId) this.drillProgress.setLevelUpItemProgress(sessionId, cur.key, nextLevel, false);
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

  // ── 自己判定: 自動採点が不一致でも正解として加点（英語は表現揺れが大きいため）。mistakes/cloze 専用 ─
  markCorrect() {
    const cur = this.current();
    if (!cur || !this.revealed() || this.currentCorrect()) return;
    this.currentCorrect.set(true);
    this.score.update(s => s + 1);
    this.drillProgress.recordDrillResult(cur.key, true);
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
    this.selectedChoiceIndex.set(null);
  }

  // mistakes/cloze 専用: 次の問題（配列の次要素）に進む。
  next() {
    const nextIndex = this.index() + 1;
    if (nextIndex >= this.total()) {
      this.finished.set(true);
      return;
    }
    this.index.set(nextIndex);
    this.userAnswer.set('');
    this.revealed.set(false);
    this.currentCorrect.set(false);
    this.choiceMode.set(this.mode() === 'cloze');
    this.hintShown.set(false);
    this.mistakeKind.set(null);
    this.selectedChoiceIndex.set(null);
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
  }
}
