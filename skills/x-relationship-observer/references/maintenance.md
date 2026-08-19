# Maintenance workflow

## Selector drift

When X markup changes, capture the smallest redacted DOM fixture that demonstrates the failure. Update only `src/content/x-adapter.ts` and its tests. Prefer stable semantic surfaces such as `data-testid`, profile links, and localized visible relationship labels. Do not use minified React internals or private network responses.

Treat a missing element as internal unknown. A broken selector must reduce confidence, not generate a false one-way relationship. Unknown must not be shown, persisted, imported, exported, or counted.

Keep `UserName`, reply-thread `User-Name`, and occasional `User-Names` fixtures. Home timeline display names often link to `/handle/status/:id` and may hide or bidi-wrap `@handle`; extract identity from those profile subpaths, author avatars, and cleaned handle text so archive lookup and the page UI store can annotate the card. Do not treat tweet-body mentions as the author, and do not copy an outer tweet avatar onto a quoted card that has no handle. Remove `tweetText` from platform-notice matching so user-authored words cannot become blocked-by evidence. Generic unavailable posts remain internal unknown.

Read already-loaded `following`, `followed_by`, and `blocked_by` from the current page UI store, ancestor tweet fibers, and GraphQL responses the page itself already completed. Always merge those sources; do not stop after the first store user, or reply authors in a thread will be missed. Do not send new GraphQL requests or treat a missing entity as not-following. Painted DOM evidence still wins. Keep the main-world `page-bridge.js` and isolated observer both scoped to `https://x.com/*`.

Keep injected badges in the display-name row. X renders the display name and metadata as separate nested flex regions, so mark only the badge's immediate name row as horizontal; do not move native nodes or apply spacing that changes the outer `User-Name` geometry. Removal must clear the injected row marker as well as the badge.

Use a hybrid page monitor: semantic MutationObserver signals for child, text, and relationship-relevant attribute changes plus a 2-second fallback rescan only while the active observer page is visible. Focus and visibility restoration request an immediate pass. Keep processing single-flight and signature-deduplicated, but commit a signature only after the service worker confirms that user was persisted so a transient message failure remains retryable. Pause periodic work while hidden, and tear down timers and listeners when the extension context becomes invalid. Never broaden the poll into scrolling, navigation, private state, network interception, or X actions.

Archive mutations and observations from another X tab must invalidate content caches through a service-worker `data:changed` broadcast. Use `chrome.tabs.query`/`sendMessage` without requesting the `tabs` permission, ignore tabs with no receiver, clear record/requested caches in every content recipient, and retain observation signatures so an intentional deletion is not immediately reinserted from unchanged visible evidence.

The interaction-restriction path requires reply, repost, and like controls to be present but non-actionable plus another page post with all three actionable; missing controls are not disabled controls. Traverse action ancestors through the thread surface because X may place disabled state outside a testid button. Independently, a fully loaded already-visible hover card with no following/follower links produces `blocked-profile-summary-restriction`. Preserve negative fixtures for only-repost-disabled, missing-controls, missing-baseline, and normal-count hover cards.

For ordinary relationship enrichment, map each fully loaded, semantically visible hover card to its exact normalized handle. Reject `hidden`, `inert`, `aria-hidden`, `display:none`, `visibility:hidden`, and zero-opacity stale cards. Prefer stable `*-follow`, `*-unfollow`, and `userFollowIndicator` testids, and preserve cross-handle and hidden-card negative fixtures so one card cannot contaminate another author.

Keep the zero-record dock and side-panel guidance aligned across English, Japanese, and Simplified Chinese. Hover is a fallback when the page store has no complete facts, not a claim that Home requires opening every hover card.

Known local relationships are returned to content scripts through bounded `users:lookup` batches. Clear both the record cache and requested-key cache on `data:changed` so deletion and import are reflected.

## Database changes

Increment the Dexie schema version for structural changes. Add a migration that preserves user keys, current relationships, and observation history. Update `docs/data-model.md` and import validation for every schema change.

Increment `CURRENT_CONSENT_VERSION` only when data types, purposes, recipients, or storage behavior change materially. Update the prominent disclosure and `terms/privacy.md` before collection resumes under the new consent version.

Treat `viewerHandle` as exclusion-only data. Verify scan, database cleanup, summaries, and UI filtering together whenever viewer detection changes.

Treat `dockCollapsed` as a presentation-only `chrome.storage.local` preference. Older partial settings must default to the expanded panel, and panel/bubble changes must retain keyboard access, status indication, X-theme parity, and narrow-screen safe margins.

Repository startup and install cleanup must purge legacy unknown users and observations. Import, export, summaries, content messages, and background writes must all keep the same filter.

Specific change events are derived presentation, not stored relationship kinds: a current mutual state always displays mutual. A current following-only state displays following-only unless history shows they used to follow the viewer (mutual or follows-you-only to following-only, or follows-you-only to none), which is unfollowed-you. Mutual to follows-you-only is you-unfollowed, and any known non-blocked relationship to blocked-by is blocked-you. Explicit neither-following is stored `none` only to replace a visible relationship so stale badges can be removed; only follows-you-only to none among neither-following badges as unfollowed-you, and `none` is not a first-seen collectable state. Keep other ambiguous double-action transitions generic, keep the dock statistic aggregated by `hasChanged`, and do not migrate the database merely to store these display labels.

## Dependencies

Load nvm, update intentionally, inspect release notes, run the complete check suite, and rebuild the release archive. Manifest runtime code must remain local.

## Localization

Keep user-visible runtime copy in `src/i18n/index.ts`; a new key must be translated in English, Japanese, and Simplified Chinese in the same change. Keep Chrome-owned metadata in the three matching `public/_locales` catalogs. X evidence phrases belong only in the adapter, not the UI catalog.

After copy changes, check the 420px side panel, dashboard, toolbar titles, injected badge/dock, ARIA labels, relative dates, and CSV relationship labels. Unsupported locales must fall back to complete English copy.

## Incident response

When an unpacked extension is reloaded, existing X tabs retain an orphaned content script whose Chrome extension APIs are invalid. Treat `Extension context invalidated` or a missing `chrome.storage.local` as lifecycle termination: catch pending promises, stop timers, disconnect MutationObserver, and remove injected UI. Do not retry or log repeated warnings. Refresh the X tab after reloading the extension to inject the new content script.

The injected dock exposes the running candidate version through its read-only `data-xro-version` attribute. Confirm it matches the intended package after refreshing X before accepting live-page results.

If badges destabilize X or produce false labels:

1. disable the observer from the side panel;
2. record page locale, URL shape, expected label, and observed label;
3. reproduce with a sanitized fixture;
4. fix and test the adapter;
5. document the selector change in `docs/maintenance.md`.
