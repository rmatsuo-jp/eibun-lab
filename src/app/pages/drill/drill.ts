/**
 * @file 弱点克服ドリルページ。
 * StorageService の頻出ミス（getFrequentMistakes）を出題元に、誤った表現の訂正をユーザーに考えさせる。
 * 回答後に正解・解説を表示し、自動採点＋自己判定で最終スコアを集計する（永続化はしないエフェメラルモード）。
 */
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { Mistake } from '../../models/session.model';

type Question = Mistake & { count: number };

@Component({
  selector: 'app-drill',
  imports: [FormsModule],
  templateUrl: './drill.html',
  styleUrl: './drill.scss',
})
export class Drill {
  private storage = inject(StorageService);

  // ── 出題元（頻出ミス） ────────────────────────────────────────────
  questions = computed(() => this.storage.getFrequentMistakes() as Question[]);

  // ── 進行状態（signal） ────────────────────────────────────────────
  started = signal(false);
  finished = signal(false);
  quiz = signal<Question[]>([]);     // 出題順を固定したスナップショット
  index = signal(0);
  userAnswer = signal('');
  revealed = signal(false);
  currentCorrect = signal(false);    // 現在の問題が正解扱いか
  score = signal(0);

  current = computed(() => this.quiz()[this.index()] ?? null);
  total = computed(() => this.quiz().length);

  // ── ドリル開始: 出題をシャッフルしてスナップショット ─────────────
  start() {
    const shuffled = [...this.questions()].sort(() => Math.random() - 0.5);
    this.quiz.set(shuffled);
    this.index.set(0);
    this.score.set(0);
    this.userAnswer.set('');
    this.revealed.set(false);
    this.currentCorrect.set(false);
    this.finished.set(false);
    this.started.set(true);
  }

  // ── 回答チェック: 正規化した文字列一致で自動採点 ─────────────────
  check() {
    if (this.revealed()) return;
    if (!this.userAnswer().trim()) return;   // 空回答（Enter押下含む）では答え合わせしない
    const cur = this.current();
    if (!cur) return;
    const correct = this.normalize(this.userAnswer()) === this.normalize(cur.corrected);
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
  }

  restart() {
    this.start();
  }

  private normalize(s: string): string {
    return s.toLowerCase().trim().replace(/[.!?,;:'"]+$/g, '').replace(/\s+/g, ' ');
  }
}
