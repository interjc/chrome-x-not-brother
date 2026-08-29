# Custom filter rules v1

[简体中文](../filter-rules.md) · **English**

This document defines Not Brother's `not-brother-filter-rules` JSON v1. The authoritative validator in code is `src/domain/filter-rules.ts`. Import files must pass a complete Zod check; unknown fields are rejected.

Installer-facing authoring, the in-app editor, import/export, and Gist / GitHub Raw / public HTTPS hosting notes are in root [README.en.md](../../README.en.md#custom-filter-rules).

## Behavioral boundary

- The master switch `hideByFilterRules` defaults off and is stored as a small preference in `chrome.storage.sync`. The rule document does not sync. It stays in this Chrome profile's `chrome.storage.local`, namespaced by the signed-in X account's lowercase handle: `notBrother.filterRules.v1.ns.{handle}`. Matching and editing use only that account's rules after an X account switch. A legacy un-namespaced document is migrated into the account the first time a handle is identified.
- When the user has no local rule document yet, the fieldbook or side panel Rules page loads [`config/filter-rules-default.json`](../../config/filter-rules-default.json) as an editable example and does not turn the master switch on. The default import URL is `rules/filter-default.json` in the community repository [chrome-x-not-brother-rules](https://github.com/interjc/chrome-x-not-brother-rules). The rule-authoring guide stays collapsed by default.
- Any one enabled, unexpired match hides the post. Rules are OR. The only v1 action is `hide`. The extension does not click X mute, block, or other controls.
- Only currently loaded tweet cells on Home, search, notifications, and post threads are processed. Profile pages, HoverCards, UserCells, and following/followers lists stay visible.
- Content rules read visible text from the current candidate post for in-place matching only. Post text is not stored, not written into observation history, not sent to the developer or a rule source, and not fetched with extra X requests.
- The content script asks the service worker for a Zod-validated rule snapshot only when the master switch is on and the consent version is current. It does not read or validate the full local document itself. Post text stays in page memory and is not sent with the snapshot or match results.
- Expired rules remain in the editor and exports for review or renewal, but they no longer match. The visible-page 2-second fallback rescan restores posts after expiry.

v1 uses the X handle as the public, stable, page-confirmable account identifier. Matching strips an optional `@` and lowercases. X's internal numeric user id is out of v1: the extension cannot guarantee that every currently visible DOM candidate can obtain it without a new network request.

## JSON shape

```json
{
  "format": "not-brother-filter-rules",
  "schemaVersion": 1,
  "name": "My filters",
  "description": "Example rules",
  "rules": [
    {
      "id": "accounts-example",
      "label": "Known accounts",
      "enabled": true,
      "expiresAt": null,
      "type": "user_handles",
      "handles": ["example", "another_user"]
    },
    {
      "id": "name-example",
      "label": "Display-name keyword",
      "enabled": true,
      "expiresAt": "2027-01-01T00:00:00.000Z",
      "type": "display_name",
      "match": {
        "mode": "contains",
        "value": "official",
        "caseSensitive": false
      }
    },
    {
      "id": "content-example",
      "label": "Giveaway posts",
      "enabled": true,
      "expiresAt": null,
      "type": "content",
      "match": {
        "mode": "regex",
        "value": "giveaway\\s+(today|now)",
        "caseSensitive": false
      }
    }
  ]
}
```

### Shared fields

| Field | Constraints | Meaning |
| --- | --- | --- |
| `id` | 1–64 characters; starts with a letter or digit, then letters, digits, `.`, `:`, `_`, `-`; unique in the rule set | Rule identity; kept on export; update-by-id import replaces the whole rule with the same id |
| `label` | 1–120 characters | Name shown to the user |
| `enabled` | boolean | Whether the rule takes part in matching |
| `expiresAt` | `null` or a timezone-aware ISO 8601 time | `null` means never; matching stops at the expiry instant |
| `type` | `user_handles`, `display_name`, `content` | Discriminated union |

`user_handles` also has `handles`: at least 1 and at most 10,000 legal X handles, unique after normalization inside one rule.

`display_name` and `content` also have `match`:

- `mode` is `contains` or `regex`;
- `value` is 1–256 characters;
- `caseSensitive` controls case explicitly;
- all text is Unicode NFKC-normalized first; each field to match is capped at 5,000 characters;
- regular expressions use JavaScript Unicode mode. Import both compiles them and rejects expressions that may catastrophic-backtrack via `safe-regex2`.

The whole JSON is at most 1 MiB UTF-8, with at most 500 rules. Top-level `name` is 1–120 characters; `description` is at most 500 characters.

## Editing, import, and export

The Side Panel Rules tab, Chrome Options page, expanded X observer dock, and relationship fieldbook all expose filter-rule entry points. **Edit rules** on Side Panel Options switches to the Rules tab. **Edit rules** on the dock prefers the side panel Rules tab and falls back to `dashboard.html#filter-rules`. Inside the fieldbook it opens the Rules page in place. The entry does not depend on the master switch and does not add Chrome permissions. The dock also shows whether the current account's rules are applying, how many are active, this-page intercepts, and lifetime intercepts. Those counts come from service worker `filter-rules:status` and `hide-stats:increment`. Rule bodies and post text are not sent down to the X page. The dock omits this row before consent. After consent, **Not Brother!** next to the name on an avatar HoverCard, the same item in a post's top-right three-dot menu, and post-text **Hide keyword** write and save the matching handle or contains rule immediately through `filter-rules:quick-add`. If the master switch is off, that path turns it on. X account-action controls are not clicked.

The relationship fieldbook provides the full form editor and a collapsed-by-default authoring guide. The guide covers the three match targets, contains versus safe regex, case, per-rule enablement, expiration, OR semantics, update-by-id versus clear-and-replace import, the content privacy boundary, and a complete JSON v1 example. Users do not need to hand-write JSON to use the form. `skills/x-not-brother-rules` can help an AI read or edit exported JSON. The save button sits at the bottom of the editor and uses the primary color. Unsaved edits ask for confirmation before leaving the Rules page, closing the tab, or going back. The whole draft is Zod-validated before save; a failed validation does not overwrite stored rules. Export uses a browser Blob download and does not request the `downloads` permission.

Import supports:

1. a user-chosen local `.json` file;
2. a public HTTPS JSON URL;
3. a public Gist page URL, Gist API URL, or a single Raw URL.

Every import must choose **Update by ID** or **Clear and replace**. Exported JSON includes each rule's `id`. Update by ID replaces any rule with the same id and appends ids that are new; rules that exist only in the current document are kept. Clear and replace substitutes the whole current-account rule set with the imported file. A Gist with several JSON files must use the target file's Raw URL so the extension does not guess.

A remote fetch happens only after the user clicks **Load URL**. There is no saved subscription and no background refresh. The Manifest declares `https://*/*` only as `optional_host_permissions`. Before the first visit to a source, `chrome.permissions.request()` asks for that host inside the same user gesture. Requests use HTTPS, `credentials: omit`, no redirects, a 12-second timeout, and a streaming size cap. Gist pages are read through the public GitHub Gist API. When the API truncates a file, the only allowed follow-up is the `gist.githubusercontent.com` Raw URL GitHub returned. Private or authenticated sources are not supported.

## Versioning and compatibility

`format` and `schemaVersion` are required constants. Future incompatible shapes use a new schema version with an explicit migration. Field meaning must not change silently under v1. The rule document is independent of the relationship-database backup. Importing relationship-archive JSON does not overwrite filter rules, and importing filter rules does not modify users/observations.
