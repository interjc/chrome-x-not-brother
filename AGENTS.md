# Repository instructions

## Product boundary

This repository builds **Not Brother**, a Chrome Manifest V3 extension that observes relationship evidence already visible while the user browses `x.com`.

The extension has two default product responsibilities, plus one opt-in display filter:

1. annotate visible X users with a relationship badge;
2. collect the observed relationship evidence in the extension's local database;
3. optionally hide Home/search/notification posts from muted accounts, from accounts already known to have blocked the viewer, or from local user-authored blacklist rules.

Do not add code that automatically scrolls X, opens profiles, calls private X endpoints, or clicks Follow, Unfollow, Block, Mute, or any other X account-action control. X account mutations are outside the product boundary. Timeline hiding is CSS/DOM display only, off by default, and must stay behind the Options page and in-panel settings.

A standard X profile link in extension UI may open only from an explicit user click or keyboard activation. Never pre-open, prefetch, traverse, or batch-navigate profile pages.

## Node environment

Node.js is installed and managed through **nvm**. Non-interactive shells on this machine may otherwise resolve the system Node 8 binary, which is too old for this project.

Before running Node, npm, or npx commands, load nvm and select the repository version:

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
```

`.nvmrc` (`24.19.0`) provides the recommended Node version. Do not restrict the Node version in configuration files (`package.json`). Running `nvm use` in the shell is sufficient.

## Python environment

Python on this machine is managed through **pyenv**. Before any project Python or pip command, make pyenv authoritative and use its selected interpreter:

```bash
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
pyenv exec python --version
```

Do not silently fall back to `/usr/bin/python`, `/usr/bin/python3`, or a Framework Python when pyenv is missing or its selected version is unavailable. Report the environment issue instead. This repository currently has no Python runtime dependency and therefore does not pin a project `.python-version`; add one only if Python becomes part of a documented project workflow.

## Required checks

Run these before handing off a code change:

```bash
npm run check
npm run build
npm run validate:dist
npm run skills:validate
```

Use `npm run package` only when preparing a loadable release archive. Write the ZIP only to `artifacts/`, and delete previous `not-brother-*.zip` files there (and any leftover copies in `output/`) before creating the new one.

## Release workflow

The standard release workflow is automated in repository scripts:

1. **Environment preparation**:
   ```bash
   source "$HOME/.nvm/nvm.sh"
   nvm use
   ```

2. **Run release**:
   - For an existing bumped version:
     ```bash
     npm run release
     ```
   - Or bump version and release together:
     ```bash
     npm run release:patch   # or release:minor / release:major
     # or: node scripts/release.mjs patch
     ```
   - When offline or GitHub Pages is unreachable:
     ```bash
     npm run release -- --skip-pages
     ```

3. **Release notes**:
   The release script verifies and guides release notes in `docs/store-listing.md` across English, Simplified Chinese, and Japanese. Ensure the notes are filled for the current version.

4. **Pipeline checks performed automatically by `npm run release`**:
   - `npm run check` (TypeScript typecheck + Vitest unit tests)
   - `npm run test:coverage` (Coverage verification)
   - `npm run skills:validate` (Validates agent skills)
   - `npm run package` (Builds `dist/`, validates Manifest V3 constraints, cleans old archives, writes `artifacts/not-brother-<version>.zip`)
   - `npm run verify:pages` (Verifies public privacy policy and terms on GitHub Pages)

5. **Upload & Publish**:
   Upload `artifacts/not-brother-<version>.zip` to the Chrome Web Store Developer Dashboard, copy the matching release notes from `docs/store-listing.md`, and submit for review.

## Architecture rules

- Keep X DOM selectors and localized text matching inside `src/content/x-adapter.ts`.
- Collect platform relationship text and author identity without cloning tweet bodies. Skip `tweetText` / card media when walking handles, avatars, and suggestion chrome. Tweet-body @mentions are never authors.
- Read already-loaded `following` / `followed_by` / `blocked_by` / `muting` for visible authors from the current page UI store, tweet fibers, and GraphQL responses the page itself already completed via `src/content/page-store.ts`. Do not send new GraphQL requests or treat a missing store entity as not-following. Do not persist a mute list; `muting` is ephemeral display evidence.
- Treat missing relationship evidence as the internal `unknown` result; never badge, persist, import, export, or count it, and never infer a negative relationship from an unrelated timeline card. A Follow button on a UserCell is not `followsYou=false`; Who-to-follow and similar suggestion modules never supply negative follows-you, and those cards must not accept page-store `none` fills.
- Treat explicit `following=false` and `followsYou=false` as stored `none`: it may replace a visible known state so stale badges disappear. Do not seed a new user from `none`. Neither-following transitions, including `follows_you_only → none`, must not badge, count, or become a reviewable change. Blocked-by still wins and displays.
- Store extension data through the background service worker. Content scripts must not use the page origin's IndexedDB.
- Preserve observation history. A known state may replace another known state; an internal `unknown` result must be discarded before persistence and must not erase a known state.
- Derive change presentation without changing stored relationship facts: any transition whose current state is mutual displays mutual. A current following-only state displays following-only unless history shows they used to follow the viewer: mutual to following-only or follows-you-only to following-only is unfollowed-you. Mutual to follows-you-only is you-unfollowed, and any known non-blocked state to blocked-by is blocked-you. Keep other ambiguous double-action transitions generic, never label a viewer action as the other account's action, and keep the dock change statistic aggregated.
- Use text content and DOM APIs for injected UI. Do not inject HTML strings into X.
- Keep all runtime code bundled locally. Manifest V3 forbids remotely hosted executable code.
- Route every user-visible runtime string through `src/i18n/`; keep English, Japanese, and Simplified Chinese catalogs complete. Extension pages default to the Chrome UI language and may be overridden from the Side Panel or dashboard language switcher; UI injected into X follows that override, or the page language when the preference is auto.
- Request the minimum Chrome permissions necessary for the feature.
- Keep the observer disabled until the current prominent-disclosure consent version has been accepted.
- Exclude the signed-in viewer at scan, storage, summary, and UI layers; never show the viewer in recent observations.
- Treat generic unavailable-post text and user-authored post content as insufficient blocked-by evidence.
- In a thread, classify blocked-by from engagement restrictions only when reply, repost, and like are all present as real controls and explicitly disabled (`disabled`, `aria-disabled`, or `inert`) while another post in the same overlay or page layer has all three actionable. Empty testid shells, `pointer-events: none` scroll locks, and `aria-hidden` virtualized cells are missing evidence, not blocked-by. Independently, a fully loaded, already-visible hover card that omits all following/follower links is blocked-by evidence. A single disabled repost control is insufficient. A photo lightbox is still the underlying thread; do not use the hidden timeline behind it as the interaction baseline.
- Use a fully loaded visible hover card only for the matching handle. Its stable follow/unfollow control and `userFollowIndicator` may supplement the underlying card's ordinary relationship facts; never leak one hover card's facts to another author.
- Query the local archive for handles already visible on the page. A known stored relationship may annotate a card whose current DOM has no fresh evidence; this is not an unknown badge.
- Preserve toolbar state, first-install guidance, the X-page observer dock and its persistent panel/floating-ball preference, and light/dark theme parity. The collapsed NB ball stays in the bottom-right corner; while it is shown, shift X Chat/Grok drawers up with display CSS only. After current consent, the expanded dock shows filter-rule applying/count status plus this-page and lifetime intercept counts (no rule bodies) and an edit entry that opens the Side Panel Rules tab, falling back to the fieldbook `#filter-rules` page. Before current consent, keep a prominent disclosure entry in the expanded dock, beside the collapsed bubble, and in the action-icon context menu; these entries must open the full notice rather than record consent directly.
- Preserve the hybrid page monitor: semantic DOM mutations plus a 2-second fallback rescan only while the consented page is visible and either the observer or an optional timeline filter is on, immediate focus/visibility recovery, single-flight processing, signature deduplication only after confirmed persistence so transient failures retry, and complete timer/listener teardown on extension-context invalidation. Ignore MutationObserver records whose target is inside `tweetText` or card media; those nodes are user-authored content, not author identity or platform relationship chrome. The 2-second rescan still sees completed post text for optional filter-rule matching.
- Preserve cross-tab cache invalidation through service-worker `data:changed` broadcasts. Do not add the `tabs` permission; tabs without a content-script receiver are expected, and intentional archive deletion must not clear observation signatures and immediately reinsert unchanged evidence.
- Keep the Side Panel split into Status (observation overview and user list), Rules (filter-rule editor and intercept counts), and Options (language, page badges, timeline filters). Persist `sidePanelTab`. Chrome's built-in action context-menu Options entry must open that Options tab via `options_ui`; the custom pre-consent action entry may use only `contextMenus`, must hide after current consent, and must fall back to the local dashboard if Side Panel cannot open.
- Keep extension pages subscribed to `chrome.storage.onChanged` through the shared settings hook/rule listener so viewer exclusion, observer controls, optional timeline filters, local blacklist rules, the side-panel tab, and the UI language preference remain consistent across an already-open Side Panel, dashboard, Options page, and X tabs.
- Keep `hideMutedAccounts`, `hideBlockedByAccounts`, and `hideByFilterRules` default false. When enabled after consent, hide tweet cells on Home, search, notifications, and post threads; never hide profile pages, hover cards, or following/followers lists. Do not click X controls or call mute/block APIs. After consent, a HoverCard may expose a Not Brother quick-add control next to the name that writes a handle rule, the tweet more (`caret`) menu may expose the same handle action for that post's author, and a tweet-text selection may expose a keyword quick-add that writes a contains rule; these save immediately through the service worker and may turn on `hideByFilterRules`. Accounts already in the local list hide immediately; a newly detected muted, blocked-by, or rule-matching author collapses with a short motion, unless the user prefers reduced motion.
- Keep the full `not-brother-filter-rules` v1 document in `chrome.storage.local`, never Sync or IndexedDB, and namespace it by the signed-in X handle so account switching does not mix rule sets. Strictly Zod-validate local/URL/Gist imports, limit unsafe regular expressions and document sizes, and keep post text transient: it may be matched only when the consented custom filter is on and must never be persisted, logged, exported, or transmitted.
- Remote rule import must be a one-time explicit user action using `https://*/*` only as `optional_host_permissions`, requested for the resolved public HTTPS source inside the Load-button gesture. Do not add persistent host access, credentials, private-source authentication, background subscriptions, redirects, or remote executable code.

## Documentation

Update the relevant file under `docs/` and the matching project skill reference under `skills/x-relationship-observer/references/` when behavior or workflow changes. When an English counterpart exists under `docs/en/` or root `README.en.md`, keep that translation current in the same change. Keep the documentation index in `docs/README.md` accurate. Keep the root `README.md` written for people who install and use the extension, with `README.en.md` as the English entry.
