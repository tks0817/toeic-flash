# TOEIC Flash v8 — Photo-first private study edition

## What works now
- **Photo → iOS Live Text → paste → candidate words → manually verify translations → save flashcards**. On iPhone 13, open the textbook image in Photos, select/copy English text using Apple's Live Text, return to TOEIC Flash and tap the new clipboard import button. If clipboard permissions block it, expand the manual paste area and paste there. This uses iOS built-in recognition and does not transmit the photo to this web app.
- Flashcards, progress, study timer, local semantic illustrations and AES-GCM encrypted backup retained.
- Existing IndexedDB database name and storage keys unchanged. Import merges rather than deletes.
- No external CDN or analytics. CSP only allows same-origin requests.

## Not yet available
- Fully automatic image OCR from the app and scanned-PDF OCR require locally bundled and audited OCR engines and language files. These assets are **NOT included**. Do not claim that the photo OCR button works.
- Thousands of meaning-accurate AI-generated images are **NOT included**; existing lightweight local mnemonic drawings remain.
- No iPhone 13 device testing has been performed.

## Before updating
1. In current working app export encrypted backup and securely store password.
2. Upload this release to the SAME GitHub Pages origin/path so IndexedDB can be reused; do not clear Safari website data.
3. Verify word counts, study progress, and backup restoration before unpublishing.
4. Once Pages is unpublished, PWA caching is NOT guaranteed to survive iOS eviction or device replacement. Plan a private install/recovery route first.

## Privacy and copyright
Only process photos of materials you are legally allowed to reproduce. Do not commit textbook scans, extracted copyrighted pages, personal details, or backups to public GitHub. This app cannot guarantee legal compliance or zero risk. Apple Live Text behavior is controlled by iOS and its settings.
