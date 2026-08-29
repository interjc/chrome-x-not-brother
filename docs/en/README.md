# Developer documentation

[简体中文](../README.md) · **English**

Installer-facing copy lives in the repository root [README.en.md](../../README.en.md). The custom filter-rules section there covers UI authoring, import/export, and public hosting. This directory is the English counterpart of `docs/` for usage, contribution, development, localization, architecture, testing, maintenance, and release. The original Chinese set remains the default in [docs/](../README.md). Internal design, store-launch, and research notes that are not listed below stay in Chinese.

Agent entry points are [AGENTS.md](../../AGENTS.md) and the [project skill](../../skills/x-relationship-observer/SKILL.md). Use [x-not-brother-rules](../../skills/x-not-brother-rules/SKILL.md) when reading or rewriting exported rule JSON.

## Index

| Document | Contents |
| --- | --- |
| [Usage](usage.md) | Load, annotate, archive, import/export, clear, and feedback |
| [Contributing](contributing.md) | Product boundary, issues, setup, checks, and pull requests |
| [Development](development.md) | nvm, install, build, layout, and daily loop |
| [Localization](localization.md) | zh/en/ja switching, catalog boundaries, repository docs, Store locales |
| [Custom filter rules](filter-rules.md) | filter-rules JSON v1, matching, limits, and import permissions |
| [Architecture](architecture.md) | Runtime data flow, module boundaries, and safety constraints |
| [Testing](testing.md) | Automated checks and the Chrome manual acceptance list |
| [Maintenance](maintenance.md) | X DOM drift, data migration, and incident handling |
| [Release](release.md) | Versioning, checks, packaging, Store prep, and rollback |
| [Privacy](privacy.md) | Pointer to the bilingual public privacy policy and terms |

Chinese-only companion docs, still linked from [docs/README.md](../README.md): feasibility, requirements, design, data model, first-time Store launch, Chrome Web Store operations, trilingual Store listing copy, and X-extension resilience research.

Public privacy and terms HTML is published from [pages/](../../pages/) on GitHub Pages:

- https://interjc.github.io/chrome-x-not-brother/privacy.html
- https://interjc.github.io/chrome-x-not-brother/terms.html

## Project layout

```text
src/content/       X-page evidence extraction and badge injection
src/background/    service worker and persistence message entry
src/domain/        relationship resolution, merge semantics, import/export
src/i18n/          zh/en/ja runtime catalogs, locale normalization, presentation
src/storage/       IndexedDB and extension settings
src/ui/            Side Panel, Options page, and full fieldbook
assets/branding/   brand source art
assets/store/      Chrome Web Store icons, screenshots, and promo images
pages/             GitHub Pages: public privacy policy and terms
public/            Manifest, HTML, content CSS, and icons
scripts/           build, validate, package
skills/            project-level development skills
docs/              Chinese developer and maintainer docs (default)
docs/en/           English counterparts for install and contribution
terms/             public privacy policy and terms source
```

## Quality commands

Load nvm first, then run from the repository root.

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm run check             # TypeScript + unit tests
npm run test:coverage     # coverage report
npm run build             # production extension in dist/
npm run validate:dist     # manifest, permissions, files
npm run skills:validate   # project skill structure
npm run package           # ZIP in artifacts/ (replaces previous not-brother-*.zip)
npm run version:bump -- patch   # bump version and insert Store release-note headings
npm run release           # full local release build; upload artifacts/not-brother-<version>.zip
```
