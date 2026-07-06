/**
 * @file 遅延ロード（loadComponent）を使ったルーティング設定。
 * デフォルトは /practice にリダイレクト。ルートは practice / drill / history / mistakes / settings /
 * legal/:doc / dev の7つ。
 * dev ルートは environment.production が true の場合はルート自体を登録しない（本番ビルドの route table・
 * lazy chunk から dev ページを除外し、APIキー等が見える開発用画面が本番に出荷されないようにする）。
 */
import { Routes } from '@angular/router';
import { environment } from '../environments/environment';
import { settingsCanDeactivateGuard } from './features/settings/settings.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'practice', pathMatch: 'full' },
  {
    path: 'practice',
    loadComponent: () => import('./features/practice/practice').then(m => m.Practice),
  },
  {
    path: 'drill',
    loadComponent: () => import('./features/drill/drill').then(m => m.Drill),
  },
  {
    path: 'history',
    loadComponent: () => import('./features/history/history').then(m => m.History),
  },
  {
    path: 'mistakes',
    loadComponent: () => import('./features/mistakes/mistakes').then(m => m.Mistakes),
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings').then(m => m.Settings),
    canDeactivate: [settingsCanDeactivateGuard],
  },
  {
    path: 'legal/:doc',
    loadComponent: () => import('./features/legal/legal').then(m => m.Legal),
  },
  // ── 開発用ページ（本番ビルドでは非搭載） ────────────────────────
  ...(environment.production
    ? []
    : [
        {
          path: 'dev',
          loadComponent: () => import('./features/dev/dev').then(m => m.Dev),
        },
      ]),
];
