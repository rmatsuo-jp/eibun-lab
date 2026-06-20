/**
 * @file ミス傾向分析ページ。
 * StorageService の sessions signal から computed() でリアクティブに学習統計・ミス統計・CEFR推移を集計し、
 * 統計ダッシュボード（streak等）・CEFR推移グラフ・頻度バー・頻出ミスリストを表示する。
 */
import { Component, computed, inject } from '@angular/core';
import { StorageService, cefrToNumber } from '../../services/storage.service';
import { Mistake } from '../../models/session.model';

// CEFR 推移グラフの寸法（SVG viewBox）
const CHART = { w: 300, h: 150, padL: 22, padR: 8, padT: 12, padB: 26 };

interface CefrSeries {
  name: string;
  color: string;
  line: string;                                // polyline points 属性用
  dots: { x: number; y: number }[];
}

@Component({
  selector: 'app-mistakes',
  templateUrl: './mistakes.html',
  styleUrl: './mistakes.scss',
})
export class Mistakes {
  private storage = inject(StorageService);

  // ── 派生状態（computed） ──────────────────────────────────────────
  studyStats = computed(() => this.storage.getStudyStats());
  stats = computed(() => this.storage.getMistakeStats());
  maxCount = computed(() => this.stats()[0]?.count ?? 1);
  frequent = computed(() => this.storage.getFrequentMistakes() as (Mistake & { count: number })[]);
  cefrHistory = computed(() => this.storage.getCefrHistory());

  readonly chartBox = CHART;
  // y軸グリッド（CEFRレベル 1=A1 〜 6=C2）
  readonly cefrLevels = [
    { label: 'C2', y: this.yFor(6) },
    { label: 'B2', y: this.yFor(4) },
    { label: 'A2', y: this.yFor(2) },
  ];

  // ── CEFR 推移グラフ用の3系列（2点以上のときのみ描画） ───────────────
  cefrChart = computed<CefrSeries[]>(() => {
    const history = this.cefrHistory();
    if (history.length < 2) return [];
    const n = history.length;
    const innerW = CHART.w - CHART.padL - CHART.padR;
    const xFor = (i: number) => CHART.padL + (i / (n - 1)) * innerW;

    const build = (name: string, color: string, pick: (h: { cefr: { grammar: string; vocabulary: string; content: string } }) => string): CefrSeries => {
      const dots = history.map((h, i) => ({ x: xFor(i), y: this.yFor(cefrToNumber(pick(h))) }));
      return { name, color, line: dots.map(d => `${d.x},${d.y}`).join(' '), dots };
    };

    return [
      build('文法', '#a78bfa', h => h.cefr.grammar),
      build('語彙', '#34d399', h => h.cefr.vocabulary),
      build('内容', '#f59e0b', h => h.cefr.content),
    ];
  });

  barWidth(count: number): string {
    return `${Math.round((count / this.maxCount()) * 100)}%`;
  }

  // CEFR レベル値（1〜6）を SVG の y 座標に変換
  private yFor(level: number): number {
    const innerH = CHART.h - CHART.padT - CHART.padB;
    const clamped = Math.max(1, Math.min(6, level));
    return CHART.padT + (1 - (clamped - 1) / 5) * innerH;
  }
}
