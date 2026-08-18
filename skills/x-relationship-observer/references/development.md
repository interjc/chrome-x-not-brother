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

- `src/content/`: inspect already-rendered X DOM, combine semantic mutation events with a visible-page 2-second fallback rescan, serialize triggers, normalize evidence, discard internal unknown, inject badges, and send known observation drafts whose signatures are committed only after persistence succeeds.
- `src/content/observer-panel.ts`: render the X-page state/summary dock, its accessible panel/floating-ball toggle, and forward its user gesture to Side Panel.
- `src/background/`: persist messages, remove the signed-in viewer, expose summaries, show toolbar state, and initialize Chrome side-panel/onboarding behavior.
- `src/domain/`: types, relationship resolution, data merge semantics, derived followed-back/unfollowed-you/blocked-you presentation, import, and export.
- `src/i18n/`: type-checked English, Japanese, and Simplified Chinese runtime catalogs, locale resolution, relationship labels, and source labels.
- `src/storage/`: IndexedDB access and local settings.
- `src/ui/`: side panel, its pure filter model, user-gesture profile links, dashboard, shared components, presentation, and a shared storage-change-aware settings hook.
- `public/`: manifest, `_locales` Manifest catalogs, extension HTML shells, content CSS, and icons.
- `assets/branding/`: ImageGen source art used to derive Chrome icon sizes.
- `scripts/`: deterministic build, validation, and packaging.

## Change procedure

1. Write or update a focused test for inference or merge behavior.
2. Change the smallest owning module. Keep localized X text and selectors in the adapter.
3. Run `npm run check`.
4. Run `npm run build && npm run validate:dist`.
5. Manually exercise English, Japanese, and Simplified Chinese fixtures or live pages when selectors change.
6. When UI copy changes, update all three runtime catalogs. When manifest metadata changes, also update `public/_locales/en`, `ja`, and `zh_CN`; verify extension pages follow Chrome UI language and injected X UI follows the page language.

Side Panel interaction changes require both pure filter-model tests and a rendered React component test covering pressed state, filtered/empty lists, viewer exclusion, and the exact user-gesture X profile link.

For thread blocked-by changes, keep fixtures for explicit notices, all-three-disabled controls plus normal-page baseline, already-visible count-less hover cards as independent evidence, normal-count hover cards, partial restrictions, and missing baselines. Keep the prominent badge in the same row as the display name without moving X's native `@handle` or date, and verify stored known records can re-annotate it.

Never place credentials in the extension. The current release has no X API or AI integration.
