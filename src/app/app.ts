/**
 * @file ルートコンポーネント。アプリ起動時に SettingsStoreService から theme・language 設定を読み取り、
 * それぞれ document ルートの data-theme 属性・I18nService（lang signal + document.lang）に反映する。
 * PracticeState.notice を購読し、どのタブにいても添削の処理中／完了／エラーを
 * グローバルバナーで表示する（タップで添削タブへ遷移）。
 * 初回起動時、および同意文言が改訂された場合（SettingsStoreService.needsConsent()）は、
 * 英文がGemini APIへ送信される旨・API利用料金が利用者負担である旨を伝える同意モーダルを表示し、
 * 「同意して続ける」で SettingsStoreService.acceptConsent() を呼ぶ。
 * サイドバーの JA/EN トグル（toggleLanguage）は setLang() による即時反映と saveSettings() による
 * 即時永続化を同時に行う（settings.ts の updateTheme() と同じ即時保存パターン）。
 * ボトムナビ（#bottomNav）は ResizeObserver で実高さを監視し、--bottom-nav-height に反映する
 * （ナビ項目のラベル折り返し等で高さが app.scss の固定値を超えても .app-content の
 * padding-bottom が追従し、最下部コンテンツがタブバーに隠れないようにするため）。
 * ResizeObserver は #bottomNav 自身のボックスサイズ変化にしか反応しないため、PWAスタンドアロン
 * 起動時に env(safe-area-inset-bottom) の確定が初回レイアウトより遅れるケース（iOS Safari standalone
 * で知られる挙動）に備え、window resize・visualViewport resize・起動直後の遅延再チェックでも
 * applyHeight() を呼び直す。
 * --bottom-nav-height は .app-content/.global-notice の余白計算にのみ使い、
 * bottom-nav/nav-item自身のmin-heightには使わない（自己参照によるResizeObserverの
 * 増殖ループ－高さが際限なく増え続ける不具合－を避けるため）。
 * PC レイアウト（768px 以上、サイドバー化）では app.scss 側で --bottom-nav-height を 0rem に
 * 固定しているため、実測反映は行わない。
 * feedbackFormUrl は全画面右上固定のフィードバックボタン（app.html）が遷移する外部Googleフォームの
 * URL。ユーザーからの機能要望・不具合報告・感想を受け付ける目的で、フォーム自体は自作せず外部リンクのみ提供する。
 * syncError は FirestoreSyncService/DrillProgressSyncService のクラウド同期失敗を、practiceState.notice と
 * 同じグローバルバナー（.global-notice）で表示する（練習の添削通知が無い時のみ、優先度を下げて表示）。
 */
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  computed,
  effect,
  viewChild,
  afterNextRender,
  DestroyRef,
} from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { environment } from '../environments/environment';
import { SettingsStoreService } from '@core/settings/settings-store.service';
import { I18nService } from '@core/i18n/i18n.service';
import { Lang } from '@core/i18n/lang.model';
import { PracticeState } from '@features/practice/practice-state.service';
import { FirestoreSyncService } from '@core/sessions/firestore-sync.service';
import { DrillProgressSyncService } from '@features/drill/drill-progress-sync.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected practiceState = inject(PracticeState);
  private router = inject(Router);
  private settingsStore = inject(SettingsStoreService);
  private destroyRef = inject(DestroyRef);
  protected i18n = inject(I18nService);
  private firestoreSync = inject(FirestoreSyncService);
  private drillProgressSync = inject(DrillProgressSyncService);

  // ── クラウド同期失敗の通知（練習の添削通知が無い時だけ表示） ─────────
  // 閉じるボタンで syncErrorDismissed を立てるが、次回同期が成功して syncError が null に戻ると
  // effect() で自動的にリセットし、以後の失敗を再び通知できるようにする。
  private syncErrorDismissed = signal(false);
  private rawSyncError = computed(
    () => this.firestoreSync.syncError() ?? this.drillProgressSync.syncError(),
  );
  protected syncError = computed(() => (this.syncErrorDismissed() ? null : this.rawSyncError()));

  private bottomNav = viewChild<ElementRef<HTMLElement>>('bottomNav');
  private readonly desktopMedia = window.matchMedia('(min-width: 768px)');

  // ── サイドバー（PCレイアウト時のみ）の格納状態。既定値 false = 表示中 ──
  protected sidebarCollapsed = signal(false);

  // ── 開発用ナビ項目の表示可否（本番ビルドでは /dev ルート自体が存在しないため非表示にする） ─
  protected isDev = !environment.production;

  // ── フィードバック用Googleフォームのリンク先（全画面共通の右上固定ボタンから遷移） ──
  protected readonly feedbackFormUrl = 'https://forms.gle/es4FQrQrWd2h73kZ9';

  // ── 同意モーダルの表示可否（初回起動時、または同意文言が改訂された場合に表示） ──
  protected showConsent = signal(this.settingsStore.needsConsent());

  constructor() {
    const settings = this.settingsStore.getSettings();
    document.documentElement.dataset['theme'] = settings.theme;
    this.i18n.setLang(settings.language);

    afterNextRender(() => this.observeBottomNavHeight());

    // 同期が成功して rawSyncError が null に戻ったら、次の失敗を再び通知できるよう dismissed を解除する
    effect(() => {
      if (this.rawSyncError() === null) this.syncErrorDismissed.set(false);
    });
  }

  // ── bottom-nav の実高さを監視し、--bottom-nav-height に反映（PCサイドバー時は対象外） ──
  private observeBottomNavHeight() {
    const el = this.bottomNav()?.nativeElement;
    const shell = el?.closest<HTMLElement>('.app-shell');
    if (!el || !shell) return;

    // app-shell自身が--bottom-nav-heightを宣言しているため、documentElement等の
    // 祖先要素にセットしても継承で上書きできない。同じ要素に直接設定する。
    // 値が変化した時のみ書き込む（同値の再設定によるResizeObserverの無駄な再発火を避けるため）。
    let lastHeight = -1;
    const applyHeight = () => {
      if (this.desktopMedia.matches) return;
      const height = el.offsetHeight;
      if (height === lastHeight) return;
      lastHeight = height;
      shell.style.setProperty('--bottom-nav-height', `${height}px`);
    };

    const observer = new ResizeObserver(applyHeight);
    observer.observe(el);
    this.desktopMedia.addEventListener('change', applyHeight);
    window.addEventListener('resize', applyHeight);
    window.visualViewport?.addEventListener('resize', applyHeight);
    const deferredCheck = window.setTimeout(applyHeight, 300);
    applyHeight();

    this.destroyRef.onDestroy(() => {
      observer.disconnect();
      this.desktopMedia.removeEventListener('change', applyHeight);
      window.removeEventListener('resize', applyHeight);
      window.visualViewport?.removeEventListener('resize', applyHeight);
      window.clearTimeout(deferredCheck);
    });
  }

  // ── 表示言語のトグル: signal 反映と同時に即時永続化する ──────────
  toggleLanguage(lang: Lang) {
    this.i18n.setLang(lang);
    this.settingsStore.saveSettings({ ...this.settingsStore.getSettings(), language: lang });
  }

  acceptConsent() {
    this.settingsStore.acceptConsent();
    this.showConsent.set(false);
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

  // ── 同期エラーバナーの閉じるボタン: 次回同期成功まで再表示しない ──────
  dismissSyncError() {
    this.syncErrorDismissed.set(true);
  }
}
