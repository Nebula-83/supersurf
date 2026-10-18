# ClearView

ClearView is a polished Chrome Manifest V3 prototype for the OmniRush Agentic Buildathon 2026. It keeps pages usable without collecting browsing history: dismiss conservative non-essential overlays, mark obvious broken links in yellow, surface likely download controls, reduce visual noise with Focus mode, and show local page-health signals.

## Product promise and boundaries

This is an assistive web navigator, not an access-control bypass. It never disables an ad blocker, defeats a CAPTCHA, skips a paywall, removes a security warning, submits forms, starts downloads, or changes server-side timers. A page may still require its own 15-second server-controlled wait. The diagnostics label what the browser can observe and cannot prove an ISP or server fault.

The Google feature is intentionally explicit: select text and choose **Search ClearView selection with Google** from the context menu. It opens Google in a new tab; no private AI endpoint or API key is required.

## Features

- **Safe popup dismissal:** clicks only recognizable close/dismiss controls on likely overlays; leaves login, payment and security dialogs alone.
- **Broken-link markers:** yellow wavy underline for empty, malformed, unsupported, or missing same-page targets. Cross-origin links are marked “needs a network check” rather than falsely declared broken.
- **Download spotlight:** green outline for likely download/export actions based on accessible text, attributes and file extensions; it never clicks them.
- **Focus mode:** reversible, namespaced CSS reduces motion and visual distractions; toggle in the popup or with `Alt+Shift+F`.
- **Page health:** observed resource counts, slow resources and possible failures, clearly labelled as heuristics.
- **Settings page:** privacy promise, safety notes and next-version ideas.

## Build and test

Requirements: Node **20.18.0** (see `.nvmrc`) and npm. Dependencies are intentionally zero so the checks work offline.

```bash
npm ci
npm test
npm run build
# or
make check
```

`npm run build` creates `dist/`, a clean unpacked extension copy. The Docker build runs the same offline checks:

```bash
```

## Try it in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the repository's `dist/` folder.
3. Open a normal `http://` or `https://` page, click the ClearView toolbar icon, and toggle tools. Chrome internal pages and the Web Store are intentionally unsupported.
4. Reload the page after changing the extension during development.

## Publish to Chrome Web Store

1. Create a developer account at the Chrome Web Store Developer Dashboard and complete the one-time registration fee/verification if requested.
2. Run `npm run build`; zip the **contents** of `dist/` so `manifest.json` is at the zip root: `cd dist && zip -r ../clearview-1.0.0.zip .`.
3. In the dashboard choose **New item**, upload the zip, and complete the store listing, screenshots, icon, support URL and privacy disclosures.
4. Explain the narrow permissions (`storage`, `activeTab`, `scripting`, `contextMenus`) and state that no browsing data is collected. Do not claim it bypasses timers or ad-block detection.
5. Test the uploaded artifact, complete the privacy practices tab, and submit for review. Keep the source, lockfile, Dockerfile and checks in GitHub for judges and reproducibility; upload only the built zip to the store.

## Hackathon repository checklist

Commit `manifest.json`, source under `src/`, tests, `package-lock.json`, `.nvmrc`, `Dockerfile`, `Makefile`, `README.md` and the icon. Do not commit `.env` files, tokens, Chrome profiles, generated `dist/` output, or private user data. Suggested demo: show a noisy fixture page, toggle Focus mode, point out yellow broken-link and green download annotations, then run the page-health panel and use the selection context menu.

## Next version ideas

Per-site rules with a review queue, keyboard-accessible overlay summaries, multilingual heuristics, a local history of diagnostics, optional on-device text explanations, and a browser-side “why this was highlighted?” inspector would add value without requiring a data-collecting backend.
