# Repository instructions

## Product boundary

This repository builds **Not Brother**, a Chrome Manifest V3 extension that observes relationship evidence already visible while the user browses `x.com`.

The extension has exactly two product responsibilities:

1. annotate visible X users with a relationship badge;
2. collect the observed relationship evidence in the extension's local database.

Do not add code that automatically scrolls X, opens profiles, calls private X endpoints, or clicks Follow, Unfollow, Block, Mute, or any other X account-action control. X account mutations are outside the product boundary.

A standard X profile link in extension UI may open only from an explicit user click or keyboard activation. Never pre-open, prefetch, traverse, or batch-navigate profile pages.

## Node environment

Node.js is installed and managed through **nvm**. Non-interactive shells on this machine may otherwise resolve the system Node 8 binary, which is too old for this project.

Before every Node, npm, or npx command, load nvm and select the repository version:

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
```

The authoritative version is `.nvmrc` (`24.19.0`). Do not replace the nvm workflow with a system-wide Node installation. Keep `package.json#engines.node` aligned with `.nvmrc`.

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

Use `npm run package` only when preparing a loadable release archive.

## Architecture rules

- Keep X DOM selectors and localized text matching inside `src/content/x-adapter.ts`.
- Read already-loaded `following` / `followed_by` / `blocked_by` for visible authors from the current page UI store, tweet fibers, and GraphQL responses the page itself already completed via `src/content/page-store.ts`. Do not send new GraphQL requests or treat a missing store entity as not-following.
- Treat missing relationship evidence as the internal `unknown` result; never badge, persist, import, export, or count it, and never infer a negative relationship from an unrelated timeline card.
- Store extension data through the background service worker. Content scripts must not use the page origin's IndexedDB.
- Preserve observation history. A known state may replace another known state; an internal `unknown` result must be discarded before persistence and must not erase a known state.
- Derive change presentation without changing stored relationship facts: following-only to mutual is followed-back, mutual to following-only is unfollowed-you, and any known non-blocked state to blocked-by is blocked-you. Keep ambiguous or viewer-driven transitions generic, and keep the dock change statistic aggregated.
- Use text content and DOM APIs for injected UI. Do not inject HTML strings into X.
- Keep all runtime code bundled locally. Manifest V3 forbids remotely hosted executable code.
- Route every user-visible runtime string through `src/i18n/`; keep English, Japanese, and Simplified Chinese catalogs complete. Extension pages follow the Chrome UI language, while UI injected into X follows the page language.
- Request the minimum Chrome permissions necessary for the feature.
- Keep the observer disabled until the current prominent-disclosure consent version has been accepted.
- Exclude the signed-in viewer at scan, storage, summary, and UI layers; never show the viewer in recent observations.
- Treat generic unavailable-post text and user-authored post content as insufficient blocked-by evidence.
- In a thread, classify blocked-by from engagement restrictions only when reply, repost, and like are all unavailable while another post on the same page has all three controls actionable. Independently, a fully loaded, already-visible hover card that omits all following/follower links is blocked-by evidence. A single disabled repost control is insufficient.
- Use a fully loaded visible hover card only for the matching handle. Its stable follow/unfollow control and `userFollowIndicator` may supplement the underlying card's ordinary relationship facts; never leak one hover card's facts to another author.
- Query the local archive for handles already visible on the page. A known stored relationship may annotate a card whose current DOM has no fresh evidence; this is not an unknown badge.
- Preserve toolbar state, first-install guidance, the X-page observer dock and its persistent panel/floating-ball preference, and light/dark theme parity.
- Preserve the hybrid page monitor: semantic DOM mutations plus a 2-second fallback rescan only while the consented observer page is visible, immediate focus/visibility recovery, single-flight processing, signature deduplication only after confirmed persistence so transient failures retry, and complete timer/listener teardown on extension-context invalidation.
- Preserve cross-tab cache invalidation through service-worker `data:changed` broadcasts. Do not add the `tabs` permission; tabs without a content-script receiver are expected, and intentional archive deletion must not clear observation signatures and immediately reinsert unchanged evidence.
- Keep extension pages subscribed to `chrome.storage.onChanged` through the shared settings hook so viewer exclusion and observer controls remain consistent across an already-open Side Panel, dashboard, and X tabs.

## Documentation

Update the relevant file under `docs/` and the matching project skill reference under `skills/x-relationship-observer/references/` when behavior or workflow changes. Keep the documentation index in `README.md` accurate.
