# [0.10.0](https://github.com/rmatsuo-jp/study-english/compare/v0.9.1...v0.10.0) (2026-07-11)


### Bug Fixes

* **drill:** 穴埋め復習カードをレベルアップより上に表示 ([04c26bf](https://github.com/rmatsuo-jp/study-english/commit/04c26bfcd32c9f3a86f18c075ad707a14349f16a))


### Features

* **app:** 全画面共通のフィードバックボタンを追加 ([494dbe1](https://github.com/rmatsuo-jp/study-english/commit/494dbe1ac482eb1e96f88464943aa07b8fd80e27))

## [0.9.1](https://github.com/rmatsuo-jp/study-english/compare/v0.9.0...v0.9.1) (2026-07-11)


### Bug Fixes

* **app:** PWAスタンドアロン起動時の下部タブバー高さ反映を強化 ([49c65e7](https://github.com/rmatsuo-jp/study-english/commit/49c65e7bc3dc3ef7aa8127b34d6ac9cf75f13f36))
* **drill:** 誤答時の「正解にする」ボタンを削除、穴埋めサンプル問題を15問に拡充 ([bff6229](https://github.com/rmatsuo-jp/study-english/commit/bff62293037028432b7a872b2dc4e8a6d136bfb6))

# [0.9.0](https://github.com/rmatsuo-jp/study-english/compare/v0.8.2...v0.9.0) (2026-07-11)


### Bug Fixes

* **drill:** サンプル問題出題中の「日付選択に戻る」が空画面に迷い込む不具合を修正 ([89a06b5](https://github.com/rmatsuo-jp/study-english/commit/89a06b5877ec82135b1bf502c5b65d1f7f5034bf))


### Features

* **drill:** 穴埋め復習の訳を常時表示、単語ヒントをボタン表示化 ([21bd1df](https://github.com/rmatsuo-jp/study-english/commit/21bd1dfab98b3bad0a8aa32b98238981bba7ab02))
* **quiz:** 新規ユーザー向けサンプル問題（4択・レベルアップ）を追加 ([84a3be5](https://github.com/rmatsuo-jp/study-english/commit/84a3be559dc24297353820db7424a55c3b548be2))

## [0.8.2](https://github.com/rmatsuo-jp/study-english/compare/v0.8.1...v0.8.2) (2026-07-11)


### Bug Fixes

* **ci:** GitHub Actionsによる Pages デプロイに移行し Node.js 20 非推奨警告を解消 ([8651201](https://github.com/rmatsuo-jp/study-english/commit/8651201661edd482002b2b7ab5575b441ff84fce))
* **layout:** bottom-navの自己参照ResizeObserverループで高さが増殖する不具合を解消 ([5ab217f](https://github.com/rmatsuo-jp/study-english/commit/5ab217f948764d0e70fb5f5b2704865bdf2b09ef))

## [0.8.1](https://github.com/rmatsuo-jp/study-english/compare/v0.8.0...v0.8.1) (2026-07-11)


### Bug Fixes

* **app:** 下部タブバーの高さを実測してコンテンツの隠れを解消 ([660ab46](https://github.com/rmatsuo-jp/study-english/commit/660ab46573c0164d0b054cda7a83095dd84ae288))
* **drill:** ドリル系ボタンのスタイルを統一し4択キー選択の不具合を解消 ([938bdad](https://github.com/rmatsuo-jp/study-english/commit/938bdad4dbba70930bbfb7d2efb93b36a8c14ac4))
* **settings:** 表示言語ボタンの選択状態をサイドバーと同期 ([766864e](https://github.com/rmatsuo-jp/study-english/commit/766864e82b4569f321f4440e0ee5553155c22b7c))

# [0.8.0](https://github.com/rmatsuo-jp/study-english/compare/v0.7.0...v0.8.0) (2026-07-11)


### Bug Fixes

* **app:** 下部タブバーの高さをCSS変数で一元化しPWAでの重なりを解消 ([9884f72](https://github.com/rmatsuo-jp/study-english/commit/9884f72a2288272bf17b926ecec273863dac8e85))
* **ci:** actions/checkout・setup-nodeをv5に更新しNode.js 20非推奨警告を解消 ([ddae3cb](https://github.com/rmatsuo-jp/study-english/commit/ddae3cbe7c7244471ce131790dcffb22e233b685))
* **drill:** モード選択カードをタップ可能にし達成度を表示 ([f47216f](https://github.com/rmatsuo-jp/study-english/commit/f47216fcb7839a1258dfbfe6d95f817f9d556787))
* **gemini:** Gemini 3 Flashの不正なモデルIDを修正 ([4592d7f](https://github.com/rmatsuo-jp/study-english/commit/4592d7f3956afc617fd6b86536e531e13c0dfc5d))
* **gemini:** 添削解説を項目ごとに独立タグ化し表示崩れを解消 ([6c2df35](https://github.com/rmatsuo-jp/study-english/commit/6c2df35c04c8169029a9602a2d6aef075cfd179a))
* **i18n:** プレースホルダーが複数回出現する翻訳文で置換漏れが起きる不具合を修正 ([a27a9e5](https://github.com/rmatsuo-jp/study-english/commit/a27a9e518dbb3c2277363928725f26615ba245aa))
* **practice:** 一括添削をGemini APIのレート制限(5件/分)に合わせたバッチ処理に変更 ([ca461de](https://github.com/rmatsuo-jp/study-english/commit/ca461de3eb2fe1602c7b65718e366a83ed81e92b))
* **practice:** 待機中クイズと進捗バーをタイトル直下へ移動 ([beac5ac](https://github.com/rmatsuo-jp/study-english/commit/beac5ac554be55a2a7a78f8a4b83c0fce5e77a3f))
* **practice:** 待機中クイズを自動表示・添削完了時に自動終了 ([222ab24](https://github.com/rmatsuo-jp/study-english/commit/222ab243ebb52bff0d2e295b4f97f2d2c3d05bdb))
* **settings:** APIキーヒントの「Google AI Studio」重複表記を解消 ([209080e](https://github.com/rmatsuo-jp/study-english/commit/209080ee586217eb10a2a22ed5699315d7738578))
* **ui:** 言語切り替えボタンのスタイル統一とレイアウト修正 ([cbb768d](https://github.com/rmatsuo-jp/study-english/commit/cbb768dbf655f87f8de64a2ba5091b128f30b749))


### Features

* **session:** 添削に使用したGeminiモデルを記録し添削/履歴タブに表示 ([cd09199](https://github.com/rmatsuo-jp/study-english/commit/cd091997ce614fcc773fe3a60c6139a7b0776a24))

# [0.7.0](https://github.com/rmatsuo-jp/study-english/compare/v0.6.0...v0.7.0) (2026-07-11)


### Bug Fixes

* **gemini:** 添削解説にタグJSONが残留するのを閉じタグ欠落時も防ぐ ([091ae58](https://github.com/rmatsuo-jp/study-english/commit/091ae58cf8bdf19cd02ad8afabf73b2c5b12bd74))
* **layout:** JA/EN言語トグルをモバイルでも表示・PCはサイドバー最下部に移動 ([a951f24](https://github.com/rmatsuo-jp/study-english/commit/a951f2415e283ce0c3f74038a7fac423e737a23b))


### Features

* **drill:** 穴埋め復習に日付選択と進捗バッジを追加 ([f12663e](https://github.com/rmatsuo-jp/study-english/commit/f12663e783d1b3c34de776022180b13ba624c2c1))
* **i18n:** UI表示言語のJA/EN切り替え機能を追加 ([890b2f7](https://github.com/rmatsuo-jp/study-english/commit/890b2f7389862062f26b26843c3088ac6f84d9d6))

# [0.6.0](https://github.com/rmatsuo-jp/study-english/compare/v0.5.2...v0.6.0) (2026-07-11)


### Features

* **gemini:** 添削をストリーミング受信し進捗率を通知する ([7ca6d06](https://github.com/rmatsuo-jp/study-english/commit/7ca6d06feec88bd3b9bb2556219fa9ea25cf1fb3))
* **practice:** 添削待ちの進捗バーと待機中クイズを追加 ([e5a4044](https://github.com/rmatsuo-jp/study-english/commit/e5a40442f2a24424c240ddfe03ca386500491f25))
* **settings:** APIキーの正規化・即時保存と課金同意の再取得 ([f162380](https://github.com/rmatsuo-jp/study-english/commit/f162380b84fa9c6d7a75cd453db0e45827e327a6))

## [0.5.2](https://github.com/rmatsuo-jp/study-english/compare/v0.5.1...v0.5.2) (2026-07-09)


### Bug Fixes

* SW更新監視のinject呼び出しをinjection context内へ修正 ([9831527](https://github.com/rmatsuo-jp/study-english/commit/9831527904f7dddb42b1b72c843a93e45cc96912))

## [0.5.1](https://github.com/rmatsuo-jp/study-english/compare/v0.5.0...v0.5.1) (2026-07-07)


### Bug Fixes

* クラウド同期を許可ユーザーのみのホワイトリスト制に変更 ([6d4cdab](https://github.com/rmatsuo-jp/study-english/commit/6d4cdab1d854cddc52e813e86473a1d184ff764e))

# [0.5.0](https://github.com/rmatsuo-jp/study-english/compare/v0.4.2...v0.5.0) (2026-07-07)


### Bug Fixes

* SW更新チェックの30秒遅延をなくし旧バージョン残存を解消 ([4e3d7be](https://github.com/rmatsuo-jp/study-english/commit/4e3d7beddd80bcd39eae9ff914d59d2e6a6ba1a4))


### Features

* ドリル進捗（習熟度・レベルアップ進捗）をFirestoreに同期 ([3828587](https://github.com/rmatsuo-jp/study-english/commit/38285879b6b6f1414b012dea7e1ee1745634af7d))

## [0.4.2](https://github.com/rmatsuo-jp/study-english/compare/v0.4.1...v0.4.2) (2026-07-07)


### Bug Fixes

* CEFRフォールバック帯域をプロンプトの採点基準と整合させる ([18301ee](https://github.com/rmatsuo-jp/study-english/commit/18301ee088bfa1fc63aa3c5b78d70ae43eb76ce5))
* Firestore同期のundefined除外リストに correctedText/levelUpText/deleted を追加 ([2a0fae6](https://github.com/rmatsuo-jp/study-english/commit/2a0fae648a8822d0c020d38c01ec3c69a4c93e28))
* Gemini APIキーを平文保存からWeb Crypto(AES-GCM)暗号化保存へ移行 ([e0d1eef](https://github.com/rmatsuo-jp/study-english/commit/e0d1eef3c536c124f4f34bd385d588a16d699373))
* 別タブでのセッション変更が現タブに反映されず上書き消失し得る問題を修正 ([059457b](https://github.com/rmatsuo-jp/study-english/commit/059457b670d992461199b65530cc764e650cd88c))

## [0.4.1](https://github.com/rmatsuo-jp/study-english/compare/v0.4.0...v0.4.1) (2026-07-06)


### Bug Fixes

* Geminiセーフティブロック応答を明確なエラーとして扱いフォールバックを中断 ([8c2f191](https://github.com/rmatsuo-jp/study-english/commit/8c2f191a0b509e362d3b3f1b1ab20d53f9c9840f))
* Geminiレスポンスの JSON 抽出で貪欲マッチにより解析失敗するケースを修正 ([9966548](https://github.com/rmatsuo-jp/study-english/commit/9966548028f9b093e677840b365d0b5ce5548204))
* localStorage容量超過時にセッション保存失敗を検知しユーザーへ通知 ([67c91ba](https://github.com/rmatsuo-jp/study-english/commit/67c91baf4f43adc47ffd082bbda4085edb70f994))

# [0.4.0](https://github.com/rmatsuo-jp/study-english/compare/v0.3.0...v0.4.0) (2026-07-06)


### Bug Fixes

* SW更新を自動検知してアクティベート・リロードするよう修正 ([f5bbf1c](https://github.com/rmatsuo-jp/study-english/commit/f5bbf1c22cb11baddc484f877c1c9627c90aefba))
* 添削解説から評価スコア等と重複する見出しを除去 ([03ba60d](https://github.com/rmatsuo-jp/study-english/commit/03ba60dc22ef2f0d4a45e5a872f9a252dabcf018))


### Features

* プライバシーポリシー・利用規約への導線と初回同意モーダルを追加 ([106b13f](https://github.com/rmatsuo-jp/study-english/commit/106b13f813c14ed25a02b692c8f5c7404eadd657))
* 添削後の英文・レベルアップした英文を独立項目として追加 ([5348083](https://github.com/rmatsuo-jp/study-english/commit/5348083217f8bc5dc58f67ac6248e5705eae288e))

# [0.3.0](https://github.com/rmatsuo-jp/study-english/compare/v0.2.0...v0.3.0) (2026-07-05)


### Bug Fixes

* 欠落していたgemini-models.constants.tsを追加しsettings.tsから共用 ([4f12928](https://github.com/rmatsuo-jp/study-english/commit/4f12928cb55edaab70938f9ee21728b6f64f8b44))


### Features

* スコア推移グラフのY軸をデータ範囲に応じて動的にズーム ([6996a7a](https://github.com/rmatsuo-jp/study-english/commit/6996a7af842b879c27c95551148ba7840cece4ea))

# [0.2.0](https://github.com/rmatsuo-jp/study-english/compare/v0.1.0...v0.2.0) (2026-07-05)


### Features

* 履歴タブのカレンダー・リストに総合スコア/CEFRを表示 ([c7acc83](https://github.com/rmatsuo-jp/study-english/commit/c7acc83eb51a077cffe7b3a713849ed8968594e5))
* 本番ビルドでは開発者ページ(/dev)をルートテーブルから除外 ([5aeda3f](https://github.com/rmatsuo-jp/study-english/commit/5aeda3f34947094b3a221e6b310241ac5131ef5b))

# [0.1.0](https://github.com/rmatsuo-jp/study-english/compare/v0.0.0...v0.1.0) (2026-07-05)


### Bug Fixes

* レベルアップ・タイピングの次へボタンが別の文に遷移するバグを修正 ([6f38ad6](https://github.com/rmatsuo-jp/study-english/commit/6f38ad6fe7b4e94dcfcd63593724672ba0b88925))
* 履歴カレンダーの表示崩れ解消とスマホのタップ・スクロール性を改善 ([f53fea0](https://github.com/rmatsuo-jp/study-english/commit/f53fea0c2b4518b7a9e0465d749fc251ace3faf2))


### Features

* PCレイアウトにサイドバー格納/展開機能を追加 ([acaadd7](https://github.com/rmatsuo-jp/study-english/commit/acaadd755c82f7e52babcb6a5170b8fae0178e3e))
* アプリ名称を「英作文ラボ」に統一 ([9e6d2d2](https://github.com/rmatsuo-jp/study-english/commit/9e6d2d2bc540b13ba3d2d690a1863df6f9e9ddd3))
* キーボード操作でのアクセシビリティを改善 ([27a745d](https://github.com/rmatsuo-jp/study-english/commit/27a745dacdd0475e514d80de4a9d6d970703327b))
* サイドバーにアプリタイトルを追加しクリックで添削タブへ遷移 ([11840e3](https://github.com/rmatsuo-jp/study-english/commit/11840e3c13374c75b9bc0e2d10a400122730c9cd))
* タブ名とページ見出しを統一 ([028748a](https://github.com/rmatsuo-jp/study-english/commit/028748a3498710580504de5014e566e96ad11b6b))
* レベルアップ・タイピングで習熟達成時に文一覧へ遷移するように ([a24bc3f](https://github.com/rmatsuo-jp/study-english/commit/a24bc3f6fbd82fd5e59aa97876461a7c223fcb7f))
* レベルアップ・タイピングの日付/文単位の進捗を永続化 ([8439216](https://github.com/rmatsuo-jp/study-english/commit/8439216d2240a0e561b15f7cce6f3fd437cc40a2))
* レベルアップ・タイピングを段階的マスキング方式に刷新し文単位で選択・再開できるように ([29ea417](https://github.com/rmatsuo-jp/study-english/commit/29ea41767f36bb03e2029090d707256699ddce19))
* 穴埋め復習の4択をキーボード(1-4,Enter)で回答できるように ([4d0b29d](https://github.com/rmatsuo-jp/study-english/commit/4d0b29d27c8505059bad7cd91e8ab81b829364fb))
