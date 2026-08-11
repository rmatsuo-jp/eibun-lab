/**
 * @file 本番環境用の設定値。本番ビルド時に environment.dev.ts と差し替えられる。
 * Firebase の構成は同一プロジェクトを参照する（構成値はクライアント公開情報）。
 */

// ── Firebase 構成（クライアント公開情報。保護は Firestore セキュリティルールで担保） ─
export const environment = {
  production: true,
  firebase: {
    apiKey: 'AIzaSyCrQ2tRMuq0olqh0Q-f7cjDXWX020sIeqA',
    authDomain: 'eibun-lab.firebaseapp.com',
    projectId: 'eibun-lab',
    storageBucket: 'eibun-lab.firebasestorage.app',
    messagingSenderId: '812400203705',
    appId: '1:812400203705:web:a2d2a37750546a72234868',
  },
};
