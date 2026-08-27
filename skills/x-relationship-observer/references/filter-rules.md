# Filter rule workflow

The canonical user-facing and protocol specification is `docs/filter-rules.md`. Keep the implementation in these boundaries:

- `src/domain/filter-rules.ts` owns the strict Zod discriminated union, limits, normalization, safe-regex validation, merge semantics, and serialization. `src/domain/filter-rule-matching.ts` owns the lightweight compiled matcher and imports schema types only so Zod and `safe-regex2` do not enter the content bundle.
- `src/storage/filter-rules.ts` stores the full `not-brother-filter-rules` v1 document only in `chrome.storage.local` under `notBrother.filterRules.v1`. Never put the rule document in `chrome.storage.sync` or IndexedDB. Only the default-false `hideByFilterRules` master switch is a synced preference.
- `src/domain/filter-rule-import.ts` accepts only public HTTPS JSON/Gist targets, omits credentials, rejects redirects, enforces timeout and response limits, and validates the final document. Do not add authentication, private Gist support, subscriptions, polling, or silent refresh.
- Remote import needs `https://*/*` only as `optional_host_permissions`. Call `chrome.permissions.request()` in the direct Load-button user gesture for the resolved source origins. Do not add persistent `host_permissions` or fetch arbitrary URLs from content-script messages.
- `src/ui/components/FilterRulesManager.tsx` owns the full dashboard editor, its detailed localized authoring tutorial, the `#filter-rules` deep-link reveal/focus behavior, file/URL import, and Blob download. Keep native labels, fieldsets, error/status text with `aria-live`, keyboard focus, mobile layout, three locales, and explicit merge versus replace. The tutorial must cover all rule targets, safe regex, expiration, OR semantics, stable-id import behavior, transient post-text privacy, and a valid complete JSON example.
- Keep an explicit “Edit rules & view guide” action in the same visual group as the `hideByFilterRules` switch wherever `TimelineFilterSettings` appears. Side Panel and Options should open the dashboard deep link; the dashboard should reveal the existing editor in place. The action remains usable when the master switch or consent-gated filtering is off.
- `src/content/x-adapter.ts` remains the only owner of X content selectors. Content text is a transient matcher input and must never enter observations, logs, rule documents, exports, or messages.
- Content scripts must obtain rules only through the service worker's `filter-rules:get` message. The worker may return the Zod-validated snapshot only to `x.com` while the current consent version and `hideByFilterRules` are active. Keep direct local-storage access and schema validation out of the content bundle.
- `src/content/timeline-hide.ts` may hide matching tweet cells only on Home, search, notifications, and threads. Profile, HoverCard, UserCell, following, and followers surfaces remain visible. Rules use OR semantics and never click X controls.

Filter-rules v1 supports exact normalized public X handles, display-name contains/safe-regex, content contains/safe-regex, enabled state, and nullable ISO expiration. X internal numeric user ids are intentionally unsupported because every visible DOM candidate cannot reliably provide them without expanding data access.

Limits are part of the protocol: 1 MiB UTF-8 JSON, 500 rules, 10,000 handles per handle rule, 256-character patterns, and 5,000-character candidate match inputs. Preserve unknown-field rejection, duplicate id/handle rejection, regular-expression compilation plus `safe-regex2`, and runtime expiration checks.

Import defaults to id-based merge: incoming ids replace matching rules and new ids append while local-only ids remain. Replace is allowed only through the user's explicit checkbox. Relationship archive backup and filter-rule JSON are separate formats and must never overwrite each other.

Any material change to content reading, remote recipients, storage, or rule behavior requires synchronized changes to `docs/filter-rules.md`, privacy/store disclosures, three runtime locales, tests, and the prominent consent version.
