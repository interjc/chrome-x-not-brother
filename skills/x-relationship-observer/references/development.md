# Development workflow

## Environment

Node is managed through nvm. From the repository root run:

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm install
```

Use `npm run dev` for a watch build. Load the generated `dist/` directory from `chrome://extensions` with Developer mode enabled, then reload the extension after each build.

Python is managed through pyenv. The repository currently has no Python runtime dependency and no project `.python-version`; if a maintenance helper requires Python, use an available pyenv-selected interpreter and never silently fall back to system Python.

## Architecture

- `src/content/`: inspect already-rendered X DOM, read already-loaded page UI store relationship fields through `page-store.ts` and the main-world `page-bridge.ts`, pair display names and avatars to the same handle, combine semantic mutation events with a visible-page 2-second fallback rescan, serialize triggers, normalize evidence, discard internal unknown, inject badges, and send known observation drafts whose signatures are committed only after persistence succeeds.
- `src/content/observer-panel.ts`: render the X-page state/summary dock, its accessible panel/floating-ball toggle, the pre-consent disclosure CTA, filter-rule applying/count and intercept totals after consent, and forward its user gesture to Side Panel or the fieldbook `#filter-rules` editor. The collapsed ball stays in the corner; Chat/Grok drawer selectors live in `x-adapter.ts` and are only used to shift those controls up while the ball is shown.
- `src/background/`: persist messages, remove the signed-in viewer, expose summaries, show toolbar state, initialize Chrome side-panel/onboarding behavior, and maintain the localized pre-consent action context-menu entry.
- `src/domain/`: types, relationship resolution, data merge semantics, derived unfollowed-you/you-unfollowed/blocked-you presentation, mutual-always-mutual display, none-for-both-unfollowed, import, and export.
- `src/i18n/`: type-checked English, Japanese, and Simplified Chinese runtime catalogs, locale resolution, relationship labels, and source labels.
- `src/storage/`: IndexedDB access, small Chrome-synced preferences, local viewer exclusion state, local filter-rule documents, and conflict-safe legacy settings migration.
- `src/ui/`: side panel, its pure relationship filter model, user-gesture profile links, dashboard and custom-rule manager, Options page, shared components, presentation, and storage-change-aware settings/rule listeners.
- `src/content/timeline-hide.ts`: opt-in Home/search/notification hiding of muted or known blocked-by tweet cells.
- `src/content/quick-rules.ts`: after-consent HoverCard (name-adjacent), tweet `caret` menu, and tweet-text selection actions that save one filter rule immediately through the service worker.
- `public/`: manifest, `_locales` Manifest catalogs, extension HTML shells, content CSS, and icons.
- `assets/branding/`: ImageGen source art used to derive Chrome icon sizes.
- `scripts/`: deterministic build, validation, and packaging.

## Change procedure

1. Write or update a focused test for inference or merge behavior.
2. Change the smallest owning module. Keep localized X text and selectors in the adapter.
3. Run `npm run check`.
4. Run `npm run build && npm run validate:dist`.
5. Manually exercise English, Japanese, and Simplified Chinese fixtures or live pages when selectors change.
6. When UI copy changes, update all three runtime catalogs. When manifest metadata changes, also update `public/_locales/en`, `ja`, and `zh_CN`; verify extension pages default to the Chrome UI language, honor a stored `uiLocale` override from the language switcher, and keep injected X badges/dock on that override (or the page language when `auto`).

Side Panel interaction changes require both pure filter-model tests and a rendered React component test covering pressed state, filtered/empty lists, viewer exclusion, and the exact user-gesture X profile link.

For thread blocked-by changes, keep fixtures for explicit notices, all-three-disabled controls plus a same-layer baseline, already-visible count-less hover cards as independent evidence, normal-count hover cards, partial restrictions, missing baselines, empty engagement shells, pointer-events scroll locks, aria-hidden virtualized cells, and photo-lightbox overlays that must not borrow a timeline baseline. Keep the prominent badge immediately before the visible `@handle` without moving X's native handle or date on timestamped rows. For overlay `User-Name` stacks that have no timestamp, keep the display name and handle on one row and place the relationship badge on the next line. Cover space-between name rows that previously parked the badge after the timestamp, and verify stored known records can re-annotate it.

For Home timeline identity, keep fixtures where the display name links to `/handle/status/:id`, the visible `@handle` is missing or bidi-wrapped, only `Tweet-User-Avatar` identifies the author, a matching hover card still enriches that card, and a quoted inner card does not inherit the outer avatar handle.

For notification activity rows, keep a `data-testid="notification"` fixture whose actors come from `UserAvatar-Container-<handle>`. The badge anchor is the display-name link, or the avatar link when the row has no name link. A historical action sentence plus a Follow button stays unknown. Live unfollow plus `userFollowIndicator` on that single row can still be mutual. Grouped avatars stay separate, and a preview link with no avatar is not an actor.

For mention-heavy status threads, keep a fixture whose `tweetText` contains a large `@user` link list. Scanning must return only the post/reply authors, still honor a platform blocked notice outside `tweetText`, and must not treat in-post mentions as identity. Badge placement stays on the author `User-Name` and must not land inside `tweetText`.

Never place credentials in the extension. The current release has no X API or AI integration.

For issue reports and pull requests, follow `docs/contributing.md` or `docs/en/contributing.md` and keep user feedback on `https://github.com/interjc/chrome-x-not-brother/issues`. Installer docs default to root `README.md` (Chinese) with `README.en.md` as the English entry.
