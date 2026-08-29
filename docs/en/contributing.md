# Contributing

[简体中文](../contributing.md) · **English**

Not Brother is open source. Source, issues, and release notes live at [interjc/chrome-x-not-brother](https://github.com/interjc/chrome-x-not-brother).

- Feedback and support: [GitHub Issues](https://github.com/interjc/chrome-x-not-brother/issues)
- Development loop: [Development](development.md)
- Manual acceptance: [Testing](testing.md)
- Agent or automated changes must also follow root [AGENTS.md](../../AGENTS.md)

## Product boundary

By default the extension does two things:

1. annotate confirmable relationships for users already visible on `x.com`;
2. store those observations in the extension's own local database.

Timeline display filters can be turned on in Options. Do not submit code that auto-scrolls X, opens or prefetches profiles, calls private X endpoints or intercepts the network, or clicks Follow, Unfollow, Block, Mute, or other account-action controls. Reading relationship fields already loaded into the current page UI store for visible authors is allowed. A standard X profile link may open only after an explicit click or keyboard activation.

Missing evidence must stay internal `unknown`: no badge, no persistence, no import/export, no counting, and no inferred negative relationship from an unrelated timeline card. A known relationship may replace another known relationship; `unknown` must not overwrite a known record.

## Reporting issues

Open a new issue on [Issues](https://github.com/interjc/chrome-x-not-brother/issues) after searching for an existing report.

Bug reports should include:

- extension version (fieldbook footer or `manifest.json`) and Chrome version;
- Chrome UI language, X page language, and the X surface at the time (Home, thread, profile, list, and so on);
- actual versus expected result;
- whether it reproduces reliably.

Do not paste account passwords, cookies, real relationship data from an export backup, or other people's avatars and source URLs. For screenshots, use fictional or authorized test accounts and hide unrelated personal information.

Feature requests must still sit inside annotation, local collection, and optional display filters. If a suggestion needs account actions, site-wide crawling, X APIs, remote sync, or telemetry, explain first why that does not cross the product boundary. Those changes are not accepted as routine patches.

## Development environment

Node.js is managed through nvm. The version in `.nvmrc` is authoritative (currently `24.19.0`). Non-interactive shells may resolve an old system Node. Load nvm before any `npm` command:

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm install
```

Do not replace nvm with a system-wide Node. The repository currently has no Python runtime dependency.

Daily loop:

```bash
npm run dev
```

On `chrome://extensions`, enable Developer mode, **Load unpacked**, and select the repository `dist/`. After a rebuild, click **Reload** on the extension card, then refresh any X tabs that are already open.

## Where to change things

| Change | Location |
| --- | --- |
| X selectors or localized relationship evidence text | only `src/content/x-adapter.ts` and matching fixtures |
| Scan scheduling, rescan, signature deduplication | `src/content/` |
| Relationship rules and import/export | `src/domain/` |
| Runtime zh/en/ja copy | all three catalogs in `src/i18n/index.ts` together |
| Manifest name or summary | `public/_locales/en`, `ja`, `zh_CN` |
| Storage and settings | `src/storage/` |
| Side Panel / fieldbook | `src/ui/` |
| Permissions | `public/manifest.json`, plus validation scripts and privacy docs |

Every user-visible string must go through `src/i18n/`, with complete English, Japanese, and Simplified Chinese catalogs. Extension pages default to the Chrome UI language and may be overridden from the Side Panel / fieldbook language switcher. Badges and the dock injected into X follow that override, or the page language when the preference is `auto`. Inject UI with DOM APIs and text content. Do not insert HTML strings into X. All runtime code must be bundled locally; remotely hosted executable code is forbidden.

## Checks before you send a change

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm run check
npm run build
npm run validate:dist
npm run skills:validate
```

Maintainers building a Store update package use `npm run release`. See [Release](release.md). Do not upload a hand-zipped `dist/` folder to the Chrome Web Store.

Selector, relationship-rule, or Side Panel interaction changes also need tests and the relevant manual steps in [Testing](testing.md). When behavior or workflow changes, update `docs/` and the matching English pages under `docs/en/` or root `README.en.md` when those counterparts exist, plus `skills/x-relationship-observer/references/`, and keep the [documentation index](README.md) accurate. The root README is for installers; do not put the developer index back into it.

Do not add `tabs`, `scripting`, `cookies`, `webRequest`, or all-sites access for convenience. Content scripts must not use the page origin's IndexedDB.

## Pull requests

1. Branch from latest `main`. One pull request, one change.
2. Title the user-visible result, not only a filename.
3. Explain how you verified it, and list the commands you ran.
4. If user-visible copy changed, state that all three languages were updated.
5. If permissions, collection scope, or the consent flow changed, update `terms/privacy.md`, the in-code consent version when needed, and the Store disclosure draft before asking for a merge.

Maintainers may ask you to shrink the scope so the change stays inside the product boundary.

## License

Contributions are licensed under the repository [MIT License](../../LICENSE).
