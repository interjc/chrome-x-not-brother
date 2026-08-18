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
- For versioning, checks, packaging, Chrome Web Store preparation, or rollback, read [references/release.md](references/release.md).

## Apply invariant checks

1. Load nvm and run the Node version from `.nvmrc` before any Node command.
2. Keep X DOM knowledge inside `src/content/x-adapter.ts`.
3. Represent absent evidence as internal `unknown`; never badge, persist, import, export, or count it, and do not invent a negative relationship.
4. Discard unknown before persistence and never let it erase a known relationship; purge legacy unknown records.
5. Store data only under the extension origin; content scripts send observations to the service worker.
6. Do not add automated scrolling, profile traversal, private API calls, or X account-action clicks.
7. Run `npm run check`, `npm run build`, `npm run validate:dist`, and `npm run skills:validate` before handoff.
8. Update the matching human documentation under `docs/` when behavior or workflow changes.
9. Keep observation disabled until the current prominent-disclosure consent version has been accepted.
10. Exclude the signed-in viewer in scanning, persistence, summaries, and recent UI.
11. Keep generic unavailable-post text and user-authored content from triggering blocked-by.
12. Preserve toolbar state, install guidance, the X-page observer dock's persistent panel/floating-ball behavior, and light/dark parity.
13. Keep all runtime UI strings in `src/i18n/`, with complete English, Japanese, and Simplified Chinese catalogs; keep Manifest catalogs complete under `public/_locales/`.
14. Use pyenv, never a silent system-Python fallback, if a maintenance workflow introduces Python.
15. Infer thread blocked-by from interaction restrictions only when reply, repost, and like are all unavailable and another post has all three actionable. Independently, a fully loaded already-visible hover card with no following/follower links is blocked-by evidence. One disabled repost control is insufficient.
16. Batch lookup visible handles in the local archive so a stored known relationship can annotate a card with no fresh evidence. Never turn a missing current signal into an unknown badge.
17. Match a fully loaded visible hover card to one exact handle before using its `*-follow`, `*-unfollow`, or `userFollowIndicator` as supplemental ordinary-relationship evidence.
18. When an active observer has zero records, keep the dock and side-panel empty state explicit that reply-thread relationship evidence may require the user to hover an author; never imply that every visible author was scanned.
