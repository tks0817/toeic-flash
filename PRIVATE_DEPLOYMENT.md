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


v81: 単語ファイル（フォルダー）の作成・名前変更・選択単語の移動・ファイル別学習・暗号化バックアップへのファイル情報同梱に対応。
