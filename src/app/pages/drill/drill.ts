/**
 * @file 弱点克服ドリルページ。
 * 3 つの出題モードを持つ:
 *  - 'mistakes' 頻出ミス（getFrequentMistakes）: 誤った表現の訂正を入力で答える。
 *  - 'cloze'    穴埋め復習（getReviewItems）: 添削から生成したクローズカード。既定は入力、
 *               「ヒント（4択）」ボタンで類似4択に切り替えて答えられる。4択モードはキー1〜4で
 *               選択肢をハイライト（selectedChoiceIndex）し、Enterで確定して採点する
 *               （マウスクリックは従来通り即採点）。
 *  - 'levelup'  レベルアップ・タイピング（getSessionsWithLevelUp）: まず日付（＝1回の添削セッション）を選び、
 *               次にその日の文一覧から取り組みたい1文を選んで出題する（セッション横断のシャッフルはしない。
 *               文の並びは Gemini が返した元の順番のまま）。
 *               各文は「maskLevel（0=全文表示 〜 maxLevel=全単語マスク）」の一本道で進行する。
 *               正解するたびに隠れる単語が増え、全単語が隠れた状態で正解すると習熟済みとして記録する。
 *               不正解時は単語単位の diff で「タイポ（見えている単語のミス）」か「理解度不足（隠れている単語の
 *               ミス）」かを判別し、タイポなら maskLevel 据え置き、理解度不足なら1段階引き下げる。
 *               日付ごとの進捗（各文の maskLevel/完了状態）は StorageService.setLevelUpItemProgress で
 *               セッションID単位に永続化し、日付選択画面で再開・完了確認ができる。
 * 回答後に正解・解説を表示し、自動採点＋自己判定で最終スコアを集計する。
 * 出題順は完全ランダムではなく、頻度（ミスの出現回数）と習熟度（正解ストリーク）で重み付けし、
 * 頻出かつ未習熟の問題ほど手前に出やすくする。回答結果は StorageService.recordDrillResult で永続化し、
 * 習熟済み（DRILL_MASTERY_STREAK 以上）の問題は次回以降の出題重みを下げる。
 * 答え合わせ後（revealed→true）は #nextBtn（levelup/mistakes・cloze で共用のテンプレート参照名）へ
 * 自動フォーカスし、Enterキーだけで次の問題に進めるようにしている。
 * levelup の答え合わせ後ボタンは「次へ」（同じ文を更新後の maskLevel のまま再出題、実体は retry()）と
 * 「中断」（backToSentenceList() で文一覧選択画面に戻る）の2つのみで、mistakes/cloze にある
 * 「正解にする」（markCorrect）は levelup では提供しない。
 * ただし全単語マスクの状態（maskLevel === maxLevel）で正答し習熟達成した瞬間だけは、この2ボタンの代わりに
 * 「文一覧に戻る」1ボタンのみを表示する（判定・遷移先はテンプレート側の条件分岐のみで完結し、
 * ロジック側の変更は不要。習熟の記録自体は checkTyping() が既に行う）。
 */
import { Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DRILL_MASTERY_STREAK, normalizeDrillKey, StorageService } from '../../services/storage.service';
import { CorrectionSession, Mistake, ReviewItem } from '../../models/session.model';

// 出題モード。null は未選択（スタート画面）。
type Mode = 'mistakes' | 'cloze' | 'levelup';

// 不正解の分類。'typo' = 見えている単語の入力ミス（レベル据え置き）、'gap' = 隠れている単語を思い出せなかった（レベル低下）。
type MistakeKind = 'typo' | 'gap';

// 内部で扱う統一出題型。表示・採点に必要な値を両モードから正規化して持つ。
interface Quiz {
  key: string;         // 習熟度トラッキング用の一意キー（normalizeDrillKey 済み）
  prompt: string;      // 出題本文（ミス: 誤表現 / クローズ: 穴埋め文）
  answer: string;      // 正解文字列（採点基準）
  hint: string;        // ヒント（日本語）
  badge: string;       // カテゴリ等のバッジ表示
  weight: number;      // 出題優先度（頻度 × 習熟度による重み）
  translation?: string; // クローズのみ: 日本語訳
  choices?: string[];   // クローズのみ: 4択
}

// レベルアップ・タイピング専用の出題型。Quiz とは形が異なる（マスク段階を持つ）ため独立させる。
// 日付選択後、1セッション分の levelUpItems を Gemini が返した元の順番のまま使うため weight は持たない
// （出題順のシャッフルは行わない）。
interface LevelUpQuiz {
  key: string;           // 習熟度トラッキング用の一意キー（normalizeDrillKey(leveledUp)）
  leveledUp: string;     // 正解の全文（採点基準・マスク生成の元）
  original: string;      // 元の（レベルアップ前の）文
  translation: string;   // 日本語訳（ヒント表示用）
  words: string[];       // leveledUp を空白区切りにした単語配列（マスク生成・diff判定の基準）
  hideOrder: number[];   // words のインデックスを「隠す優先順」に並べた配列（決定的に生成、保存不要）
  maxLevel: number;      // マスク段階の最大値（この段階で全単語がマスクされる）
}

@Component({
  selector: 'app-drill',
  imports: [FormsModule, DatePipe],
  templateUrl: './drill.html',
  styleUrl: './drill.scss',
})
export class Drill {
  private storage = inject(StorageService);

  // 答え合わせ後に表示される「次へ」ボタン（levelup/mistakes・cloze どちらか一方のみ描画される）。
  // revealed() が true になった直後に自動フォーカスし、Enterキーだけで次の問題へ進めるようにする。
  private nextBtn = viewChild<ElementRef<HTMLButtonElement>>('nextBtn');

  // ── 出題元（モードごとの件数をスタート画面で表示） ───────────────
  mistakeCount = computed(() => this.storage.getFrequentMistakes().length);
  clozeCount = computed(() => this.storage.getReviewItems().length);
  // レベルアップ・タイピングは日付選択方式のため、件数ではなく「対象セッション一覧」を保持する。
  levelUpDates = computed(() => this.storage.getSessionsWithLevelUp());
  levelUpCount = computed(() => this.levelUpDates().length);

  // ── 進行状態（signal） ────────────────────────────────────────────
  mode = signal<Mode>('mistakes');
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

    if (mode !== 'levelup') {
      const source = mode === 'cloze' ? this.buildClozeQuizzes() : this.buildMistakeQuizzes();
      this.quiz.set(this.shuffleByWeight(source));
    }
    // levelup は日付選択後に selectLevelUpDate() が levelUpQuiz を構築するため、ここでは何も積まない。
    this.started.set(true);
  }

  // ── 日付選択: 選んだセッションの levelUpItems を Gemini が返した元の順番のまま並べ、文一覧選択画面へ進む ─
  // シャッフルは一切行わない（その日の文章の並びのまま、どれからでも選べるようにするため）。
  // ここでは特定の文へ自動ジャンプせず、levelUpSentenceChosen は false のまま文一覧を表示させる。
  selectLevelUpDate(session: CorrectionSession) {
    const progress = this.storage.getLevelUpProgress(session.id);
    const items = (session.levelUpItems ?? []).map(item => {
      const words = item.leveledUp.split(/\s+/).filter(w => w.length > 0);
      return {
        key: normalizeDrillKey(item.leveledUp),
        leveledUp: item.leveledUp,
        original: item.original,
        translation: item.translation,
        words,
        hideOrder: this.buildHideOrder(item.leveledUp, words.length),
        maxLevel: Math.min(6, Math.max(3, words.length)),
      };
    });
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
    const saved = sessionId ? this.storage.getLevelUpProgress(sessionId)[item.key] : undefined;

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

  // 日付選択画面に戻る（出題中に日付を選び直したい場合）
  backToDateSelect() {
    this.levelUpDateChosen.set(false);
    this.levelUpSentenceChosen.set(false);
    this.levelUpQuiz.set([]);
    this.currentSessionId.set(null);
  }

  // 選択中セッションの進捗サマリー（完了数/全体数）。日付選択画面のバッジ表示に使う。
  progressForSession(session: CorrectionSession): { done: number; total: number } {
    const items = session.levelUpItems ?? [];
    const progress = this.storage.getLevelUpProgress(session.id);
    const done = items.filter(item => progress[normalizeDrillKey(item.leveledUp)]?.completed).length;
    return { done, total: items.length };
  }

  // 文一覧の1文分の進捗表示用（未着手/マスク段階/習熟済み）を返す。
  progressForItem(item: LevelUpQuiz): { maskLevel: number; completed: boolean } {
    const sessionId = this.currentSessionId();
    const saved = sessionId ? this.storage.getLevelUpProgress(sessionId)[item.key] : undefined;
    return { maskLevel: saved?.maskLevel ?? 0, completed: saved?.completed ?? false };
  }

  private shuffleByWeight<T extends { weight: number }>(source: T[]): T[] {
    return source
      .map(q => ({ q, score: q.weight * Math.random() }))
      .sort((a, b) => b.score - a.score)
      .map(({ q }) => q);
  }

  // 頻出ミス → Quiz へ正規化。重みは出現回数を基準に、習熟済み（連続正解が一定数以上）なら減衰させる。
  private buildMistakeQuizzes(): Quiz[] {
    return this.storage.getFrequentMistakes().map((m: Mistake & { count: number }) => {
      const key = normalizeDrillKey(m.original);
      return {
        key,
        prompt: m.original,
        answer: m.corrected,
        hint: m.explanation,
        badge: m.category,
        weight: this.weightFor(key, m.count),
      };
    });
  }

  // 復習カード → Quiz へ正規化。基準重みは一律1とし、頻出ミスと同じロジックで習熟度による減衰をかける。
  private buildClozeQuizzes(): Quiz[] {
    return this.storage.getReviewItems().map((r: ReviewItem) => {
      const key = normalizeDrillKey(`${r.sentence}${r.answer}`);
      return {
        key,
        prompt: r.sentence,
        answer: r.answer,
        hint: r.hint,
        badge: '穴埋め',
        weight: this.weightFor(key, 1),
        translation: r.translation,
        choices: r.choices,
      };
    });
  }

  // 習熟済み（連続正解が DRILL_MASTERY_STREAK 以上）なら重みを大きく減衰させ、出題頻度を下げる。
  // （levelup モードは日付選択後に元の順番のまま出題するため使わない。mistakes/cloze 用。）
  private weightFor(key: string, baseWeight: number): number {
    const streak = this.storage.getDrillProgress(key)?.correctStreak ?? 0;
    return streak >= DRILL_MASTERY_STREAK ? baseWeight * 0.2 : baseWeight;
  }

  // ── マスクする単語の優先順を、文字列から決定的に生成する ─────────
  // 同じ文なら常に同じ並びになるため、隠す順序自体は保存せずいつでも再現できる（保存するのは maskLevel のみ）。
  // シンプルな文字列ハッシュを種にした mulberry32 で疑似乱数列を作り、Fisher–Yates でシャッフルする。
  private buildHideOrder(seedText: string, length: number): number[] {
    let h = 0;
    for (let i = 0; i < seedText.length; i++) {
      h = (Math.imul(31, h) + seedText.charCodeAt(i)) | 0;
    }
    let state = h >>> 0 || 1;
    const rand = () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const order = Array.from({ length }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }

  // 現在の maskLevel で隠れている単語インデックスの集合を返す。
  private maskedIndices(item: LevelUpQuiz, level: number): Set<number> {
    const hiddenCount = Math.round((item.words.length * level) / item.maxLevel);
    return new Set(item.hideOrder.slice(0, hiddenCount));
  }

  // ── 表示用: maskLevel に応じて隠れた単語を同じ視覚幅のアンダースコアに置換した文を返す ─
  maskedSentence(item: LevelUpQuiz): string {
    const hidden = this.maskedIndices(item, this.maskLevel());
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

  // 共通採点処理。結果は StorageService に永続化し、次回以降の出題重みに反映する。
  private grade(answer: string) {
    const cur = this.current();
    if (!cur) return;
    const correct = this.normalize(answer) === this.normalize(cur.answer);
    this.currentCorrect.set(correct);
    if (correct) this.score.update(s => s + 1);
    this.revealed.set(true);
    this.storage.recordDrillResult(cur.key, correct);
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

    const correct = this.normalize(this.userAnswer()) === this.normalize(cur.leveledUp);
    this.currentCorrect.set(correct);
    this.revealed.set(true);

    const sessionId = this.currentSessionId();

    if (correct) {
      this.mistakeKind.set(null);
      const level = this.maskLevel();
      if (level >= cur.maxLevel) {
        if (sessionId) this.storage.setLevelUpItemProgress(sessionId, cur.key, level, true);
        this.masteredCount.update(c => c + 1);
      } else {
        const nextLevel = level + 1;
        this.maskLevel.set(nextLevel);
        if (sessionId) this.storage.setLevelUpItemProgress(sessionId, cur.key, nextLevel, false);
      }
      return;
    }

    const kind = this.classifyMistake(cur, this.userAnswer());
    this.mistakeKind.set(kind);
    if (kind === 'gap') {
      const lowered = Math.max(0, this.maskLevel() - 1);
      this.maskLevel.set(lowered);
      if (sessionId) this.storage.setLevelUpItemProgress(sessionId, cur.key, lowered, false);
    } else if (sessionId) {
      this.storage.setLevelUpItemProgress(sessionId, cur.key, this.maskLevel(), false);
    }
  }

  // ユーザー入力を正解の単語配列と突き合わせ、不一致がマスクされていない単語だけなら 'typo'、
  // マスクされている単語にも及ぶ（または単語数が一致せず位置を特定できない）場合は 'gap' と判定する。
  private classifyMistake(item: LevelUpQuiz, userInput: string): MistakeKind {
    const userWords = userInput.split(/\s+/).filter(w => w.length > 0);
    if (userWords.length !== item.words.length) return 'gap';

    const hidden = this.maskedIndices(item, this.maskLevel());
    for (let i = 0; i < item.words.length; i++) {
      if (this.normalize(userWords[i]) !== this.normalize(item.words[i]) && hidden.has(i)) {
        return 'gap';
      }
    }
    return 'typo';
  }

  // ── 自己判定: 自動採点が不一致でも正解として加点（英語は表現揺れが大きいため）。mistakes/cloze 専用 ─
  markCorrect() {
    const cur = this.current();
    if (!cur || !this.revealed() || this.currentCorrect()) return;
    this.currentCorrect.set(true);
    this.score.update(s => s + 1);
    this.storage.recordDrillResult(cur.key, true);
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
    this.hintShown.set(false);
  }

  private normalize(s: string): string {
    return s.toLowerCase().trim().replace(/[.!?,;:'"]+$/g, '').replace(/\s+/g, ' ');
  }
}
