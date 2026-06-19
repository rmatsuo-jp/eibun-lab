/**
 * @file ミス傾向分析ページ。
 * StorageService の sessions signal から computed() でリアクティブにミス統計を集計し、
 * 頻度バーと頻出ミスリストを表示する。
 */
import { Component, computed, inject } from '@angular/core';
import { StorageService } from '../../services/storage.service';
import { Mistake } from '../../models/session.model';

@Component({
  selector: 'app-mistakes',
  templateUrl: './mistakes.html',
  styleUrl: './mistakes.scss',
})
export class Mistakes {
  private storage = inject(StorageService);

  // ── 派生状態（computed） ──────────────────────────────────────────
  stats = computed(() => this.storage.getMistakeStats());
  maxCount = computed(() => this.stats()[0]?.count ?? 1);
  frequent = computed(() => this.storage.getFrequentMistakes() as (Mistake & { count: number })[]);

  barWidth(count: number): string {
    return `${Math.round((count / this.maxCount()) * 100)}%`;
  }
}
