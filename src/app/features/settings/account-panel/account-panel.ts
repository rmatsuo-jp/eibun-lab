/**
 * @file 設定ページのアカウントパネル（Google SSO ログイン/ログアウト）。settings.html から切り出したUIブロック。
 * クラウド同期はホワイトリスト制。非許可ユーザーのログイン拒否メッセージは AuthService.loginError が保持する。
 */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AuthService } from '@core/firebase/auth.service';
import { I18nService } from '@core/i18n/i18n.service';

@Component({
  selector: 'app-account-panel',
  imports: [],
  templateUrl: './account-panel.html',
  styleUrl: './account-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPanel {
  private auth = inject(AuthService);
  protected i18n = inject(I18nService);

  readonly user = this.auth.user;
  // 非許可ユーザーのログイン拒否メッセージ（ホワイトリスト制。auth.service.ts が設定）
  readonly loginError = this.auth.loginError;
  authBusy = signal(false);

  async login() {
    this.authBusy.set(true);
    try {
      await this.auth.login();
    } catch (err) {
      console.error('[AccountPanel] ログインに失敗:', err);
    } finally {
      this.authBusy.set(false);
    }
  }

  async logout() {
    this.authBusy.set(true);
    try {
      await this.auth.logout();
    } finally {
      this.authBusy.set(false);
    }
  }
}
