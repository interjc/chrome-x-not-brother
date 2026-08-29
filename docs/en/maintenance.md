# Maintenance

[简体中文](../maintenance.md) · **English**

## X DOM drift

Page annotation is most likely to break when X changes DOM or localized evidence copy. When that happens:

1. Pause the observer in the Side Panel so bad data stops being written.
2. Record the URL type, X UI language, expected relationship, and actual annotation.
3. Save a minimized, de-identified DOM fixture. Do not save post text or unnecessary personal data.
4. Change only `src/content/x-adapter.ts` and add a reproducing test.
5. When evidence disappears, return internal unknown. Do not guess a negative. Unknown must not enter badges, the database, import/export, or counts.
6. Run the full checks and manual acceptance.

Prefer semantic `data-testid`, standard profile hrefs, and explicitly visible text. Read-only access is allowed to already-loaded page UI store fields, tweet-ancestor fibers, and GraphQL responses the page itself already completed for `following`, `followed_by`, `blocked_by`, and `muting`. Reply-author relationship fields often live in Tweet component props or TweetDetail responses rather than `entities.users`. Do not start new X requests, read cookies, or treat a missing entity as not-following. Optional timeline hiding only toggles `data-xro-hidden-tweet`; keep `src/content/timeline-hide.ts` in sync when those selectors drift.

Live recognition is a hybrid of events and polling. MutationObserver handles added/removed nodes, relationship text, and key accessibility-attribute changes. Changes inside `tweetText` and card media are ignored because they are user-authored content, not author identity or platform relationship chrome. That avoids locking a tab when a post or reply is packed with @mentions. A visible enabled page falls back to a rescan every 2 seconds; restoring visibility or focus triggers an immediate pass. Optional rule matching also relies on that rescan to see post text that has finished rendering. Polling only queries the current DOM. It does not scroll, open pages, or click X controls. Scans stay single-flight: overlapping MutationObserver, poll, settings, and SPA URL triggers queue one follow-up. Signature deduplication must stop identical results from appending history, but a signature may be committed only after the service worker confirms the matching user persisted. Transient send failures must remain retryable on a later rescan.

Injected dock `data-xro-version` is a read-only diagnostic. After reloading an unpacked extension you must refresh already-open X tabs. Maintainers can use that attribute to confirm the page replaced the old content script before live acceptance. While the floating ball is shown, `GrokDrawer` / `DMDrawer` / `chat-drawer-root` shift X's bottom-right buttons up. Those selectors live only in `x-adapter.ts`; when they drift, change only the adapter and dock fixtures.

When adjusting polling, first measure visible `User-Name` count, single-scan duration, and observation writes per minute. Do not keep the fallback rescan on a hidden tab. On extension-context invalidation, remove visibility/focus listeners and stop timers. `style` and `class` change too often to join the global attributeFilter; the 2-second fallback covers them.

Fieldbook acknowledge, delete, import, and clear must send `data:changed` to the service worker, which then tries `chrome.tabs.sendMessage` on every tab. Tabs without a content script rejecting the message is expected. After receiving it, the content script unconditionally clears record/requested caches and schedules a rescan only while running. Do not clear observation signatures, or a currently visible record the user just deleted may be rewritten immediately from the same evidence.

Post authors often use `data-testid="User-Name"`, lists/profiles `UserName`, and occasionally `User-Names`. Keep fixtures for all three. Home timeline display names often link to `/handle/status/:id`, and `@handle` may be hidden or bidi-wrapped. Handle extraction must accept those profile subpaths, avatar links, and `@handle` after format characters are stripped, so the author is a re-annotatable visible handle. Do not treat in-post @mentions as authors, and do not fall a missing quoted-inner handle back to the outer avatar. When collecting platform relationship text, suggestion-module titles, avatars, and handles, skip the `tweetText` subtree. Do not `cloneNode(true)` a whole tweet just to strip body text. Threads whose main post and replies name many people need fixtures whose scan results contain only authors. Display names must not use `·` / `.` separators. Avatars must pair with the same handle's profile link or `UserAvatar-Container-*`, never the first `profile_images` inside a quote. UserCell relationship badges must sit under the avatar, not in the display-name row or over the Follow button. A Follow button alone on a UserCell must not infer `followsYou=false`; following-list and profile main columns, or a fully loaded same-handle hover card, may. Who-to-follow cards stay unknown and must not be filled as none from the page store. Post/reply badges must sit immediately before the visible `@handle`, not after the timestamp or space-between-pushed to the far right. Fall back behind the display-name link only when no handle is visible, and do not use a permalink that contains `<time>`. Timestamp-less post-detail `User-Name` keeps X's display name and `@handle` on one row and the relationship label on the next. Ancestors that already contain time must not be restacked. Leave 1–2px between the left edge and the display name. Platform blocked-notice matching must exclude `tweetText`. User-authored copy or generic “This Post is unavailable” is not blocked-by evidence. The interaction-restriction path must also confirm reply, repost, and like are actually rendered; a missing control is not the same as disabled.

Thread interaction-restriction structure must cover reply, retweet/unretweet, and like/unlike together. Only when all three groups are rendered as real interactive nodes, explicitly disabled with `disabled` / `aria-disabled` / `inert`, and another post in the same overlay or page layer has all three actionable, emit `blocked-interaction-restriction`. Empty testid shells, scroll-time `pointer-events: none`, `aria-hidden` virtualized cells, and controls not yet drawn stay internal unknown. X may put `data-testid` on the button itself and the disabled state on an outer ancestor, so the explicit-disabled check must walk up to the reply surface, but must not treat `pointer-events` or ancestor `aria-hidden` as blocked-by. `/status/:id/photo/:n` is still a post thread. The photo-viewer side conversation must use a baseline in the same dialog / `#layers`, not the timeline behind it.

An already-shown `HoverCard` with no progress/loading state and no `/following`, `/followers`, or `/verified_followers` links for that handle independently emits `blocked-profile-summary-restriction`. Keep counter-example fixtures for a normal hover card that still has count links, a single disabled repost, a missing same-page baseline, and a globally restricted viewer. Known records re-annotate through `users:lookup`. After delete or import, `data:changed` must clear the content cache and query again. After consent, the **Not Brother!** quick-add control must be inserted after `UserName` / `User-Name` (or after a non-avatar profile link when there is no name cluster), not at the bottom of the hover card where moving the pointer would close it. The post top-right menu uses `data-testid="caret"`; the opened menu is `data-testid="Dropdown"`. Inject the item only when `aria-expanded="true"` and that post's author can be read. Those selectors stay in `x-adapter.ts`.

Ordinary-relationship completion may also use a fully loaded visible `HoverCard`, but only after an exact normalized-handle match. Residual cards that are `hidden`, `inert`, `aria-hidden`, `display:none`, `visibility:hidden`, or fully transparent must not participate. Prefer stable `*-follow`, `*-unfollow`, and `userFollowIndicator` over localized copy. Keep fixtures for mutual, following-only, an unsupported-language indicator, a hidden stale card, and no cross-handle leakage.

Home timeline cards usually omit follow controls, but the current page UI store often already has that author's `following` / `followed_by`. When debugging “Home does not recognize”: first confirm the card extracted a handle; then confirm the console can read store or tweet-fiber user entities on `#react-root`; main-world `page-bridge.js` must already be injected. Hover is needed only when the store has no complete booleans. While the observer count is still zero, the dock only describes hover as a fallback.

## Recovering from a wrong relationship

- After an adapter fix, a later credible observation can update the current relationship.
- Unknown is discarded at the content/storage boundary, and startup purges legacy unknown.
- Users can delete one local record.
- For wide contamination, export a backup first, then clear the database and observe again.

## Extension context invalidation

After reloading a development build on `chrome://extensions`, already-open X tabs may briefly keep the old content script. Chrome invalidates that script's extension API context. Typical logs are `Extension context invalidated`; old code may also keep touching missing `chrome.storage.sync` / `chrome.storage.local`.

The content script must treat this as end of life: catch promise rejections, stop timers, disconnect MutationObserver, and remove old badges and the observer dock. Do not keep retrying it as an ordinary runtime error. Developers still need to refresh every already-open X tab after reloading the extension so the new script injects. Error pages keep history; click Clear all before re-checking a target page.

## Database

Any schema change must use a new Dexie version and a migration. Do not silently wipe the database on upgrade. Breaking migrations need explicit release notes and a user backup step.

They unfollowed / You unfollowed / They blocked you are display events derived from previous and current base relationships, not new database relationship values. A current mutual state displays Mutual. A current following-only state defaults to One-way; only `mutual → following_only` and `follows_you_only → following_only` display they-unfollowed. `follows_you_only → none` and other neither-following cases drop the badge and stay out of the overview. When changing derivation rules, cover those transitions, mutual override display, and the neither-following (`none`) counter-example that drops the badge and stays out of the overview. Keep the dock aggregated on `hasChanged`. Do not add a schema field for the display label.

If the types of data read, their purposes, recipients, or storage location change materially, raise `CURRENT_CONSENT_VERSION`, update the first-run disclosure and privacy docs, and obtain consent again before the new version keeps observing. Pure copy fixes must not reset consent casually.

`viewerHandle` is only for excluding the viewer. When changing account-identification logic, also verify: scan-time produces no self observation, UI filters old records, and the service worker deletes already-stored self data.

Small preferences belong in `chrome.storage.sync`, `viewerHandle` in `chrome.storage.local`, and users/observations in IndexedDB. Do not slice the relationship archive into sync. Keep each settings item under 8 KB, the total well under 100 KB, and writes infrequent. Signed-out, sync-off, and offline need no custom fallback; Chrome keeps the sync area working locally. When migrating legacy local settings, existing sync values win, and old keys may be deleted only after the new area writes succeed.

## Dependencies

Enter the pinned Node through nvm, update dependencies one by one, and read their release notes. Pay extra attention to TypeScript, esbuild, Dexie, React, and Chrome types. After an upgrade, run the build, permission validation, and a clean-profile manual test.

## Translation maintenance

All runtime user copy lives in `src/i18n/index.ts`. X evidence strings used for recognition stay in the adapter. A new key must be completed in Chinese, English, and Japanese in the same change. Manifest metadata updates `public/_locales/en`, `ja`, and `zh_CN` together. Do not hard-code one language in React components, the content dock, or background action titles.

After a translation change, check the narrow Side Panel, full dashboard, confirm dialogs, ARIA labels, CSV `relationship_label`, and the X-page dock. Translations must not change relationship semantics, privacy promises, or the supported feature set. The full process is in [Localization](localization.md).

## Documentation sync

When behavior or workflow changes, update `docs/` (including the [index](README.md)), matching English pages under `docs/en/` or root `README.en.md` when they exist, and the corresponding workflows in `skills/x-relationship-observer/references/`. Keep the root README installer-facing.
