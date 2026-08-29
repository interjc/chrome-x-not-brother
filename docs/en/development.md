# Development

[简体中文](../development.md) · **English**

## Prerequisites

- Google Chrome 116+;
- nvm;
- Node 24.19.0 from `.nvmrc`;
- npm.

Non-interactive shells may resolve the old system Node 8. Load nvm explicitly before any Node command:

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
node --version
npm install
```

Do not replace nvm with a system-wide Node.

Python on this machine is managed through pyenv. The repository currently has no Python runtime dependency and does not pin `.python-version`. If a maintenance helper truly needs Python, make sure the pyenv-selected interpreter is available and run it through `pyenv exec python`. Do not silently fall back to system or Framework Python.

## Daily loop

```bash
npm run dev
```

The first time, enable Developer mode on `chrome://extensions`, choose **Load unpacked**, and load `dist/`. Rebuilds update `dist/`; you still click reload on the extension card.

For local acceptance, open the Side Panel from the extension icon, review the first-run data disclosure and consent, then refresh any open X tabs. To retest first-run consent cleanly, export data you want to keep, remove the unpacked extension, and Load unpacked again. Removing the extension deletes local data for that extension origin.

## Where changes go

- X page structure or copy: `src/content/x-adapter.ts` and matching fixture tests. For threads packed with in-post @mentions, change only the adapter/badge path; do not `cloneNode` a whole tweet to strip `tweetText`.
- Already-loaded page UI store / tweet fiber relationship fields: `src/content/page-store.ts`, `src/content/page-bridge.ts`.
- DOM triggers, 2-second fallback rescan, single-flight scheduling, and post-success signature deduplication: `src/content/index.ts`, `src/content/periodic-rescan.ts`, `src/content/process-scheduler.ts`, `src/content/observation-signatures.ts`.
- Relationship rules: `src/domain/relationships.ts`.
- Runtime translation, relationship presentation, and locale normalization: `src/i18n/index.ts`.
- Chrome manifest localization: `public/_locales/en|ja|zh_CN/messages.json`.
- Data structures and migrations: `src/storage/database.ts`.
- Injected badges: `src/content/badge.ts`, `public/content-script.css`.
- X-page observer dock: `src/content/observer-panel.ts`, `public/content-script.css`. The collapsed ball stays in the bottom-right corner; Chat/Grok shift selectors live in `x-adapter.ts`. After consent, expanded-dock filter-rule status uses `filter-rules:status`, intercept totals use `hide-stats:increment`, and Edit rules opens the side panel Rules tab.
- Toolbar state and install guidance: `src/background/action-state.ts`, `src/background/service-worker.ts`.
- Side Panel: `src/ui/sidepanel.tsx`.
- Fieldbook: `src/ui/dashboard.tsx`.
- Chrome Options page: `src/ui/options.tsx`, `src/ui/open-options-tab.ts`, `public/options.html`. Right-click **Options** should open the side panel Options tab.
- Optional timeline hiding: `src/content/timeline-hide.ts`, `public/content-script.css`.
- Timeline quick-add rules: `src/content/quick-rules.ts`. The HoverCard entry sits next to the name; the tweet `caret` menu can also add a handle rule. Saves go through service worker `filter-rules:quick-add`.
- Visual tokens: `src/ui/styles.css`.
- Brand source art and Chrome icons: `assets/branding/`, `public/icons/`.
- Permissions: `public/manifest.json`, plus validation and privacy docs.

When you add or change user-visible copy, complete the `en`, `ja`, and `zh-CN` catalogs in `src/i18n/index.ts` together. When the extension name, short description, or default toolbar title changes, also update all three `_locales` directories. `npm run typecheck` and `npm run validate:dist` check runtime catalog completeness and Manifest catalog completeness respectively.

## Full checks

```bash
npm run check
npm run test:coverage
npm run build
npm run validate:dist
npm run skills:validate
```

Use `npm run release` when preparing a Store update package. It checks, packages, and writes the uploadable ZIP to `artifacts/` (only the current version is kept). Bump versions with `npm run version:bump -- patch`. Details are in [Release](release.md).

When creating or substantially changing a project skill, also run the upstream `skill-creator` `quick_validate.py` once. That script needs Python and PyYAML. Routine repository checks use `npm run skills:validate`, which has no extra Python dependency.

Do not add page automation, private APIs, or broad Chrome permissions for convenience. Feature suggestions that leave annotation, collection, and optional display filters must be reconfirmed with the user.

Issue and pull-request process: [Contributing](contributing.md). Full documentation index: [docs/en/README.md](README.md). User feedback: [GitHub Issues](https://github.com/interjc/chrome-x-not-brother/issues).
