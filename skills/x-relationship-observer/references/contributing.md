# Contribution workflow

Source, issues, and releases live at `https://github.com/interjc/chrome-x-not-brother`. User feedback and support use `https://github.com/interjc/chrome-x-not-brother/issues`.

## Product boundary

Preserve the two product responsibilities: annotate relationship evidence already visible on `x.com`, and store those observations in the extension's local database. Reject automatic scrolling, profile traversal or prefetch, private X API calls, and clicks on Follow, Unfollow, Block, Mute, or other account-action controls. A standard X profile link may open only from an explicit user gesture.

Treat missing evidence as internal `unknown`. Never badge, persist, import, export, or count it, and never let `unknown` erase a known relationship.

## Issues

Search existing issues before opening a new one. Bug reports should include the extension version, Chrome version, Chrome UI language, X page language, page type, expected versus actual result, and reproduction steps.

Do not attach account passwords, cookies, real relationship exports, or other people's avatars and source URLs. Screenshots must use fictional or authorized test accounts.

Feature requests must stay inside annotation and local collection. Do not implement account actions, site-wide crawling, X APIs, remote sync, or telemetry as a routine patch. Material data-handling changes must update `terms/privacy.md` and the in-extension consent version first.

## Change procedure

1. Load nvm and the `.nvmrc` Node version before any npm command.
2. Change the smallest owning module. Keep X selectors and localized evidence text in `src/content/x-adapter.ts`.
3. Route every user-visible runtime string through `src/i18n/` with complete `en`, `ja`, and `zh-CN` catalogs. Update all three `public/_locales` catalogs when Manifest metadata changes.
4. Run `npm run check`, `npm run build`, `npm run validate:dist`, and `npm run skills:validate`. Maintainers preparing a store update use `npm run release`.
5. Update the matching files under `docs/` and these skill references when behavior or workflow changes.

Do not add the `tabs`, `scripting`, `cookies`, `webRequest`, or `<all_urls>` permissions. Content scripts must not use the page origin's IndexedDB.
