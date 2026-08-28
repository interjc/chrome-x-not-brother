---
name: x-not-brother-rules
description: Read, explain, author, and edit Not Brother blacklist JSON (`not-brother-filter-rules` v1). Use when the user pastes or attaches an exported filter-rules JSON, asks to add/hide X accounts or post keywords, writes handle/display-name/content rules, checks regex safety, or prepares a file to import in Not Brother. Triggers include 黑名单, 过滤规则, filter rules, not-brother-filter-rules, 导出 json, and 导入规则.
---

# Not Brother blacklist JSON

Help the user inspect or rewrite a Not Brother filter-rules export so they can import it in the Fieldbook **Blacklist** tab.

Read [references/schema.md](references/schema.md) before changing JSON.

## Workflow

1. If the user attached or pasted JSON, parse it first. If `format` is not `not-brother-filter-rules` or `schemaVersion` is not `1`, stop and say it is not a Not Brother rules file.
2. Summarize existing rules in plain language: target, match, enabled/expiration, and count.
3. Make only the requested edits. Keep unrelated rules unchanged.
4. Return one complete, valid JSON document. Do not emit a partial patch.
5. Tell the user to import it in 不是兄弟 → 关系档案库 → **规则**, then choose **按 ID 更新** or **清空后覆盖**. Keep stable `id`s so update-by-id can replace existing rules; new ids are appended. For UI authoring, Gist / GitHub Raw / public HTTPS hosting, and the in-app import buttons, point humans to the root `README.md` section 自定义拦截规则.

## Editing rules

- Keep `format`, `schemaVersion`, unique `id`s, and the three `type` values in the schema file.
- Prefer `contains` for ordinary keywords. Use `regex` only when needed; write the JavaScript Unicode pattern without surrounding `/`.
- Normalize handles without `@`; they are case-insensitive.
- Do not add unknown fields, X numeric user ids, mute/block actions, or stored post text.
- Keep current ids when the user wants to update existing rules. Matching ids replace the whole rule on import; unknown ids are appended. If authoring a fresh file for overwrite, ids may be new.
- Rules are stored per signed-in X handle. Ask which account the file is for when it matters.

## After writing JSON

Remind the user to turn on **应用自定义拦截规则** if they want timeline hiding, and that import applies only to the currently signed-in X account.
