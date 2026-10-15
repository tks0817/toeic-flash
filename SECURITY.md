# Security status (v6)
- No third-party runtime CDN; CSP same-origin only.
- Offline OCR dependencies **missing** from this distribution; OCR fails closed.
- Device-only local storage is not encryption at rest. Backup remains password-encrypted.
- SVG memory aids are procedural and category-based, not an AI image model.
- GitHub Pages publicly serves source code and records standard requests.
- Dependencies and licenses require verification before distribution.
- iPhone Safari offline and migration testing remain outstanding.


### v8 photo workflow
The recommended workflow performs OCR using iOS Photos Live Text outside the web app and pastes text locally. The app does not request or upload the photo for this workflow. Clipboard content is read only on user click; text is displayed as editable candidates and saved only after confirmation. iOS/Apple system behavior is outside the web app audit scope.
