/**
 * @file 法的文書（プライバシーポリシー・利用規約・免責事項）表示ページ。
 * ルートパラメータ :doc（privacy | terms | disclaimer）に応じて public/legal/{doc}.md を
 * HttpClient で取得し、history.ts と同じく renderSafeMarkdown() → bypassSecurityTrustHtml() を
 * 経由して表示する。文書の原本は docs/legal/ の1箇所のみ。angular.json の assets 設定により
 * ビルド時に docs/legal/*.md が dist/legal/ へ自動コピーされる（手動同期は不要）。
 */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { renderSafeMarkdown } from '@shared/utils/markdown.util';

const DOC_TITLES: Record<string, string> = {
  privacy: 'プライバシーポリシー',
  terms: '利用規約',
  disclaimer: '免責事項',
};

@Component({
  selector: 'app-legal',
  imports: [RouterLink],
  templateUrl: './legal.html',
  styleUrl: './legal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Legal {
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);
  private route = inject(ActivatedRoute);

  title = signal('');
  html = signal<SafeHtml | null>(null);

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const doc = params.get('doc') ?? 'privacy';
      this.title.set(DOC_TITLES[doc] ?? '法的情報');
      this.html.set(null);
      this.http.get(`legal/${doc}.md`, { responseType: 'text' }).subscribe({
        next: (markdown) =>
          this.html.set(this.sanitizer.bypassSecurityTrustHtml(renderSafeMarkdown(markdown))),
        error: () =>
          this.html.set(
            this.sanitizer.bypassSecurityTrustHtml('<p>文書の読み込みに失敗しました。</p>'),
          ),
      });
    });
  }
}
