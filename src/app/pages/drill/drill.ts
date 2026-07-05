/**
 * @file 弱点克服ドリルページ。
 * 3 つの出題モードを持つ:
 *  - 'mistakes' 頻出ミス（getFrequentMistakes）: 誤った表現の訂正を入力で答える。
 *  - 'cloze'    穴埋め復習（getReviewItems）: 添削から生成したクローズカード。既定は入力、
 *               「ヒント（4択）」ボタンで類似4択に切り替えて答えられる。
 *  - 'levelup'  レベルアップ・タイピング（getSessionsWithLevelUp）: まず日付（＝1回の添削セッション）を選び、
 *               その日のセッションが持つ CEFR一段階上の例文を、Geminiが返した元の順番のまま1文目から出題する
 *               （セッション横断のシャッフルはしない。その日の文章を通しでたどり、文脈込みで身につけるため）。
 *               各文は Stage1（見て打つ）→Stage2（穴埋めで打つ）→Stage3（何も見ずに打つ）の3段階でタイピング練習する。
 *               3段階はレベル差が大きいためユーザーが自由に行き来・反復できる（強制的な一方向進行にはしない）。
 *               1アイテムにつき3段階すべてが「直近の試行で正解」になった時点で習熟済みとして記録する。
 * 回答後に正解・解説を表示し、自動採点＋自己判定で最終スコアを集計する。
 * 出題順は完全ランダムではなく、頻度（ミスの出現回数）と習熟度（正解ストリーク）で重み付けし、
 * 頻出かつ未習熟の問題ほど手前に出やすくする。回答結果は StorageService.recordDrillResult で永続化し、
 * 習熟済み（DRILL_MASTERY_STREAK 以上）の問題は次回以降の出題重みを下げる。
 */
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DRILL_MASTERY_STREAK, normalizeDrillKey, StorageService } from '../../services/storage.service';
import { CorrectionSession, Mistake, ReviewItem } from '../../models/session.model';

// 出題モード。null は未選択（スタート画面）。
type Mode = 'mistakes' | 'cloze' | 'levelup';

// レベルアップ・タイピングの進行段階（1:見て打つ 2:穴埋めで打つ 3:何も見ずに打つ）。
type Stage = 1 | 2 | 3;
// テンプレートの @for でタブを描画するための固定配列（Stage型を維持するため number[] にせずここで定義）。
const STAGES: Stage[] = [1, 2, 3];

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

// レベルアップ・タイピング専用の出題型。Quiz とは形が異なる（3段階それぞれ表示内容が違う）ため独立させる。
// 日付選択後、1セッション分の levelUpItems を Gemini が返した元の順番のまま使うため weight は持たない
// （出題順のシャッフルは行わない）。
interface LevelUpQuiz {
  key: string;           // 習熟度トラッキング用の一意キー（normalizeDrillKey(leveledUp)）
  leveledUp: string;     // 正解の全文（Stage1/2の表示・全Stage共通の採点基準）
  original: string;      // 元の（レベルアップ前の）文
  translation: string;   // 日本語訳（Stage3のヒント表示）
  keyPhrases: string[];  // 穴埋め対象の完全一致部分文字列（Stage2で使用）
}

@Component({
  selector: 'app-drill',
  imports: [FormsModule, DatePipe],
  templateUrl: './drill.html',
  styleUrl: './drill.scss',
})
export class Drill {
  private storage = inject(StorageService);

  // テンプレートから参照する Stage タブの並び。
  readonly stages = STAGES;

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
  choiceMode = signal(false);         // 現在の問題を4択 UI で出しているか（クローズのみ）
  score = signal(0);

  // レベルアップ・タイピングの進行状態。
  stage = signal<Stage>(1);
  // 各Stageの「直近の試行が正解だったか」を独立保持（履歴の積み上げではなく上書き）。
  // これにより Stage を自由に行き来・反復しても、各 Stage の最新結果だけが評価対象になる。
  stagePassed = signal<Record<Stage, boolean>>({ 1: false, 2: false, 3: false });
  // レベルアップ・タイピングは1アイテムに複数回チェックが走り得るため、通常の score（回答回数カウント）
  // ではなく「3Stageすべて習熟した問題数」を結果サマリーの分子として使う。
  masteredCount = signal(0);
  // levelup モードは開始直後にまず日付（＝1セッション）を選ばせ、選択後に levelUpQuiz を構築する。
  // false の間は日付選択画面を表示し、Stage出題画面には進ませない。
  levelUpDateChosen = signal(false);

  current = computed(() => this.quiz()[this.index()] ?? null);
  currentLevelUp = computed(() => this.levelUpQuiz()[this.index()] ?? null);
  total = computed(() => this.mode() === 'levelup' ? this.levelUpQuiz().length : this.quiz().length);

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
    this.choiceMode.set(false);
    this.finished.set(false);
    this.stage.set(1);
    this.stagePassed.set({ 1: false, 2: false, 3: false });
    this.masteredCount.set(0);
    this.masteredThisItem = false;
    this.levelUpDateChosen.set(false);
    this.levelUpQuiz.set([]);

    if (mode !== 'levelup') {
      const source = mode === 'cloze' ? this.buildClozeQuizzes() : this.buildMistakeQuizzes();
      this.quiz.set(this.shuffleByWeight(source));
    }
    // levelup は日付選択後に selectLevelUpDate() が levelUpQuiz を構築するため、ここでは何も積まない。
    this.started.set(true);
  }

  // ── 日付選択: 選んだセッションの levelUpItems を Gemini が返した元の順番のまま出題する ─
  // シャッフルは一切行わない（その日の文章を1文目から順にたどることで文脈を保つため）。
  selectLevelUpDate(session: CorrectionSession) {
    this.levelUpQuiz.set(
      (session.levelUpItems ?? []).map(item => ({
        key: normalizeDrillKey(item.leveledUp),
        leveledUp: item.leveledUp,
        original: item.original,
        translation: item.translation,
        keyPhrases: item.keyPhrases,
      }))
    );
    this.levelUpDateChosen.set(true);
    this.index.set(0);
    this.stage.set(1);
    this.stagePassed.set({ 1: false, 2: false, 3: false });
    this.masteredThisItem = false;
    this.masteredCount.set(0);
    this.userAnswer.set('');
    this.revealed.set(false);
    this.currentCorrect.set(false);
  }

  // 日付選択画面に戻る（出題中に日付を選び直したい場合）
  backToDateSelect() {
    this.levelUpDateChosen.set(false);
    this.levelUpQuiz.set([]);
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

  // ── Stage2表示用: keyPhrases の各出現箇所を同じ視覚幅のアンダースコアに置換する ─
  // Gemini 生成の keyPhrase が leveledUp 内に実在しない場合は無視して落ちないようにする（防御的）。
  blankedSentence(item: LevelUpQuiz): string {
    let result = item.leveledUp;
    for (const phrase of item.keyPhrases) {
      const idx = result.indexOf(phrase);
      if (idx === -1) continue;
      const blank = '_'.repeat(Math.max(phrase.length, 3));
      result = result.slice(0, idx) + blank + result.slice(idx + phrase.length);
    }
    return result;
  }

  // ── Stageの自由な切り替え: 1→2→3 の強制進行はせず、いつでも好きな Stage に移動できる ─
  selectStage(s: Stage) {
    this.stage.set(s);
    this.userAnswer.set('');
    this.revealed.set(false);
    this.currentCorrect.set(false);
  }

  // ── 4択へ切替（クローズのみ）。ヒントを見せつつ選択式で答えやすくする ─
  switchToChoices() {
    if (this.revealed()) return;
    this.choiceMode.set(true);
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

  // ── レベルアップ・タイピングの回答チェック: 現在の Stage を全文タイピングで採点する ─
  // Stage1/2/3 すべて同じ「全文を正規化して比較」の採点ロジックを共有する（Stage2 も部分点なし、全文一致で判定）。
  checkTyping() {
    if (this.revealed()) return;
    if (!this.userAnswer().trim()) return;
    const cur = this.currentLevelUp();
    if (!cur) return;
    const correct = this.normalize(this.userAnswer()) === this.normalize(cur.leveledUp);
    this.currentCorrect.set(correct);
    this.revealed.set(true);
    this.stagePassed.update(p => ({ ...p, [this.stage()]: correct }));
    this.recordMasteryIfComplete(cur.key);
  }

  // 3 Stage すべてが「直近の試行で正解」になった瞬間にだけ習熟度を記録する（自由な行き来・反復に対応するため、
  // Stage ごとの履歴ではなく現在の3値のスナップショットで判定する）。
  // recordDrillResult は呼ぶたびにストリークを+1するため、揃うたびに呼ぶとストリークが際限なく伸びてしまう。
  // それを避けるため「3つ揃った状態に初めてなった時だけ」記録するローカルフラグ masteredThisItem を使う。
  // masteredCount はこのモードの結果サマリー（score() ではなく習熟数）に使う。
  private masteredThisItem = false;
  private recordMasteryIfComplete(key: string) {
    const p = this.stagePassed();
    const allPassed = p[1] && p[2] && p[3];
    if (allPassed && !this.masteredThisItem) {
      this.masteredThisItem = true;
      this.storage.recordDrillResult(key, true);
      this.masteredCount.update(c => c + 1);
    } else if (!allPassed) {
      this.masteredThisItem = false;
    }
  }

  // ── 自己判定: 自動採点が不一致でも正解として加点（英語は表現揺れが大きいため） ─
  markCorrect() {
    if (this.mode() === 'levelup') {
      const cur = this.currentLevelUp();
      if (!cur || !this.revealed() || this.currentCorrect()) return;
      this.currentCorrect.set(true);
      this.stagePassed.update(p => ({ ...p, [this.stage()]: true }));
      this.recordMasteryIfComplete(cur.key);
      return;
    }
    const cur = this.current();
    if (!cur || !this.revealed() || this.currentCorrect()) return;
    this.currentCorrect.set(true);
    this.score.update(s => s + 1);
    this.storage.recordDrillResult(cur.key, true);
  }

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
    this.choiceMode.set(false);
    this.stage.set(1);
    this.stagePassed.set({ 1: false, 2: false, 3: false });
    this.masteredThisItem = false;
  }

  // スタート画面（モード選択）に戻る
  restart() {
    this.started.set(false);
    this.finished.set(false);
    this.stage.set(1);
    this.stagePassed.set({ 1: false, 2: false, 3: false });
    this.masteredThisItem = false;
    this.levelUpDateChosen.set(false);
    this.levelUpQuiz.set([]);
  }

  private normalize(s: string): string {
    return s.toLowerCase().trim().replace(/[.!?,;:'"]+$/g, '').replace(/\s+/g, ' ');
  }
}
