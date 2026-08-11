/**
 * @file 開発環境用の設定値。Firebase の構成（公開情報）を保持する。
 * 本番ビルド時は angular.json の fileReplacements により environment.prod.ts に差し替えられる。
 */

// ── Firebase 構成（クライアント公開情報。保護は Firestore セキュリティルールで担保） ─
export const environment = {
  production: false,
  firebase: {
    apiKey: 'AIzaSyCrQ2tRMuq0olqh0Q-f7cjDXWX020sIeqA',
    authDomain: 'eibun-lab.firebaseapp.com',
    projectId: 'eibun-lab',
    storageBucket: 'eibun-lab.firebasestorage.app',
    messagingSenderId: '812400203705',
    appId: '1:812400203705:web:a2d2a37750546a72234868',
  },
};
