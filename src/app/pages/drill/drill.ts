/**
 * @file 弱点克服ドリルページ。
 * 2 つの出題モードを持つ:
 *  - 'mistakes' 頻出ミス（getFrequentMistakes）: 誤った表現の訂正を入力で答える。
 *  - 'cloze'    穴埋め復習（getReviewItems）: 添削から生成したクローズカード。既定は入力、
 *               「ヒント（4択）」ボタンで類似4択に切り替えて答えられる。
 * 回答後に正解・解説を表示し、自動採点＋自己判定で最終スコアを集計する。
 * 出題順は完全ランダムではなく、頻度（ミスの出現回数）と習熟度（正解ストリーク）で重み付けし、
 * 頻出かつ未習熟の問題ほど手前に出やすくする。回答結果は StorageService.recordDrillResult で永続化し、
 * 習熟済み（DRILL_MASTERY_STREAK 以上）の問題は次回以降の出題重みを下げる。
 */
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DRILL_MASTERY_STREAK, normalizeDrillKey, StorageService } from '../../services/storage.service';
import { Mistake, ReviewItem } from '../../models/session.model';

// 出題モード。null は未選択（スタート画面）。
type Mode = 'mistakes' | 'cloze';

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

@Component({
  selector: 'app-drill',
  imports: [FormsModule],
  templateUrl: './drill.html',
  styleUrl: './drill.scss',
})
export class Drill {
  private storage = inject(StorageService);

  // ── 出題元（モードごとの件数をスタート画面で表示） ───────────────
  mistakeCount = computed(() => this.storage.getFrequentMistakes().length);
  clozeCount = computed(() => this.storage.getReviewItems().length);

  // ── 進行状態（signal） ────────────────────────────────────────────
  mode = signal<Mode>('mistakes');
  started = signal(false);
  finished = signal(false);
  quiz = signal<Quiz[]>([]);          // 出題順を固定したスナップショット
  index = signal(0);
  userAnswer = signal('');
  revealed = signal(false);
  currentCorrect = signal(false);     // 現在の問題が正解扱いか
  choiceMode = signal(false);         // 現在の問題を4択 UI で出しているか（クローズのみ）
  score = signal(0);

  current = computed(() => this.quiz()[this.index()] ?? null);
  total = computed(() => this.quiz().length);

  // ── ドリル開始: モードのデータを重み付きシャッフルしてスナップショット ───
  // weight * Math.random() の降順ソートで、頻出・未習熟の問題ほど手前に出やすくしつつ、
  // 完全な固定順にはならないよう毎回ランダム性を持たせる（軽量な重み付きシャッフル）。
  start(mode: Mode) {
    const source = mode === 'cloze' ? this.buildClozeQuizzes() : this.buildMistakeQuizzes();
    const shuffled = source
      .map(q => ({ q, score: q.weight * Math.random() }))
      .sort((a, b) => b.score - a.score)
      .map(({ q }) => q);
    this.mode.set(mode);
    this.quiz.set(shuffled);
    this.index.set(0);
    this.score.set(0);
    this.userAnswer.set('');
    this.revealed.set(false);
    this.currentCorrect.set(false);
    this.choiceMode.set(false);
    this.finished.set(false);
    this.started.set(true);
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
  private weightFor(key: string, baseWeight: number): number {
    const streak = this.storage.getDrillProgress(key)?.correctStreak ?? 0;
    return streak >= DRILL_MASTERY_STREAK ? baseWeight * 0.2 : baseWeight;
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

  // ── 自己判定: 自動採点が不一致でも正解として加点（英語は表現揺れが大きいため） ─
  markCorrect() {
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
  }

  // スタート画面（モード選択）に戻る
  restart() {
    this.started.set(false);
    this.finished.set(false);
  }

  private normalize(s: string): string {
    return s.toLowerCase().trim().replace(/[.!?,;:'"]+$/g, '').replace(/\s+/g, ' ');
  }
}
