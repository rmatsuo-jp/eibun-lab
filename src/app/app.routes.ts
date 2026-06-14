import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'practice', pathMatch: 'full' },
  {
    path: 'practice',
    loadComponent: () => import('./pages/practice/practice').then(m => m.Practice),
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
