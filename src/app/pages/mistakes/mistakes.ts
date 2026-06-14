import { Component, signal } from '@angular/core';
import { StorageService } from '../../services/storage.service';
import { Mistake } from '../../models/session.model';

@Component({
  selector: 'app-mistakes',
  templateUrl: './mistakes.html',
  styleUrl: './mistakes.scss',
})
export class Mistakes {
  stats = signal<{ category: string; count: number }[]>([]);
  frequent = signal<(Mistake & { count: number })[]>([]);
  maxCount = signal(1);

  constructor(private storage: StorageService) {
    const s = this.storage.getMistakeStats();
    this.stats.set(s);
    this.maxCount.set(s[0]?.count ?? 1);
    this.frequent.set(this.storage.getFrequentMistakes() as (Mistake & { count: number })[]);
  }

  barWidth(count: number): string {
    return `${Math.round((count / this.maxCount()) * 100)}%`;
  }
}
