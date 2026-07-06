/**
 * @file Angular グローバル設定。グローバルエラーリスナー、ルーター、HttpClient（法的文書のfetchに使用）、
 * Service Worker（本番のみ有効）を提供する。
 * initializeAppUpdates() を APP_INITIALIZER として登録し、新バージョンの Service Worker が
 * インストールされたら自動でアクティベート＋リロードして、GitHub Pages 上での旧バージョン
 * キャッシュ残存問題を解消する。
 * また GEMINI_LOGGER トークンに開発ビルド時のみ DevLogService を provide し、core→features の
 * 直接依存なしに Gemini 送受信ログを記録できるようにする。
 */
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  isDevMode,
  APP_INITIALIZER,
  inject,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import { provideServiceWorker, SwUpdate } from '@angular/service-worker';
import { environment } from '../environments/environment';
import { GEMINI_LOGGER } from '@core/logging/gemini-log.token';
import { DevLogService } from '@features/dev/dev-log.service';

// ── Service Worker 更新監視: 新バージョン検知時に即座にアクティベートしてリロードする ──
// 目的: GitHub Pages 上で古いバージョンがキャッシュされ続け、スーパーリロードしないと
// 反映されない問題を恒久的に解消するため。APP_INITIALIZER としてアプリ起動時に購読を開始する。
function initializeAppUpdates() {
  return () => {
    if (!isDevMode()) {
      const swUpdate = inject(SwUpdate);
      if (swUpdate.isEnabled) {
        swUpdate.versionUpdates.subscribe((event) => {
          if (event.type === 'VERSION_READY') {
            swUpdate.activateUpdate().then(() => document.location.reload());
          }
        });
        swUpdate.checkForUpdate();
      }
    }
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    { provide: APP_INITIALIZER, useFactory: initializeAppUpdates, multi: true },
    // ── Gemini 送受信ログ: 開発ビルドのみ DevLogService を紐付ける（本番は no-op デフォルト） ──
    // /dev ルートと同じ environment.production 分岐なので、本番バンドルからは tree-shaking で除外される。
    ...(environment.production
      ? []
      : [{ provide: GEMINI_LOGGER, useExisting: DevLogService }]),
  ],
};
