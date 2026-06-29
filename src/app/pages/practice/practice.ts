/**
 * @file 英作文入力・添削結果表示ページ。
 * 状態（入力テキスト・添削結果・ローディング）は PracticeState サービスが保持するため、
 * タブ遷移でコンポーネントが破棄されても消えない。本コンポーネントは表示と入力の橋渡しに専念する。
 */
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { renderSafeMarkdown } from '../../utils/markdown.util';
import { PracticeState } from './practice-state.service';

@Component({
  selector: 'app-practice',
  imports: [FormsModule],
  templateUrl: './practice.html',
  styleUrl: './practice.scss',
})
export class Practice {
  // ── 状態はサービスへ委譲（テンプレートから state.xxx で参照） ──────
  state = inject(PracticeState);
  private sanitizer = inject(DomSanitizer);

  toHtml(markdown: string): SafeHtml {
    // marked → DOMPurify でサニタイズした HTML のみ信頼済みとして渡す。
    return this.sanitizer.bypassSecurityTrustHtml(renderSafeMarkdown(markdown));
  }
}
