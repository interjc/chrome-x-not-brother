---
name: x-relationship-observer
description: Develop, test, maintain, use, or release the Not Brother Manifest V3 Chrome extension for passive X relationship annotation and local observation history. Use for repository changes involving the X DOM adapter, relationship inference, IndexedDB schema, injected badges, side panel, dashboard, privacy boundary, packaging, troubleshooting, or release preparation.
---

# X Relationship Observer

Preserve the extension's narrow contract: annotate relationship evidence already visible during normal browsing and collect observations locally. Never automate X navigation or account actions.

## Select the workflow

- For code changes or local setup, read [references/development.md](references/development.md).
- For selector drift, database migration, troubleshooting, or dependency work, read [references/maintenance.md](references/maintenance.md).
- For loading, browsing, reviewing, filtering, importing, exporting, or clearing data, read [references/usage.md](references/usage.md).
- For versioning, checks, packaging, Chrome Web Store preparation, or rollback, read [references/release.md](references/release.md). First-time store launch steps for a human operator are in `docs/deploy.md`.
- For issue reports, pull requests, or open-source contribution constraints, read [references/contributing.md](references/contributing.md).

## Apply invariant checks

1. Load nvm and run the Node version from `.nvmrc` before any Node command.
2. Keep X DOM knowledge inside `src/content/x-adapter.ts`. Keep already-loaded page UI store / tweet fiber relationship reads in `src/content/page-store.ts`.
3. Represent absent evidence as internal `unknown`; never badge, persist, import, export, or count it, and do not invent a negative relationship.
4. Discard unknown before persistence and never let it erase a known relationship; purge legacy unknown records.
5. Store data only under the extension origin; content scripts send observations to the service worker.
6. Do not add automated scrolling, profile traversal, new private API/GraphQL calls, or X account-action clicks. Reading `following` / `followed_by` / `blocked_by` already loaded into the current page UI store, tweet fibers, or GraphQL responses the page itself already completed is allowed.
7. Run `npm run check`, `npm run build`, `npm run validate:dist`, and `npm run skills:validate` before handoff.
8. Update the matching human documentation under `docs/` when behavior or workflow changes.
9. Keep observation disabled until the current prominent-disclosure consent version has been accepted.
10. Exclude the signed-in viewer in scanning, persistence, summaries, and recent UI.
11. Keep generic unavailable-post text and user-authored content from triggering blocked-by.
12. Preserve toolbar state, install guidance, the X-page observer dock's persistent panel/floating-ball behavior, and light/dark parity.
13. Keep all runtime UI strings in `src/i18n/`, with complete English, Japanese, and Simplified Chinese catalogs; keep Manifest catalogs complete under `public/_locales/`.
14. Use pyenv, never a silent system-Python fallback, if a maintenance workflow introduces Python.
15. Infer thread blocked-by from interaction restrictions only when reply, repost, and like controls are all present but unavailable and another post has all three actionable. Missing controls are not disabled controls. Independently, a fully loaded already-visible hover card with no following/follower links is blocked-by evidence. One disabled repost control is insufficient.
16. Batch lookup visible handles in the local archive so a stored known relationship can annotate a card with no fresh evidence. Never turn a missing current signal into an unknown badge.
17. Match a fully loaded, semantically visible hover card to one exact handle before using its `*-follow`, `*-unfollow`, or `userFollowIndicator` as supplemental ordinary-relationship evidence; reject hidden, inert, or `aria-hidden` stale cards.
18. Home timeline cards should be annotated from already-loaded page UI store relationship fields without requiring a hover card. When an active observer has zero records, keep empty-state copy from implying every author was scanned; hover remains a fallback when the page store has no complete facts for that handle.
19. Keep page detection hybrid and bounded: observe semantic DOM mutations, fallback-rescan the visible active page every 2 seconds, rescan on focus/visibility restore, serialize overlapping triggers, mark observation signatures only after confirmed persistence so transient failures retry, and stop every timer/listener on context invalidation.
20. Broadcast archive mutations and new observations through the service worker so open X tabs invalidate local relationship caches; do not request the `tabs` permission, treat tabs without a content receiver as normal, and preserve signatures across deletion invalidation.
21. Derive specific change display from stored facts: following-only to mutual is followed-back, mutual to following-only is unfollowed-you, and a known non-blocked state to blocked-by is blocked-you. Keep other transitions generic and the dock count aggregated; do not add a schema field for this presentation state.
22. Keep Side Panel relationship counts and the changed callout as keyboard-accessible toggle filters with explicit pressed state and filtered empty copy. User rows may open their standard X profile only through an explicit click or keyboard activation; never pre-open or traverse profiles.
23. Keep open Side Panel and dashboard settings synchronized through the shared `chrome.storage.onChanged` hook so viewer exclusion and observer state cannot go stale across extension contexts; remove the listener on unmount.
