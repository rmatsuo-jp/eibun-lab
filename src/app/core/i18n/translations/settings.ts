/**
 * @file 翻訳辞書 - settings（設定）セクション。
 * ja/en を同一キーごとにペアで定義し、`./index.ts` でマージされ TRANSLATIONS を構成する。
 */

// ── settings ──
export const settings = {
  ja: {
    'settings.title': '設定',
    'settings.account': 'アカウント（データ同期）',
    'settings.accountHint': 'Google でログインすると、添削データを他の端末と共有できます。',
    'settings.loggedIn': 'ログイン中',
    'settings.logout': 'ログアウト',
    'settings.login': 'Google でログイン',
    'settings.processing': '処理中…',
    'settings.authNote':
      'クラウド同期は許可されたユーザー（ホワイトリスト制）のみ利用できます。ログインなしでもローカル保存で全機能を利用できます。',
    'settings.theme': '外観テーマ',
    'settings.themeLight': 'ライト',
    'settings.themeDark': 'ダーク',
    'settings.language': '表示言語',
    'settings.languageJa': '日本語',
    'settings.languageEn': 'English',
    'settings.apiKey': 'Gemini API キー',
    'settings.apiKeyHint': 'で取得できます。',
    'settings.apiKeyPlaceholder': 'API キーを貼り付け',
    'settings.show': '表示',
    'settings.hide': '隠す',
    'settings.save': '保存',
    'settings.unsavedHint': '● API キーが保存されていません',
    'settings.billingTitle': 'API 利用料金についてのご注意',
    'settings.billing1':
      '無料枠を超えた利用や、Google Cloud の請求先アカウントを紐付けたプロジェクトのキーを使用した場合、料金が発生することがあります。',
    'settings.billing2':
      'API の利用料金・請求は利用者ご自身の Google アカウントに帰属します。本アプリは料金を負担せず、一切の責任を負いません。',
    'settings.billing3':
      '意図しない課金を防ぐため、Google Cloud 側で利用上限（割り当て）や予算アラートの設定を強く推奨します。',
    'settings.pricing': 'Gemini API の料金体系',
    'settings.legal': '法的情報',
    'settings.modelPriority': 'モデルの優先順位（フォールバック順）',
    'settings.modelPriorityHint':
      '上から順に試行します。API送信に失敗した場合、次のモデルに自動的に切り替わります。ドラッグして並び替えできます。',
    'settings.version': 'バージョン情報',
    'settings.versionLine': 'Ver {version}（リリース日 {date}）',
    'settings.showReleaseNotes': 'リリースノートを見る',
    'settings.hideReleaseNotes': '閉じる',
    'settings.github': 'GitHub',
    'settings.confirmLeave': 'API キーの変更が保存されていません。移動しますか？',
  },
  en: {
    'settings.title': 'Settings',
    'settings.account': 'Account (Data Sync)',
    'settings.accountHint': 'Sign in with Google to share your correction data across devices.',
    'settings.loggedIn': 'Logged in',
    'settings.logout': 'Log Out',
    'settings.login': 'Sign in with Google',
    'settings.processing': 'Processing…',
    'settings.authNote':
      'Cloud sync is available only to whitelisted users. All features work locally without logging in.',
    'settings.theme': 'Appearance',
    'settings.themeLight': 'Light',
    'settings.themeDark': 'Dark',
    'settings.language': 'Display Language',
    'settings.languageJa': '日本語',
    'settings.languageEn': 'English',
    'settings.apiKey': 'Gemini API Key',
    'settings.apiKeyHint': 'You can obtain one here.',
    'settings.apiKeyPlaceholder': 'Paste your API key',
    'settings.show': 'Show',
    'settings.hide': 'Hide',
    'settings.save': 'Save',
    'settings.unsavedHint': '● API key not saved',
    'settings.billingTitle': 'A Note on API Usage Fees',
    'settings.billing1':
      'Fees may be incurred if you exceed the free tier or use a key from a Google Cloud project linked to a billing account.',
    'settings.billing2':
      'API usage fees and billing belong solely to your own Google account. This app bears no responsibility for any charges.',
    'settings.billing3':
      'To prevent unintended charges, we strongly recommend setting usage limits (quotas) and budget alerts on the Google Cloud side.',
    'settings.pricing': 'Gemini API Pricing',
    'settings.legal': 'Legal',
    'settings.modelPriority': 'Model Priority (Fallback Order)',
    'settings.modelPriorityHint':
      'Tried from top to bottom. If a request fails, it automatically falls back to the next model. Drag to reorder.',
    'settings.version': 'Version Info',
    'settings.versionLine': 'Version {version} (released {date})',
    'settings.showReleaseNotes': 'View Release Notes',
    'settings.hideReleaseNotes': 'Close',
    'settings.github': 'GitHub',
    'settings.confirmLeave': 'Your API key changes have not been saved. Leave anyway?',
  },
} as const;
