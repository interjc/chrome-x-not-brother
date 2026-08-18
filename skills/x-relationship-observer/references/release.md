# Release workflow

1. Confirm the scope still performs only annotation and local collection.
2. Load nvm and bump the version with `npm run version:bump -- patch` (or `minor` / `major` / `x.y.z`) so `package.json` and `public/manifest.json` stay aligned.
3. Fill the new three-language release-note stubs in `docs/store-listing.md`. Update user, maintenance, privacy, terms, `pages/` HTML, and release documentation where necessary.
4. Load nvm and run:

```bash
npm ci
npm run release
```

Use `npm run release -- --skip-pages` only when GitHub Pages cannot be reached. The uploadable archive is `output/not-brother-<version>.zip`; `artifacts/` keeps historical copies.

6. Load `dist/` unpacked in a clean Chrome profile and execute `docs/testing.md`.
7. Inspect the ZIP; it must contain `manifest.json` at the archive root.
8. For Chrome Web Store submission, disclose the single-site host access and local relationship data accurately. The privacy-policy URL must be the GitHub Pages HTML page, not a GitHub blob link. Re-check current X terms and Chrome Web Store policies before every public release.
9. Require Chrome 116+, verify toolbar `ON`/`!`, install onboarding, X-page dock opening, and light/dark screenshots.
10. Verify automatic UI switching for Chrome English, Japanese, and Simplified Chinese, then test X in a different supported language. Inspect all three `_locales` catalogs and prepare consistent localized Store listings/screenshots.

Use `docs/release.md` for later updates. Use `docs/deploy.md` only for first-launch account, Pages, and Dashboard history.

Use `docs/chrome-web-store.md` for the current account, listing, visual asset, privacy disclosure, submission, update, and rollback checklist.

Use `docs/store-listing.md` for ready-to-paste English, Japanese, and Simplified Chinese listing copy, release notes, permission justifications, the privacy-practices worksheet, reviewer instructions, and the GitHub homepage / Issues / privacy-policy URLs. Reconcile every claim with the current code before submission.

The distribution validator requires each localized Manifest description to appear exactly as the matching Store summary and requires release-note headings for the current version in all three languages. Update these together with every version bump.

Rollback by reinstalling the prior archive. Do not clear IndexedDB during rollback unless a migration is proven incompatible and the user explicitly exports or accepts local data loss.
