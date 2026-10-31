# Release

[简体中文](../release.md) · **English**

The first Store submission is already in review. This document covers **every later update**. First-time account, Pages, and Dashboard field steps are in the Chinese [first-time launch guide](../deploy.md).

## Already in place

- The developer account is declared as non-trader. Change that only if paid features or a product-site funnel appear later.
- The public privacy policy is GitHub Pages, not a repository `blob` link. The Store does not accept `github.com/.../blob/...`.
- Privacy policy: https://interjc.github.io/chrome-x-not-brother/privacy.html
- Terms of use: https://interjc.github.io/chrome-x-not-brother/terms.html
- Store Homepage is the GitHub repository; Support is Issues.
- Category is **Productivity**.
- The upload ZIP is only written to gitignored `artifacts/not-brother-<version>.zip`. Each package run deletes older `not-brother-*.zip` files in that directory first.

Source copy lives in `terms/`. Public HTML lives in `pages/`. After changing terms or privacy, update both, push `main`, wait for the `Deploy GitHub Pages` Action to go green, then confirm the public pages in a private window.

## Shipping another version

1. Features stay annotation and local collection.
2. Bump version and package:

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
```

`.nvmrc` provides the recommended Node version; versions are not rigidly restricted in configuration files, so running `nvm use` is sufficient.

You can bump the version and run the full release pipeline in one command:
```bash
npm run release:patch   # or minor / major
```
Or run step by step:
```bash
npm run version:bump -- patch
npm run release
```

`version:bump` updates `package.json`, `package-lock.json`, and `public/manifest.json` together, and inserts empty trilingual release-note headings in [store-listing.md](../store-listing.md). Fill in the new version's points. All three languages must say the same thing.

3. If permissions, collection scope, or the consent flow changed: update `terms/` and `pages/`, raise the consent version, then package.
4. `npm run release` automatically runs:
   - `npm run check` (TypeScript + unit tests)
   - `npm run test:coverage` (coverage verification)
   - `npm run skills:validate` (checks project skills)
   - `npm run package` (builds `dist/`, validates constraints, creates ZIP)
   - `npm run verify:pages` (checks GitHub Pages privacy policy and terms; offline use `--skip-pages`)

5. The upload file is:

`artifacts/not-brother-<version>.zip`

The same package run also writes `artifacts/not-brother-safari-<version>.zip` (the same `dist/` with the Safari manifest swapped in). It is not uploaded to the Chrome Web Store; GitHub Releases distribute it automatically, see "GitHub Releases and Safari" below.

Do not hand-zip `dist/`. After unzip, the root must contain `manifest.json` directly.

6. Load unpacked `dist/` in a clean Chrome profile and run the relevant steps in [Testing](testing.md).
7. Dashboard → the item → Package → upload the new ZIP. Update the listing release notes in all three languages. Leave privacy fields alone if they did not change. Turn off automatic publish, then submit for review.
8. After approval, click Publish within 30 days. New permissions make already-installed users authorize again.
9. Push the version commit to `main` (or merge the PR that contains it). A `package.json` version change publishes the GitHub Release automatically.

`npm run validate:dist` still checks: trilingual summaries stay within 132 characters and match store-listing; the current version's trilingual release-note headings are present.

## Individual scripts

Load nvm first, then run from the repository root.

| Command | What it does |
| --- | --- |
| `npm run check` | TypeScript + unit tests |
| `npm run test:coverage` | coverage |
| `npm run build` | write `dist/` |
| `npm run validate:dist` | check dist, permissions, Store URLs, version copy |
| `npm run skills:validate` | check project skills |
| `npm run package` | build, validate, delete old ZIPs, write the current version's Chrome and Safari ZIPs to `artifacts/` |
| `npm run verify:pages` | fetch the public privacy policy and terms pages |
| `npm run version:bump -- patch` | bump version, sync package-lock, and insert Store release-note headings |
| `npm run release` | full release pipeline; checks, builds, and creates `artifacts/not-brother-<version>.zip` |
| `npm run release:patch` | bump patch version and run full release pipeline |

Matching files live in `scripts/`: `build.mjs`, `validate-dist.mjs`, `package.mjs`, `verify-pages.mjs`, `bump-version.mjs`, `release.mjs`.

## Remember at Store update time

- The privacy policy URL must be `https://interjc.github.io/chrome-x-not-brother/privacy.html`.
- Persistent site access still only explains `https://x.com/*`. `contextMenus` and the optional HTTPS permission for rule import must also be justified separately per [store-listing.md](../store-listing.md).
- Do not put the author X / profile links from the GitHub README into the Store summary as promotion.
- Store approval does not mean X permits extra behavior.

Policy and field details: [Chrome Web Store listing guide](../chrome-web-store.md) (Chinese).

## GitHub Releases and Safari

`.github/workflows/release.yml` runs when `package.json` changes on `main`. If `v<version>` has no Release yet, it:

1. runs `npm ci`, `npm run check`, and `npm run package` on Linux;
2. creates the `v<version>` tag and Release with the Chrome ZIP and the Safari extension-folder ZIP, using the English release notes from [store-listing.md](../store-listing.md) (`scripts/release-notes.mjs`);
3. when the repository variable `SAFARI_SIGNING` is `true`, builds the Safari app on macOS, signs it with Developer ID, notarizes it, and attaches it to the same Release as `Not-Brother-Safari-<version>.zip`.

Versions that already have a Release are skipped, so ordinary dependency bumps do not publish again. Older untagged versions can be published with **Run workflow** on the Actions page; after fixing a signing failure, tick `safari_only` to rebuild only the signed app.

The Chrome Web Store upload stays manual. Signing setup is in [Apple signing keys](../apple-signing.md) (Simplified Chinese); the Safari plan is in [Safari support](../safari.md) (Simplified Chinese).

## Rollback

Each package run keeps only the current ZIP. Before rolling back, have users export JSON, then take an older package from git history or the Store backend. After loading the old package, confirm the schema still reads. Do not treat a silent IndexedDB wipe as a routine rollback.
