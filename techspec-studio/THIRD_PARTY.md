# Third-party assets

Browser libraries are vendored under `dist/assets/` so file parsing does not depend on a CDN at runtime. Bundles retain their upstream notices.

| Library | Version | License | Upstream |
| --- | --- | --- | --- |
| JSZip | 3.10.1 | MIT or GPL-3.0 (used under MIT) | https://github.com/Stuk/jszip |
| Mammoth | 1.9.0 | BSD-2-Clause | https://github.com/mwilliamson/mammoth.js |
| PDF.js | 3.11.174 | Apache-2.0 | https://github.com/mozilla/pdf.js |
| Mermaid | 12.2.0 | MIT | https://github.com/mermaid-js/mermaid |
| Marked | 12.0.2 | MIT | https://github.com/markedjs/marked |
| DOMPurify | 3.2.6 | Apache-2.0 or MPL-2.0 (used under Apache-2.0) | https://github.com/cure53/DOMPurify |

DM Sans and Noto Sans SC are requested from Google Fonts when available, under the SIL Open Font License. System fonts are used when unavailable. Icons are inline SVG paths authored for this application.

JSDOM and fake-indexeddb are development-only test dependencies; they are not part of the deployed website. Their licenses are retained in installed packages.