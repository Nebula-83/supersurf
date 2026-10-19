# SuperSurf

SuperSurf is a privacy-first Chrome extension for calmer, more understandable web pages. It keeps the useful parts of everyday browsing visible without taking actions on your behalf.

## What SuperSurf does

- **Dismiss safe popups** closes ad-focused overlays only. Sign-in, payment, consent and security dialogs stay untouched.
- **Mark broken links** marks obvious local problems such as missing, empty or unsupported destinations. A link that needs a network request is not treated as broken.
- **Highlight likely downloads** makes likely file and export actions easier to spot without clicking them or starting a download.
- **Focus mode** reduces visual distractions around the main reading area and can be turned off at any time. `Alt+Shift+F` toggles it.
- **Page health check** reports browser-visible timing and resource signals locally. It is an observation, not a definitive diagnosis.
- **Explicit selected-text search** adds one context-menu action that opens a Google search only when you choose it. A confirmation for that action appears in the bottom-right corner; regular notices can be placed at the top-right or top-left.

Settings are stored in Chrome's local extension storage on this device. SuperSurf does not collect browsing history, use analytics, load remote scripts, set cookies or upload page contents.

## Install on Chrome

GitHub cannot auto-install Chrome extensions. **Load unpacked is required** for this project; a GitHub download is not a one-click Chrome installation.

1. Download `supersurf-v1.2.0.zip` from the repository's **Releases** page.
2. Unzip it into a folder you want to keep. `manifest.json` must be directly inside that folder.
3. Open `chrome://extensions` in Chrome and turn on **Developer mode**.
4. Choose **Load unpacked** and select the unzipped SuperSurf folder.
5. Pin SuperSurf from Chrome's extensions menu for quick access.

Keep the folder in place while using the extension. Chrome may disable an unpacked extension when its folder is moved or deleted.

## Use and customize

Click the SuperSurf toolbar icon to open the controls. Changes are saved locally and can be reversed at any time. Open **More settings and safety notes** to choose regular notice placement, customize the Focus outline color (gold, blue or green), read the privacy notes and use the removal flow.

To search selected text, select text on a normal web page, open the context menu and choose **Search selected text with Google**. SuperSurf opens the results only after that explicit choice.

Chrome-managed pages and the Chrome Web Store do not allow SuperSurf's page tools.

## Remove SuperSurf

Open **More settings and safety notes**, scroll to **Remove SuperSurf** and choose **Remove SuperSurf**. SuperSurf opens `chrome://extensions`, where Chrome asks you to confirm removal.

## Hackathon submission

SuperSurf is a Manifest V3 extension focused on small, reversible improvements to web comprehension: safer ad-only popup dismissal, obvious link and download cues, a reversible reading mode, a local page health check and an explicit Google search action. The interface explains what each control does and keeps page observations on the device.

### Limitations

- SuperSurf only runs on regular `http://` and `https://` pages where Chrome permits content extensions.
- Link and download markers use explainable browser-visible signals; they cannot prove that a remote destination exists or that an action is safe.
- Focus mode changes presentation and can be disabled immediately; it does not remove page content or bypass access controls.
- SuperSurf never submits forms, starts downloads automatically or changes browser security settings.

## Build a release locally

Requirements: Node **20.18.0** and npm. The pinned Node version is in `.nvmrc`.

```bash
npm ci
npm test
npm run build
```

The build recreates `dist/` and creates `dist/supersurf-v1.2.0.zip`. The archive has `manifest.json` at its root and does not contain a nested copy of itself. To publish a GitHub Release, upload that archive and tell users to unzip it before choosing **Load unpacked**.
