# Release workflow

1. Confirm the scope still performs only annotation and local collection.
2. Update `package.json` and `public/manifest.json` to the same semantic version.
3. Update user, maintenance, privacy, terms, and release documentation where necessary. Public legal copy lives in `terms/`.
4. Load nvm and run:

```bash
npm ci
npm run check
npm run build
npm run validate:dist
npm run skills:validate
npm run package
```

5. Load `dist/` unpacked in a clean Chrome profile and execute `docs/testing.md`.
6. Inspect the generated `artifacts/not-brother-<version>.zip`; it must contain manifest files at the archive root.
7. For Chrome Web Store submission, disclose the single-site host access and local relationship data accurately. Re-check current X terms and Chrome Web Store policies before every public release.
8. Require Chrome 116+, verify toolbar `ON`/`!`, install onboarding, X-page dock opening, and light/dark screenshots.
9. Verify automatic UI switching for Chrome English, Japanese, and Simplified Chinese, then test X in a different supported language. Inspect all three `_locales` catalogs and prepare consistent localized Store listings/screenshots.

Use `docs/deploy.md` for the first Chrome Web Store launch: remaining screenshots, Dashboard clicks, and the operator checklist.

Use `docs/chrome-web-store.md` for the current account, listing, visual asset, privacy disclosure, submission, update, and rollback checklist.

Use `docs/store-listing.md` for ready-to-paste English, Japanese, and Simplified Chinese listing copy, release notes, permission justifications, the privacy-practices worksheet, reviewer instructions, and the GitHub homepage / Issues / privacy-policy URLs. Reconcile every claim with the current code before submission.

The distribution validator requires each localized Manifest description to appear exactly as the matching Store summary and requires release-note headings for the current version in all three languages. Update these together with every version bump.

Rollback by reinstalling the prior archive. Do not clear IndexedDB during rollback unless a migration is proven incompatible and the user explicitly exports or accepts local data loss.
