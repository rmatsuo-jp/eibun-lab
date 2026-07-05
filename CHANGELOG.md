# [1.6.0](https://github.com/rmatsuo-jp/study-english/compare/v1.5.0...v1.6.0) (2026-07-05)


### Bug Fixes

* ミスカテゴリの英日表記ゆれを正規化して統計の重複を解消 ([4924e1d](https://github.com/rmatsuo-jp/study-english/commit/4924e1d227b88d8c1875084395f313dd6addca38))


### Features

* レベルアップ表現を構造化しDrillに日付別3段階タイピングモードを追加 ([9c48f29](https://github.com/rmatsuo-jp/study-english/commit/9c48f29af1d02be922b7946342959ce0102605c0))
* 履歴にカレンダー表示を追加し添削済みの日を一目で確認できるように ([346eef9](https://github.com/rmatsuo-jp/study-english/commit/346eef96973f7b41c450289d9fc14bc165950191))
* 履歴のすべて選択/解除ボタンとエクスポートファイル名の分単位タイムスタンプ化 ([b784fee](https://github.com/rmatsuo-jp/study-english/commit/b784fee127e5e2551530ce2b1a8dfeafa5584522))
* 推移グラフに凡例クリックでの系列強調とCEFR全段階表示を追加 ([64a5927](https://github.com/rmatsuo-jp/study-english/commit/64a592777d599194b38688e256f177deaf0eeeb7))


### Performance Improvements

* 一括添削を同時実行数3件の並列処理に変更 ([dada7bb](https://github.com/rmatsuo-jp/study-english/commit/dada7bbfc32a1363be991a58da991c5010c92c76))

# [1.5.0](https://github.com/rmatsuo-jp/study-english/compare/v1.4.0...v1.5.0) (2026-07-05)


### Bug Fixes

* 履歴の展開領域でテキスト選択・コピーができない不具合を修正 ([fe7068c](https://github.com/rmatsuo-jp/study-english/commit/fe7068c0f84355c8196307266f90380d1f4dbbb0))
* 履歴の展開領域でドラッグ選択が解除される/範囲外解放で閉じる不具合を修正 ([0a4260d](https://github.com/rmatsuo-jp/study-english/commit/0a4260d7b95bbe601ce9cbc69e313f0dc32fdce8))


### Features

* 添削タブに一括添削機能を追加 ([59cc008](https://github.com/rmatsuo-jp/study-english/commit/59cc008d5fa7cb814ee1bad5f57cd2d90634193d))
* 添削プロンプトにレベル別学習法を追加しドリル出題を頻度・習熟度で重み付け ([89feeaa](https://github.com/rmatsuo-jp/study-english/commit/89feeaa96ea9797d52e86fd183ac4bdeba531c7f))

# [1.4.0](https://github.com/rmatsuo-jp/study-english/compare/v1.3.0...v1.4.0) (2026-07-02)


### Features

* 使用モデルを5種類に拡張しフォールバック優先順位を設定可能にする ([d267d65](https://github.com/rmatsuo-jp/study-english/commit/d267d656ceeb09fe7a4469cbf2031b1a91984456))
* 設定タブのプロンプトプレビューを削除 ([89a93bf](https://github.com/rmatsuo-jp/study-english/commit/89a93bfacf255fda44ae9aabab3ac58ba5af4504))
* 設定画面に未保存変更の警告機能を追加 ([cc30a9d](https://github.com/rmatsuo-jp/study-english/commit/cc30a9d4a1984f8d5fb61e0e13b7da5c277d544a))
* 開発タブでGemini API送受信ログを確認できるようにする ([7fa2156](https://github.com/rmatsuo-jp/study-english/commit/7fa215673b926d0ae6734bb0f835c5ae67e1ccd0))

# [1.3.0](https://github.com/rmatsuo-jp/study-english/compare/v1.2.0...v1.3.0) (2026-07-01)


### Features

* CEFR判定の精度を改善し総合スコアはシステム側算出に統一 ([59b5a8c](https://github.com/rmatsuo-jp/study-english/commit/59b5a8c6619133768113aac6ea8b0b3d806c1486))
* 添削結果の評価スコアを解説より上に表示し項目名を整理 ([94fc472](https://github.com/rmatsuo-jp/study-english/commit/94fc47286474e6738dc7bae36c83ba9f77a7954e))

# [1.2.0](https://github.com/rmatsuo-jp/study-english/compare/v1.1.0...v1.2.0) (2026-06-30)


### Features

* スコア推移・CEFR推移グラフの横軸に添削日付を表示 ([0f425e8](https://github.com/rmatsuo-jp/study-english/commit/0f425e8465f86158beab6efb3c5f3b379a862eaf))
* 添削オプションのトグルを廃止し全項目を常時有効化 ([aa9781e](https://github.com/rmatsuo-jp/study-english/commit/aa9781e9af5c3123d2ac30112f000c136e7b2293))

# [1.1.0](https://github.com/rmatsuo-jp/study-english/compare/v1.0.0...v1.1.0) (2026-06-30)


### Features

* CEFR評価を定量ルーブリック（10点満点＋エラー密度）に刷新 ([0fed958](https://github.com/rmatsuo-jp/study-english/commit/0fed9580df8d04f77e88999bff23b120f1da3379))
* 添削の状態をグローバルバナーで全タブに通知 ([fa1fc23](https://github.com/rmatsuo-jp/study-english/commit/fa1fc235d26fe4945e10625521e5caf6f5499df6))
* 添削結果に元の英作文を表示 ([d79f564](https://github.com/rmatsuo-jp/study-english/commit/d79f564ee92c6b0745d078384d6530d749521708))
