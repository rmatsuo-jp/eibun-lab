/**
 * @file 遅延ロード（loadComponent）を使ったルーティング設定。
 * デフォルトは /practice にリダイレクト。ルートは practice / drill / history / mistakes / settings / dev の 6 つ。
 * dev ルートは environment.production が true の場合はルート自体を登録しない（本番ビルドの route table・
 * lazy chunk から dev ページを除外し、APIキー等が見える開発用画面が本番に出荷されないようにする）。
 */
import { Routes } from '@angular/router';
import { environment } from '../environments/environment';
import { settingsCanDeactivateGuard } from './pages/settings/settings.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'practice', pathMatch: 'full' },
  {
    path: 'practice',
    loadComponent: () => import('./pages/practice/practice').then(m => m.Practice),
  },
  {
    path: 'drill',
    loadComponent: () => import('./pages/drill/drill').then(m => m.Drill),
  },
  {
    path: 'history',
    loadComponent: () => import('./pages/history/history').then(m => m.History),
  },
  {
    path: 'mistakes',
    loadComponent: () => import('./pages/mistakes/mistakes').then(m => m.Mistakes),
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings').then(m => m.Settings),
    canDeactivate: [settingsCanDeactivateGuard],
  },
  // ── 開発用ページ（本番ビルドでは非搭載） ────────────────────────
  ...(environment.production
    ? []
    : [
        {
          path: 'dev',
          loadComponent: () => import('./pages/dev/dev').then(m => m.Dev),
        },
      ]),
];
