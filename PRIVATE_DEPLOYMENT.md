# TOEIC Flash: private-use deployment guide (iPhone 13)

## First protect existing cards
1. Open the CURRENT Pages URL in the same Safari / Home Screen context you have been using.
2. Export an encrypted backup and store it safely in Files. Verify the file exists and you remember the password.
3. Do NOT delete Safari website data, the home screen web app, or the original Pages site until a restore has been tested.

## Important: GitHub Pages is not an access-control mechanism
A public Pages URL is reachable by others. Making the repository private does not necessarily remove the published website. To unpublish: GitHub repository > Settings > Pages > Unpublish site (if available), or disable the publishing source, then verify the old URL is inaccessible in a private Safari tab. Check Actions and any custom domain too. If necessary delete the Pages deployment via GitHub's UI. Repository visibility and Pages visibility are separate controls.

## Offline PWA warning
A home screen app installed from Pages can continue to use a previously cached app shell while offline, but the iPhone can evict caches, the origin may be invalidated, and reinstalling won't work after unpublishing. Do not rely on an unpublished Pages PWA as a durable private installation. No guarantee that it will keep working after Pages is disabled.

## Better private-only deployment
For a durable private app, use an iOS app container distributed privately using a supported Apple signing/distribution path, or use a locally saved offline HTML bundle with a suitable iPhone app that can run it. Neither is supplied by this ZIP. A private GitHub repository alone is not a private hosting solution for iPhone web apps.

## Offline OCR assets
This ZIP does not include the required third-party OCR/PDF/WASM/language assets; OCR and PDF import are intentionally unavailable until those assets are packaged and tested. See README.md. Don't overwrite your working v5 unless you accept that limitation.

## Legal
Personal study with lawfully acquired materials may fall under private-copying exceptions, but copyright exceptions are conditional. Never commit scans, textbook excerpts, imported cards, backup files or passwords to a public repository. Check third-party software and model licenses before redistribution. A private app reduces exposure, but cannot guarantee zero legal risk.


v88: 単語ファイル（フォルダー）の作成・名前変更・選択単語の移動・ファイル別学習・暗号化バックアップへのファイル情報同梱に対応。


v88: コピーした英文の候補登録時、IndexedDBへ変更のあった単語だけを保存するよう改善。保存失敗時には候補を残し、エラー種別を表示。単語を追加した場合は選択中のファイルへ分類。端末実機での検証は未実施。


v88: 新規フォルダー作成後は全単語を表示し、新規フォルダーを移動先に指定。空フォルダーから全単語一覧へ戻る操作を追加。検索条件も解除。


v88: 単語一覧で番号範囲（1〜60など）を一括選択し、選択した単語を既存のフォルダー移動機能で移動可能。番号は全単語の並び順に基づく。
\n\nv88: 自動再生は手動カード読み上げ設定と独立して英語・日本語を読み上げ、終了イベントを待機。iOSでの音声キュー再登録と停止操作を修正。\n

v88: 間隔反復（正解で1・3・7・14・30・60・90日、誤答は即復習）、今日の復習フィルター、次回復習日、期限到来件数を追加。正誤リセットで復習予定もリセット。\n

v88: 正誤判定を復習予定に連動し、今日の復習フィルターと復習対象件数を有効化。30日1800語計画に当日の作成数・学習数・復習対象・残日数による目標再計算を追加。


v88: 手動学習スタートボタンを追加。ユーザーのタップで最初の英単語を即時発音し、以後の手動遷移も既存の自動発音設定に従う。
