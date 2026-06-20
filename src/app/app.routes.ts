/**
 * @file 遅延ロード（loadComponent）を使ったルーティング設定。
 * デフォルトは /practice にリダイレクト。ルートは practice / drill / history / mistakes / settings の 5 つ。
 */
import { Routes } from '@angular/router';

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
  },
];
