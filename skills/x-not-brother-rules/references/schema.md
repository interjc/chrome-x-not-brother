# not-brother-filter-rules v1

Canonical validator: `src/domain/filter-rules.ts`. Protocol notes: `docs/filter-rules.md`.

## Document

```json
{
  "format": "not-brother-filter-rules",
  "schemaVersion": 1,
  "name": "My blacklist rules",
  "description": "",
  "rules": []
}
```

| Field | Constraint |
| --- | --- |
| `format` | exactly `not-brother-filter-rules` |
| `schemaVersion` | exactly `1` |
| `name` | 1–120 characters |
| `description` | up to 500 characters; default `""` |
| `rules` | max 500; `id` unique in the file |
| file size | max 1 MiB UTF-8 |

Unknown fields are rejected. The only action is hide (display-only). Exports include each rule `id`. Import can update matching ids in place and append unknown ids, or replace the whole document.

## Common rule fields

| Field | Constraint |
| --- | --- |
| `id` | 1–64; starts with letter or digit; then letters, digits, `.` `:` `_` `-` |
| `label` | 1–120 characters |
| `enabled` | boolean |
| `expiresAt` | `null` or timezone-aware ISO-8601; `null` means never |
| `type` | `user_handles` \| `display_name` \| `content` |

## Type-specific fields

`user_handles`: `handles` is 1–10,000 public X handles. `@` is optional; matching lowercases. No numeric user id.

`display_name` and `content`: `match` is

```json
{ "mode": "contains", "value": "keyword", "caseSensitive": false }
```

or `"mode": "regex"`. `value` is 1–256 characters. Text is Unicode NFKC-normalized. Regex is JavaScript Unicode, compiled without wrapping slashes, and rejected if unsafe (`safe-regex2`) or too slow.

## Example

```json
{
  "format": "not-brother-filter-rules",
  "schemaVersion": 1,
  "name": "Example",
  "description": "",
  "rules": [
    {
      "id": "spam-handles",
      "label": "Spam accounts",
      "enabled": true,
      "expiresAt": null,
      "type": "user_handles",
      "handles": ["example_bot"]
    },
    {
      "id": "giveaway-text",
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

In-repo sample: `config/filter-rules-default.json`.
