/**
 * @file 翻訳辞書 - 共通セクション（アプリ全体で使う汎用文言: app/sidebar/consent/whatsNew/notice/feedback）。
 * ja/en を同一キーごとにペアで定義し、`./index.ts` でマージされ TRANSLATIONS を構成する。
 */

// ── common ──
export const common = {
  ja: {
    'app.title': '英文ラボ',
    'sidebar.expand': 'サイドバーを表示',
    'sidebar.collapse': 'サイドバーを格納',
    'sidebar.language': '言語',

    'nav.practice': '添削',
    'nav.drill': 'ドリル',
    'nav.history': '履歴',
    'nav.mistakes': 'ミス傾向',
    'nav.achievements': '実績',
    'nav.settings': '設定',
    'nav.dev': '開発',

    'consent.title': 'ご利用にあたって',
    'consent.body1':
      '本アプリは、入力した英文を添削のために Google Gemini API へ送信します。ログインした場合は添削データが Firebase（Google）に保存されます。詳細は下記をご確認のうえ、同意いただける場合のみご利用ください。',
    'consent.body2':
      '添削には利用者ご自身が取得した API キーを使用します。Gemini API の利用料金が発生した場合、その負担は利用者ご自身に帰属し、当方は一切の責任を負いません。Google アカウント側の課金設定と利用上限をご確認ください。',
    'consent.privacy': 'プライバシーポリシー',
    'consent.terms': '利用規約',
    'consent.disclaimer': '免責事項',
    'consent.accept': '同意して続ける',

    'whatsNew.title': '新機能とアップデート',
    'whatsNew.fixes': '不具合修正',
    'whatsNew.close': '閉じる',

    'notice.close': '閉じる',

    'feedback.buttonText': '💬 ご意見・ご要望',
    'feedback.buttonLabel': 'アプリへのご意見・ご要望・不具合報告をお聞かせください',
  },
  en: {
    'app.title': 'Eibun-Lab',
    'sidebar.expand': 'Show sidebar',
    'sidebar.collapse': 'Collapse sidebar',
    'sidebar.language': 'Language',

    'nav.practice': 'Correct',
    'nav.drill': 'Drill',
    'nav.history': 'History',
    'nav.mistakes': 'Trends',
    'nav.achievements': 'Achievements',
    'nav.settings': 'Settings',
    'nav.dev': 'Dev',

    'consent.title': 'Before You Continue',
    'consent.body1':
      'This app sends the English text you enter to the Google Gemini API for correction. If you log in, correction data is stored in Firebase (Google). Please review the details below before agreeing to use the app.',
    'consent.body2':
      'Corrections use an API key you obtain yourself. If Gemini API usage fees are incurred, you are solely responsible for them; we accept no liability. Please check your Google account billing settings and usage limits.',
    'consent.privacy': 'Privacy Policy',
    'consent.terms': 'Terms of Service',
    'consent.disclaimer': 'Disclaimer',
    'consent.accept': 'Agree and Continue',

    'whatsNew.title': "What's New",
    'whatsNew.fixes': 'Bug Fixes',
    'whatsNew.close': 'Close',

    'notice.close': 'Close',

    'feedback.buttonText': '💬 Feedback',
    'feedback.buttonLabel': 'Share your feedback, requests, or bug reports',
  },
} as const;
