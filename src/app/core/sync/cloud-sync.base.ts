/**
 * @file Firestore 双方向同期サービスの共通基底クラス。
 * sessions / drillProgress / gamification の3サービスが共有する定型処理
 * （同期エラー signal、ログイン監視 effect、fire-and-forget push の成否ハンドリング）をまとめる。
 * 派生クラスは super(logTag, syncErrorMessage) を呼び、syncFromCloud() を実装し、
 * コンストラクタで initCloudSync() を呼ぶ（effect 生成には注入コンテキストが必要なため、
 * 基底ではなく派生のコンストラクタから呼ぶ）。
 * syncError は読み取り専用 signal として公開し、app.ts がグローバルバナーで通知する。
 * 同期が成功すると自動で null に戻る。
 */
import { effect, inject, signal } from '@angular/core';
import { AuthService } from '@core/firebase/auth.service';

export abstract class CloudSyncBase {
  protected auth = inject(AuthService);

  // クラウド同期の直近の失敗メッセージ（成功時は null に戻る）。app.ts が購読して通知バナーに出す。
  private _syncError = signal<string | null>(null);
  readonly syncError = this._syncError.asReadonly();

  /**
   * @param logTag console.error に付ける識別子（従来どおりサービス名を渡す）
   * @param syncErrorMessage 同期失敗時にユーザーへ見せる日本語メッセージ
   */
  constructor(
    private readonly logTag: string,
    private readonly syncErrorMessage: string,
  ) {}

  /** ログイン直後に呼ばれる双方向同期。マージ規則はデータ種別ごとに派生クラスが決める。 */
  abstract syncFromCloud(uid: string): Promise<void>;

  // ── ログイン監視（派生クラスのコンストラクタから呼ぶ） ──────────────
  // ログインした瞬間にクラウドと双方向同期する。ログアウト時（user が null）は
  // ローカルキャッシュをそのまま残す。
  protected initCloudSync(): void {
    effect(() => {
      const user = this.auth.user();
      if (user) {
        this.syncFromCloud(user.uid)
          .then(() => this._syncError.set(null))
          .catch((err) => this.reportFailure('クラウド同期に失敗', err));
      }
    });
  }

  // ── 書き込み直後の push（fire-and-forget） ──────────────────────
  // ログイン中でなければ呼び出し側が事前に弾く前提。成否に応じたフックで、
  // FirestoreSyncService の再送キュー（pendingPushIds）のような派生固有の処理を差し込む。
  protected runPush(
    push: Promise<unknown>,
    hooks?: { onSuccess?: () => void; onFailure?: () => void },
  ): void {
    push
      .then(() => {
        hooks?.onSuccess?.();
        this._syncError.set(null);
      })
      .catch((err) => {
        hooks?.onFailure?.();
        this.reportFailure('同期に失敗', err);
      });
  }

  // 失敗を console と syncError signal の両方へ流す（メッセージ書式を3サービスで揃える）。
  private reportFailure(context: string, err: unknown): void {
    console.error(`[${this.logTag}] ${context}:`, err);
    this._syncError.set(this.syncErrorMessage);
  }
}
