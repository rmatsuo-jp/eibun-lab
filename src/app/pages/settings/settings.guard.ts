/**
 * @file 設定ページ離脱時に未保存の変更があれば確認ダイアログを出す CanDeactivate ガード。
 */
import { CanDeactivateFn } from '@angular/router';
import type { Settings } from './settings';

export const settingsCanDeactivateGuard: CanDeactivateFn<Settings> = component =>
  component.canDeactivate();
