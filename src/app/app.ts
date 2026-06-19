/**
 * @file ルートコンポーネント。アプリ起動時に StorageService から theme 設定を読み取り
 * document ルートの data-theme 属性に反映する。
 */
import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { StorageService } from './services/storage.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  constructor() {
    const theme = inject(StorageService).getSettings().theme;
    document.documentElement.dataset['theme'] = theme;
  }
}
