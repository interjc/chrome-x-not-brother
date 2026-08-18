# Maintenance workflow

## Selector drift

When X markup changes, capture the smallest redacted DOM fixture that demonstrates the failure. Update only `src/content/x-adapter.ts` and its tests. Prefer stable semantic surfaces such as `data-testid`, profile links, and localized visible relationship labels. Do not use minified React internals or private network responses.

Treat a missing element as internal unknown. A broken selector must reduce confidence, not generate a false one-way relationship. Unknown must not be shown, persisted, imported, exported, or counted.

Keep both `UserName` and reply-thread `User-Name` fixtures. Remove `tweetText` from platform-notice matching so user-authored words cannot become blocked-by evidence. Generic unavailable posts remain internal unknown.

Keep injected badges in the display-name row. X renders the display name and metadata as separate nested flex regions, so mark only the badge's immediate name row as horizontal; do not move native nodes or apply spacing that changes the outer `User-Name` geometry. Removal must clear the injected row marker as well as the badge.

The interaction-restriction path requires reply, repost, and like all to be non-actionable plus another page post with all three actionable. Traverse action ancestors through the thread surface because X may place disabled state outside a testid button. Independently, a fully loaded already-visible hover card with no following/follower links produces `blocked-profile-summary-restriction`. Preserve negative fixtures for only-repost-disabled, missing-baseline, and normal-count hover cards.

For ordinary relationship enrichment, map each fully loaded visible hover card to its exact normalized handle. Prefer stable `*-follow`, `*-unfollow`, and `userFollowIndicator` testids, and preserve a cross-handle negative fixture so a visible card cannot contaminate another author.

Keep the zero-record dock and side-panel guidance aligned across English, Japanese, and Simplified Chinese. It should explain the user hover needed to make X relationship evidence visible without suggesting automated scanning.

Known local relationships are returned to content scripts through bounded `users:lookup` batches. Clear both the record cache and requested-key cache on `data:changed` so deletion and import are reflected.

## Database changes

Increment the Dexie schema version for structural changes. Add a migration that preserves user keys, current relationships, and observation history. Update `docs/data-model.md` and import validation for every schema change.

Increment `CURRENT_CONSENT_VERSION` only when data types, purposes, recipients, or storage behavior change materially. Update the prominent disclosure and privacy documentation before collection resumes under the new consent version.

Treat `viewerHandle` as exclusion-only data. Verify scan, database cleanup, summaries, and UI filtering together whenever viewer detection changes.

Treat `dockCollapsed` as a presentation-only `chrome.storage.local` preference. Older partial settings must default to the expanded panel, and panel/bubble changes must retain keyboard access, status indication, X-theme parity, and narrow-screen safe margins.

Repository startup and install cleanup must purge legacy unknown users and observations. Import, export, summaries, content messages, and background writes must all keep the same filter.

## Dependencies

Load nvm, update intentionally, inspect release notes, run the complete check suite, and rebuild the release archive. Manifest runtime code must remain local.

## Localization

Keep user-visible runtime copy in `src/i18n/index.ts`; a new key must be translated in English, Japanese, and Simplified Chinese in the same change. Keep Chrome-owned metadata in the three matching `public/_locales` catalogs. X evidence phrases belong only in the adapter, not the UI catalog.

After copy changes, check the 420px side panel, dashboard, toolbar titles, injected badge/dock, ARIA labels, relative dates, and CSV relationship labels. Unsupported locales must fall back to complete English copy.

## Incident response

When an unpacked extension is reloaded, existing X tabs retain an orphaned content script whose Chrome extension APIs are invalid. Treat `Extension context invalidated` or a missing `chrome.storage.local` as lifecycle termination: catch pending promises, stop timers, disconnect MutationObserver, and remove injected UI. Do not retry or log repeated warnings. Refresh the X tab after reloading the extension to inject the new content script.

If badges destabilize X or produce false labels:

1. disable the observer from the side panel;
2. record page locale, URL shape, expected label, and observed label;
3. reproduce with a sanitized fixture;
4. fix and test the adapter;
5. document the selector change in `docs/maintenance.md`.
