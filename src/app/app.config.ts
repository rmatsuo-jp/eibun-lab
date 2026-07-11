/**
 * @file Angular グローバル設定。ルーター・HttpClient・Service Worker（本番のみ）を提供し、
 * SW更新監視とAPIキー復号を APP_INITIALIZER で起動前に完了させる。
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
import { SettingsStoreService } from '@core/settings/settings-store.service';
import { DevLogService } from '@features/dev/dev-log.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerImmediately',
    }),
    // ── Service Worker 更新監視: 新バージョン検知時に即座にアクティベートしてリロードする ──
    // 目的: GitHub Pages 上で古いバージョンがキャッシュされ続け、スーパーリロードしないと
    // 反映されない問題を恒久的に解消するため。inject(SwUpdate) は factory 本体（injection
    // context 内）で解決し、戻り値の関数へキャプチャする（この関数は init 実行フェーズ＝
    // context 外で呼ばれるため、中で inject() すると NG0203 で購読登録に失敗する）。
    // registerImmediately 指定で起動直後にチェックし、タブ復帰時（visibilitychange）にも再チェック。
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        const swUpdate = inject(SwUpdate);
        return () => {
          if (isDevMode() || !swUpdate.isEnabled) return;
          swUpdate.versionUpdates.subscribe((event) => {
            if (event.type === 'VERSION_READY') {
              swUpdate.activateUpdate().then(() => document.location.reload());
            }
          });
          swUpdate.checkForUpdate();
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              swUpdate.checkForUpdate();
            }
          });
        };
      },
      multi: true,
    },
    // ── APIキーの復号初期化: 暗号化保存された apiKeyEnc を起動時に復号してメモリへ載せる ──
    // getSettings() は同期APIのため、復号（非同期）をアプリ起動前に完了させておく必要がある。
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        const settings = inject(SettingsStoreService);
        return () => settings.init();
      },
      multi: true,
    },
    // ── Gemini 送受信ログ: 開発ビルドのみ DevLogService を紐付ける（本番は no-op デフォルト） ──
    // /dev ルートと同じ environment.production 分岐なので、本番バンドルからは tree-shaking で除外される。
    ...(environment.production ? [] : [{ provide: GEMINI_LOGGER, useExisting: DevLogService }]),
  ],
};
