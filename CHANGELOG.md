# [1.2.0](https://github.com/rmatsuo-jp/eibun-lab/compare/v1.1.0...v1.2.0) (2026-07-19)


### Bug Fixes

* ドリル画面のモードタイトル・戻るボタンの表示崩れと配置不統一を修正 ([1698123](https://github.com/rmatsuo-jp/eibun-lab/commit/16981235be68f11fafbfe2f8d7258ab43fd43f98))
* 学習法セクションの最優先課題と学習時間の目安が改行なしに連結される不具合を修正 ([6c05fad](https://github.com/rmatsuo-jp/eibun-lab/commit/6c05fadf73123c2a5d54313cfbb9161eb92f49d4))
* 実績統計の同期でlastActiveDate未設定時にFirestore書き込みが失敗する不具合を修正 ([ad56591](https://github.com/rmatsuo-jp/eibun-lab/commit/ad56591db842c0569cfb39e29a17569a643c981c))
* 穴あきタイピングでパーフェクト達成数が加算されない不具合を修正 ([4bb2668](https://github.com/rmatsuo-jp/eibun-lab/commit/4bb266833816f10f499698cbc7d9d58b55034712))
* 穴埋めクイズのヒントボタンと選択肢の間隔を調整 ([c658310](https://github.com/rmatsuo-jp/eibun-lab/commit/c6583103e7cf31a3cabd28f6076c2fd843f872ce))


### Features

* ドリルにパーフェクト達成数バッジを追加 ([013cf82](https://github.com/rmatsuo-jp/eibun-lab/commit/013cf822a2e0b1663b25a2d6e758f14b8714fa15))
* 実績タブに全体の解除進捗バーを追加 ([097db89](https://github.com/rmatsuo-jp/eibun-lab/commit/097db89fc29666d6920f4fc5f33140c8d92d762c))
* 新バージョンのリリースノートを起動時に自動表示 ([f16e1c3](https://github.com/rmatsuo-jp/eibun-lab/commit/f16e1c333167116dce2630fce012ca95b45de132))
* 穴埋めクイズの4択に選択肢ごとの正誤理由を追加 ([cfa8963](https://github.com/rmatsuo-jp/eibun-lab/commit/cfa89636502df2cbe73bbd84b16117d727bb131a))
* 設定タブにGitHubリポジトリへのリンクを追加 ([27c62ca](https://github.com/rmatsuo-jp/eibun-lab/commit/27c62ca444eff02abe774adc0be7bf647699d9f2))
* 設定ページで過去のリリースノートを閲覧できるようにする ([1199613](https://github.com/rmatsuo-jp/eibun-lab/commit/1199613c9f45c80235741d7512aa36cc37e828e8))

# [1.1.0](https://github.com/rmatsuo-jp/eibun-lab/compare/v1.0.4...v1.1.0) (2026-07-16)


### Bug Fixes

* prettierフォーマット崩れを修正しCI失敗を解消 ([aa65e07](https://github.com/rmatsuo-jp/eibun-lab/commit/aa65e07450d8587e4a13faf837dc359d132baa9e))
* スマートフォンでのピンチズームを無効化 ([bf68c79](https://github.com/rmatsuo-jp/eibun-lab/commit/bf68c7919662e596e2889c251adfce74a7213032))
* ドリルのモード名称を統一し選択カードに番号バッジを追加 ([10c58d4](https://github.com/rmatsuo-jp/eibun-lab/commit/10c58d47f037647370125c69ddf492327e0fe7ca))
* ドリル全問終了後の戻り先をモード選択から日付選択に変更 ([e8ce302](https://github.com/rmatsuo-jp/eibun-lab/commit/e8ce30250cc51c58d8fb6a0bfad89eb1760f5ede))
* ドリル日付選択画面の戻るボタンを上部左側に固定 ([a453bed](https://github.com/rmatsuo-jp/eibun-lab/commit/a453bed5a012076d7f11dd27df6f9bf0fdf36dcf))
* 履歴カレンダーの月移動ボタンを専用スタイルに変更 ([5094897](https://github.com/rmatsuo-jp/eibun-lab/commit/5094897f6db615005cab147aba71bc3316a87c68))
* 穴埋め復習の達成バッジが1回正解しても増えない不具合を修正 ([87513e8](https://github.com/rmatsuo-jp/eibun-lab/commit/87513e856ed8079aefbd0f1b7f777cfb9819f589))


### Features

* ドリル・添削にゲーミフィケーション（統計・実績）を追加 ([80b1a4a](https://github.com/rmatsuo-jp/eibun-lab/commit/80b1a4afad18aef770d0b3201f73e156af2133b8))
* 実績の未解除項目に進捗バーを表示 ([aae7166](https://github.com/rmatsuo-jp/eibun-lab/commit/aae716606fbf1d3b5c0e60850cf1d498c03357e4))
* 添削タブにテーマのヒント提案機能を追加 ([e65a35e](https://github.com/rmatsuo-jp/eibun-lab/commit/e65a35eb84bc48708dddbee7c028649376378e62))

## [1.0.4](https://github.com/rmatsuo-jp/eibun-lab/compare/v1.0.3...v1.0.4) (2026-07-12)


### Bug Fixes

* スマートフォンでのピンチズームを無効化 ([#48](https://github.com/rmatsuo-jp/eibun-lab/issues/48)) ([586ab24](https://github.com/rmatsuo-jp/eibun-lab/commit/586ab241f255a272d6bb5f5d38e9d620dc35b502))

## [1.0.3](https://github.com/rmatsuo-jp/eibun-lab/compare/v1.0.2...v1.0.3) (2026-07-12)


### Bug Fixes

* 2回目のpull-to-refreshが効かずボトムナビが隠れる不具合を修正 ([b0e6b4a](https://github.com/rmatsuo-jp/eibun-lab/commit/b0e6b4a05f2404af7c544ae358b625f202929aa4))

## [1.0.2](https://github.com/rmatsuo-jp/eibun-lab/compare/v1.0.1...v1.0.2) (2026-07-11)


### Bug Fixes

* CIのみauth.service.spec.tsが失敗するテスト分離バグを修正 ([de60d27](https://github.com/rmatsuo-jp/eibun-lab/commit/de60d27593f5a8c0233863bb90a66f3eecf959e0))
* Firestore push失敗時にオンライン復帰で自動リトライ ([94af053](https://github.com/rmatsuo-jp/eibun-lab/commit/94af053ca4af8fe99137d12719b0c5ba5c0be4a8))
* optionalフィールドの型導出によりOPTIONAL_FIELDSの追加漏れをコンパイルエラー化 ([6ee6cc8](https://github.com/rmatsuo-jp/eibun-lab/commit/6ee6cc85d0c484aa28f5887233b20cab84248bdc))

## [1.0.1](https://github.com/rmatsuo-jp/eibun-lab/compare/v1.0.0...v1.0.1) (2026-07-11)


### Bug Fixes

* 非対応環境でもAPIキーを平文でlocalStorageに保存しない ([5116481](https://github.com/rmatsuo-jp/eibun-lab/commit/51164812fed09bfedb33eb4b1444fcb4c91937ae))

# [1.0.0](https://github.com/rmatsuo-jp/eibun-lab/compare/v0.10.2...v1.0.0) (2026-07-11)


* feat!: Firebaseプロジェクトを英文ラボ専用に作り直す ([6de6d64](https://github.com/rmatsuo-jp/eibun-lab/commit/6de6d64af46c06dc347d7117ea0ba40116c7bdfc))


### Bug Fixes

* 1.0.0前の主要CI/CDリスクを解消 ([f85ae48](https://github.com/rmatsuo-jp/eibun-lab/commit/f85ae488466247ab0335fa11cbd41b90b2cd51a6))
* **settings:** APIキー入力欄でパスワードマネージャーの保存提案を抑止 ([1461d9d](https://github.com/rmatsuo-jp/eibun-lab/commit/1461d9de88ae99feb5f601f931e4ef9ca5a2ff50))


### Features

* 1.0.0前の懸念点を解消(テスト追加・同期失敗通知・告知) ([6fecb15](https://github.com/rmatsuo-jp/eibun-lab/commit/6fecb15c345c5fef6e687d50820e4b1a65ed55fd))
* **logo:** ロゴを円形＋A＋添削チェックのシンプルデザインに刷新 ([434ae56](https://github.com/rmatsuo-jp/eibun-lab/commit/434ae5691ff1d633c6b12bb70e48eeb4c6bce9dd))
* lunch-picker の Firestore ルールを追加 ([279cc8e](https://github.com/rmatsuo-jp/eibun-lab/commit/279cc8e9247addc3b1102cc1a8a47f72be36a0aa))


### BREAKING CHANGES

* Firebaseプロジェクトが変更されるため、旧プロジェクトの
Firestoreデータ（学習セッション履歴・ドリル進捗）は引き継がれない。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

## [0.10.2](https://github.com/rmatsuo-jp/study-english/compare/v0.10.1...v0.10.2) (2026-07-11)


### Bug Fixes

* **ui:** ドリルタブのカード幅を他タブと統一 ([9d443ac](https://github.com/rmatsuo-jp/study-english/commit/9d443ace88c948fd30474b67f6f66ecb1b921854))
* **ui:** モバイルの言語トグルとフィードバックボタンの重なりを解消 ([f552231](https://github.com/rmatsuo-jp/study-english/commit/f55223189faf37e38b8fbca1b2c94ab3e2ac0feb))
* **ui:** 一括添削ボタンの文言をスマホ表示向けに簡潔化 ([7bd24b2](https://github.com/rmatsuo-jp/study-english/commit/7bd24b211040d7a419a1a0b3a4e0175cb50f7198))

## [0.10.1](https://github.com/rmatsuo-jp/study-english/compare/v0.10.0...v0.10.1) (2026-07-11)


### Bug Fixes

* **ui:** サイドバー言語トグルの表記と格納時の表示を改善 ([7464b79](https://github.com/rmatsuo-jp/study-english/commit/7464b791f49e98daf19bb787a4165e79f8bb673f))
* **ui:** 設定画面のバージョン表記を「バージョン」から「Ver」に変更 ([490267b](https://github.com/rmatsuo-jp/study-english/commit/490267beaf4f9c8a9786a93215ef57feedb223ec))

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
