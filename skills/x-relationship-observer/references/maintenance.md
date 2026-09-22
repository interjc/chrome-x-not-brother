# Maintenance workflow

## Selector drift

When X markup changes, capture the smallest redacted DOM fixture that demonstrates the failure. Update only `src/content/x-adapter.ts` and its tests. Prefer stable semantic surfaces such as `data-testid`, profile links, and localized visible relationship labels. Do not use minified React internals or private network responses.

Treat a missing element as internal unknown. A broken selector must reduce confidence, not generate a false one-way relationship. Unknown must not be shown, persisted, imported, exported, or counted.

Keep HoverCard quick-add next to `UserName` / `User-Name` (or the first non-avatar profile link) so the card stays open; do not park it at the card footer. Tweet more-menu injection uses `data-testid="caret"` with `aria-expanded="true"` and `data-testid="Dropdown"`; keep those selectors in `x-adapter.ts`.

Keep `UserName`, reply-thread `User-Name`, and occasional `User-Names` fixtures. Home timeline display names often link to `/handle/status/:id` and may hide or bidi-wrap `@handle`; extract identity from those profile subpaths, author avatars, and cleaned handle text so archive lookup and the page UI store can annotate the card. Notification activity rows (`data-testid="notification"`) take actors only from that row's avatars; place the badge inside the display-name link (avatar link if there is no name link). Do not treat the historical action sentence as the current relationship, and do not let one Follow button cover every person in a grouped notification. Preview links without an avatar are not actors. Do not treat tweet-body mentions as the author, and do not copy an outer tweet avatar onto a quoted card that has no handle. Collect platform notices, suggestion chrome, handles, and avatars by skipping the `tweetText` subtree; do not `cloneNode(true)` a tweet to strip user content. Keep a mention-heavy thread fixture so a status page packed with `@user` links still yields only the post authors. Accept avatars only from a same-handle profile link or exact `UserAvatar-Container-<handle>` suffix. Read declared `src` / `srcset`, not stale `currentSrc` during X DOM recycling, and never fall back to the first image in a composite card. Include identity metadata in observation signatures so later corrections persist. A post-less profile's current-handle `primaryColumn` may emit `blocked-notice` from explicit English, Japanese, Simplified Chinese, or Traditional Chinese copy. Exclude `tweetText`, `UserDescription`, `UserName`, `[data-xro-badge]`, and nested post/UserCell relationship surfaces in that profile column so another account's relationship or user/extension copy cannot become evidence. Generic unavailable posts remain internal unknown.

Side Panel and Fieldbook avatar components must first use the latest stored, normalized X CDN `avatarUrl` captured for that handle. If it is absent or fails, try `https://unavatar.io/x/{handle}`; if that also fails, show the handle initial. A newly observed non-null avatar URL must be resent and replace the cached user value even when relationship evidence is unchanged. Never let a missing avatar erase the last known URL.

Read already-loaded `following`, `followed_by`, `blocked_by`, and `muting` from the current page UI store, ancestor tweet fibers, and GraphQL responses the page itself already completed. Always merge those sources; do not stop after the first store user, or reply authors in a thread will be missed. Do not send new GraphQL requests or treat a missing entity as not-following. Painted DOM evidence wins for ordinary relationships, but explicit locale-independent `blocked_by=true` overrides stale ordinary follow evidence. Keep the main-world `page-bridge.js` and isolated observer both scoped to `https://x.com/*`.

Keep tweet/reply badges immediately before the visible `@handle`. Never insert after a timestamp or let `justify-content: space-between` park the badge at the far right of the name row. If `@handle` is hidden, place the badge after the display-name link and ignore time permalinks. When `User-Name` stacks the display name above `@handle` and contains no `time`, keep X's display name and handle on one row and put the relationship badge on the next line, with 1–2px between the left identity accent and the display name. Do not restyle a parent that already contains `time`. Removal must clear the injected row/stack markers as well as the badge.

Use a hybrid page monitor: semantic MutationObserver signals for child, text, and relationship-relevant attribute changes plus a 2-second fallback rescan only while the active observer page is visible. Ignore mutation records whose target is inside `tweetText` or card media so mention-link painting does not rescan the page; the fallback pass still reads completed post text for optional filter-rule matching. Focus and visibility restoration request an immediate pass. Keep processing single-flight and signature-deduplicated, but commit a signature only after the service worker confirms that user was persisted so a transient message failure remains retryable. Pause periodic work while hidden, and tear down timers and listeners when the extension context becomes invalid. Never broaden the poll into scrolling, navigation, private state, network interception, or X actions.

Archive mutations and observations from another X tab must invalidate content caches through a service-worker `data:changed` broadcast. Use `chrome.tabs.query`/`sendMessage` without requesting the `tabs` permission, ignore tabs with no receiver, clear record/requested caches in every content recipient, and retain observation signatures so an intentional deletion is not immediately reinserted from unchanged visible evidence.

The interaction-restriction path requires reply, repost, and like to exist as real interactive controls that are explicitly disabled (`disabled`, `aria-disabled`, or `inert`) plus another post in the same overlay or page layer with all three actionable. Missing controls are not disabled controls: empty testid shells, `pointer-events: none` scroll locks, `aria-hidden` virtualized cells, and hidden or unrendered action bars stay internal unknown. Traverse action ancestors through the thread surface because X may place disabled state outside a testid button, but do not treat pointer-events or aria-hidden as that disabled state. Photo `/status/:id/photo/:n` URLs are threads; the lightbox conversation must use a baseline inside that dialog/`#layers`, not the timeline behind it. Independently, a fully loaded already-visible hover card with no following/follower links produces `blocked-profile-summary-restriction`. Preserve negative fixtures for only-repost-disabled, missing-controls, empty shells, pointer-events scroll locks, hidden virtualized cells, overlay-vs-timeline baselines, missing-baseline, and normal-count hover cards.

For ordinary relationship enrichment, map each fully loaded, semantically visible hover card to its exact normalized handle. Reject `hidden`, `inert`, `aria-hidden`, `display:none`, `visibility:hidden`, and zero-opacity stale cards. Prefer stable `*-follow`, `*-unfollow`, and `userFollowIndicator` testids, and preserve cross-handle and hidden-card negative fixtures so one card cannot contaminate another author.

Keep the zero-record dock and side-panel guidance aligned across English, Japanese, and Simplified Chinese. Hover is a fallback when the page store has no complete facts, not a claim that Home requires opening every hover card.

Known local relationships are returned to content scripts through bounded `users:lookup` batches. Clear both the record cache and requested-key cache on `data:changed` so deletion and import are reflected.

## Database changes

Increment the Dexie schema version for structural changes. Add a migration that preserves user keys, current relationships, and observation history. Update `docs/data-model.md` and import validation for every schema change.

Increment `CURRENT_CONSENT_VERSION` only when data types, purposes, recipients, or storage behavior change materially. Update the prominent disclosure and `terms/privacy.md` before collection resumes under the new consent version.

Treat `viewerHandle` as exclusion-only data. Verify scan, database cleanup, summaries, and UI filtering together whenever viewer detection changes.

Keep `viewerHandle` in `chrome.storage.local`; it describes the X account on this device and must not sync into a different X session. Keep users and observations in IndexedDB.

Treat `dockCollapsed` as a presentation-only `chrome.storage.sync` preference. Older partial settings must default to the expanded panel, and panel/bubble changes must retain keyboard access, status indication, X-theme parity, and narrow-screen safe margins. The collapsed NB ball stays in the bottom-right corner; while it is shown, shift X Chat/Grok drawers up with display CSS generated from `X_CORNER_FAB_SELECTOR` in `x-adapter.ts`. Before current consent, both the expanded dock and collapsed launcher must expose a visible native disclosure button without recording consent; keep the localized action context-menu entry in sync and hide it after consent.

Treat `uiLocale` as a presentation-only `chrome.storage.sync` preference. Missing or unknown values default to `auto` (Chrome UI language for extension pages, X page language for injected badges and dock). A manual English, Japanese, or Simplified Chinese choice updates already-open Side Panel, dashboard, and Options pages, the toolbar title, and X-injected badges and dock; it must not increment consent.

Treat `hideMutedAccounts` and `hideBlockedByAccounts` as presentation-only `chrome.storage.sync` preferences that default false. They must not increment consent, persist a mute list, hide profile/hover/user-list surfaces, or click X controls. Home, search, notifications, and post threads may hide muted or blocked-by tweet cells.

Treat `hideByFilterRules` as a default-false synced master switch and the filter-rule document as local-only, namespaced by the signed-in X handle. Rules can read post text transiently, so changes to that data use, storage, or remote import recipients require a consent-version and privacy review. Preserve Zod strict validation, safe-regex and size limits, runtime expiration, storage-change reload, and the optional-per-source permission boundary in [filter-rules.md](filter-rules.md).

Keep all synced preferences in a small settings item below Chrome Sync's 8 KB per-item and 100 KB total quotas. Do not sync the relationship archive, viewer handle, or filter-rule document. When Chrome is signed out, sync is disabled, or the browser is offline, rely on `chrome.storage.sync`'s local behavior instead of creating a second fallback copy. During the one-time local-to-sync migration, existing sync preferences win; migrate only the local `viewerHandle`, and remove the legacy key only after destination writes succeed.

Repository startup and install cleanup must purge legacy unknown users and observations. Import, export, summaries, content messages, and background writes must all keep the same filter.

Specific change events are derived presentation, not stored relationship kinds: a current mutual state always displays mutual. A current following-only state displays following-only unless history shows they used to follow the viewer (mutual or follows-you-only to following-only), which is unfollowed-you. Mutual to follows-you-only is you-unfollowed, and any known non-blocked relationship to blocked-by is blocked-you. Explicit neither-following is stored `none` only to replace a visible relationship so stale badges can be removed; follows-you-only to none is not unfollowed-you, and `none` is not a first-seen collectable state. A Follow button on Who-to-follow or other suggestion UserCells is unknown, not none; those cards must not consume page-store `followed_by=false`. Keep other ambiguous double-action transitions generic, keep the dock statistic aggregated by `hasChanged`, and do not migrate the database merely to store these display labels.

## Dependencies

Load nvm, update intentionally, inspect release notes, run the complete check suite, and rebuild the release archive. Manifest runtime code must remain local.

## Localization

Keep user-visible runtime copy in `src/i18n/index.ts`; a new key must be translated in English, Japanese, and Simplified Chinese in the same change. Keep Chrome-owned metadata in the three matching `public/_locales` catalogs. X evidence phrases belong only in the adapter, not the UI catalog. The Japanese follows-you short label is 被フォロー, not フォロー中, which is X's own Following control.

After copy changes, check the 420px side panel, dashboard, toolbar titles, injected badge/dock, ARIA labels, relative dates, and CSV relationship labels. Unsupported locales must fall back to complete English copy.

## Incident response

When an unpacked extension is reloaded, existing X tabs retain an orphaned content script whose Chrome extension APIs are invalid. Treat `Extension context invalidated` or missing `chrome.storage.sync` / `chrome.storage.local` as lifecycle termination: catch pending promises, stop timers, disconnect MutationObserver, and remove injected UI. Do not retry or log repeated warnings. Refresh the X tab after reloading the extension to inject the new content script.

A `Could not read observation summary` warning whose cause is `the message channel closed before a response was received` is a Manifest V3 service-worker wakeup (or another X tab returning `false` from `runtime.onMessage`). Handle only `data:changed` in the content-script listener; do not `return false` for other runtime messages. Retry summary/lookup/upsert/rule-status `sendMessage` a few times on a closed channel. Do not retry context invalidation.

The injected dock exposes the running candidate version through its read-only `data-xro-version` attribute. Confirm it matches the intended package after refreshing X before accepting live-page results.

If badges destabilize X or produce false labels:

1. disable the observer from the side panel;
2. record page locale, URL shape, expected label, and observed label;
3. reproduce with a sanitized fixture;
4. fix and test the adapter;
5. document the selector change in `docs/maintenance.md` and `docs/en/maintenance.md`.
