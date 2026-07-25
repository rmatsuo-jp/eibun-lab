/**
 * @file ルートコンポーネント。起動時に theme/language・同意モーダルを初期化し、添削通知や同期エラーの
 * グローバルバナー表示、ボトムナビ実高さの --bottom-nav-height への反映を担う。
 * 同意モーダルの表示が不要（または同意完了後）になったタイミングで、リリースノート
 * （「新機能」モーダル）の要否を ReleaseNotesService に問い合わせて表示する
 * （同意モーダルとの同時表示を避けるため、常に同意モーダルを優先する）。
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
import { ReleaseNotesService, ReleaseNoteEntry } from '@core/release-notes/release-notes.service';
import { APP_VERSION } from '../version';

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
  private releaseNotes = inject(ReleaseNotesService);

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

  // ── 新機能モーダルに表示する未読リリースノート（無ければ空配列＝非表示） ──
  protected whatsNewEntries = signal<ReleaseNoteEntry[]>([]);

  constructor() {
    const settings = this.settingsStore.getSettings();
    document.documentElement.dataset['theme'] = settings.theme;
    this.i18n.setLang(settings.language);

    // 同意モーダルが不要なら即座にチェックする。必要な場合は acceptConsent() 完了後にチェックする
    // （同意モーダルとの同時表示を避けるため）。
    if (!this.showConsent()) this.checkWhatsNew();

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
    let rafId = -1;
    const applyHeight = () => {
      // pull-to-refresh中のchrome表示アニメーション等、viewport変化の過渡フレームで
      // offsetHeightを誤読しないよう1フレーム遅延させてから読み取る。
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        if (this.desktopMedia.matches) return;
        const height = el.offsetHeight;
        if (height === lastHeight) return;
        lastHeight = height;
        shell.style.setProperty('--bottom-nav-height', `${height}px`);
      });
    };

    const observer = new ResizeObserver(applyHeight);
    observer.observe(el);
    this.desktopMedia.addEventListener('change', applyHeight);
    window.visualViewport?.addEventListener('resize', applyHeight);
    // PWAスタンドアロン起動時は safe-area-inset-bottom の確定が初回レイアウトより遅れることがある（iOS Safari standalone特有）ため、遅延再チェックで補う
    const deferredCheck = window.setTimeout(applyHeight, 300);
    applyHeight();

    this.destroyRef.onDestroy(() => {
      observer.disconnect();
      this.desktopMedia.removeEventListener('change', applyHeight);
      window.visualViewport?.removeEventListener('resize', applyHeight);
      window.clearTimeout(deferredCheck);
      window.cancelAnimationFrame(rafId);
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
    this.checkWhatsNew();
  }

  // ── 未読のリリースノートがあれば新機能モーダル用にセットする ──────────
  private async checkWhatsNew() {
    const entries = await this.releaseNotes.getUnseenNotes(APP_VERSION);
    if (entries.length) this.whatsNewEntries.set(entries);
  }

  // ── 新機能モーダルを閉じ、現在のバージョンを既読として記録する ──────────
  dismissWhatsNew() {
    this.releaseNotes.markSeen(APP_VERSION);
    this.whatsNewEntries.set([]);
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
