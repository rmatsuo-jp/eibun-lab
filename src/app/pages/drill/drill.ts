/**
 * @file 弱点克服ドリルページ。
 * 2 つの出題モードを持つ:
 *  - 'mistakes' 頻出ミス（getFrequentMistakes）: 誤った表現の訂正を入力で答える。
 *  - 'cloze'    穴埋め復習（getReviewItems）: 添削から生成したクローズカード。既定は入力、
 *               「ヒント（4択）」ボタンで類似4択に切り替えて答えられる。
 * 回答後に正解・解説を表示し、自動採点＋自己判定で最終スコアを集計する（永続化しないエフェメラルモード）。
 */
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { Mistake, ReviewItem } from '../../models/session.model';

// 出題モード。null は未選択（スタート画面）。
type Mode = 'mistakes' | 'cloze';

// 内部で扱う統一出題型。表示・採点に必要な値を両モードから正規化して持つ。
interface Quiz {
  prompt: string;      // 出題本文（ミス: 誤表現 / クローズ: 穴埋め文）
  answer: string;      // 正解文字列（採点基準）
  hint: string;        // ヒント（日本語）
  badge: string;       // カテゴリ等のバッジ表示
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

  // ── ドリル開始: モードのデータをシャッフルしてスナップショット ───
  start(mode: Mode) {
    const source = mode === 'cloze' ? this.buildClozeQuizzes() : this.buildMistakeQuizzes();
    const shuffled = [...source].sort(() => Math.random() - 0.5);
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

  // 頻出ミス → Quiz へ正規化
  private buildMistakeQuizzes(): Quiz[] {
    return this.storage.getFrequentMistakes().map((m: Mistake) => ({
      prompt: m.original,
      answer: m.corrected,
      hint: m.explanation,
      badge: m.category,
    }));
  }

  // 復習カード → Quiz へ正規化
  private buildClozeQuizzes(): Quiz[] {
    return this.storage.getReviewItems().map((r: ReviewItem) => ({
      prompt: r.sentence,
      answer: r.answer,
      hint: r.hint,
      badge: '穴埋め',
      translation: r.translation,
      choices: r.choices,
    }));
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

  // 共通採点処理
  private grade(answer: string) {
    const cur = this.current();
    if (!cur) return;
    const correct = this.normalize(answer) === this.normalize(cur.answer);
    this.currentCorrect.set(correct);
    if (correct) this.score.update(s => s + 1);
    this.revealed.set(true);
  }

  // ── 自己判定: 自動採点が不一致でも正解として加点（英語は表現揺れが大きいため） ─
  markCorrect() {
    if (!this.revealed() || this.currentCorrect()) return;
    this.currentCorrect.set(true);
    this.score.update(s => s + 1);
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
