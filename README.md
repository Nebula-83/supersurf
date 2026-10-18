# ClearView

ClearView is a Chrome extension for calmer, more understandable web pages. It can reduce distracting overlays, point out likely broken links, highlight likely download actions, and add a reversible Focus mode. All of these features are designed to be cautious and explainable.

## Install

### From a GitHub Release

1. Download the latest `clearview-v*.zip` from the repository's **Releases** page.
2. Unzip it into a folder you can keep on your computer. The folder must contain `manifest.json` at its top level.
3. Open `chrome://extensions` in Chrome and turn on **Developer mode**.
4. Choose **Load unpacked** and select the unzipped ClearView folder.
5. Pin ClearView from Chrome's extensions menu if you want quick access to its home popup.

Chrome may disable an unpacked extension when its folder is moved or deleted. Keep the folder in place while using it.

### Build from this repository

Requirements: Node **20.18.0** or a compatible newer Node release (the pinned version is in `.nvmrc`) and npm.

```bash
npm ci
npm test
npm run build
```

The build creates an unpacked extension in `dist/` and a release-ready archive at `dist/clearview-v1.1.0.zip`. The archive has `manifest.json` at its root and does not contain a copy of itself.

## Use ClearView

Click the ClearView toolbar icon to open the home popup. Its controls are saved on this device:

- **Dismiss safe popups** closes only ad-focused overlays. Sign-in, payment, consent and security dialogs are left alone.
- **Mark broken links** underlines links that have obvious local problems. A cross-site link may still need a network check.
- **Surface download buttons** highlights likely download or export actions without clicking them.
- **Focus mode** reduces motion and visual distractions around the main reading area. `Alt+Shift+F` is also available as a shortcut.
- **Phishing and malware alerts** shows local heuristic warnings. These warnings are signals to review, not security verdicts.

Open **More settings and safety notes** for the full preferences page. There you can choose regular notice placement (top-right or top-left) and the Focus outline color (gold, blue or green). Selection-search confirmations always remain in the bottom-right corner.

To search selected text, select it on a normal web page, open the context menu, and choose the single ClearView selection-search item. A Google results tab opens only after that action.

Chrome-managed pages and the Chrome Web Store do not allow ClearView's page tools.

## Safety and privacy

ClearView processes its page observations locally. It does not collect browsing history, use analytics, load remote scripts, set cookies, upload page contents, or call a private AI service. Diagnostics describe browser-visible signals and cannot prove an ISP, server, phishing or malware condition.

ClearView does not bypass paywalls, CAPTCHAs, security warnings, consent choices, access controls or server-controlled waits. It never submits forms, starts downloads, or changes a page's security settings.

## Remove ClearView

Open **More settings and safety notes**, scroll to **Remove ClearView**, and choose **Remove ClearView**. Chrome requires you to confirm the removal in its extensions manager, so ClearView opens `chrome://extensions` for that confirmation instead of removing itself silently.

## Test and release

Run the same checks used for a release from the repository root:

```bash
npm ci
npm test
npm run build
```

`npm test` runs the offline test suite. `npm run build` recreates `dist/`, copies the extension files, and creates `dist/clearview-v1.1.0.zip`. To publish a GitHub Release, upload that zip as a release asset and include its version in the release title. Users should unzip the asset before choosing **Load unpacked** in Chrome.
