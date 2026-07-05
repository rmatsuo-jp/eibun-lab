/**
 * @file ルートコンポーネント。アプリ起動時に StorageService から theme 設定を読み取り
 * document ルートの data-theme 属性に反映する。
 * PracticeState.notice を購読し、どのタブにいても添削の処理中／完了／エラーを
 * グローバルバナーで表示する（タップで添削タブへ遷移）。
 */
import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { StorageService } from './services/storage.service';
import { PracticeState } from './pages/practice/practice-state.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected practiceState = inject(PracticeState);
  private router = inject(Router);

  // ── サイドバー（PCレイアウト時のみ）の格納状態。既定値 false = 表示中 ──
  protected sidebarCollapsed = signal(false);

  constructor() {
    const theme = inject(StorageService).getSettings().theme;
    document.documentElement.dataset['theme'] = theme;
  }

  // ── バナータップ: 添削タブへ遷移して通知を閉じる ───────────────
  openResult() {
    this.router.navigate(['/practice']);
    this.practiceState.dismissNotice();
  }

  // ── サイドバー格納ボタン: 表示⇔格納をトグル ─────────────────
  toggleSidebar() {
    this.sidebarCollapsed.update((v) => !v);
  }
}
