# Localization design and maintenance

[简体中文](../localization.md) · **English**

The first-release UI switches automatically among Simplified Chinese, English, and Japanese. Localization changes presentation only. It does not take part in relationship-fact decisions and is not written into users or observations.

Localized brand names are fixed: Simplified Chinese 不是兄弟, English Not Brother, Japanese 兄貴じゃない. Japanese uses the standard characters 兄貴. Internal package names, database names, and export formats keep the stable `not-brother` token and do not follow the UI language.

## Automatic language selection

| Surface | Language source | Why |
| --- | --- | --- |
| Manifest name, description, Chrome management page | Chrome `_locales` resolution | Chosen by Chrome before the extension starts |
| Side Panel (Status / Rules / Options), Relationship Fieldbook, Chrome Options / consent context-menu entry, runtime toolbar title | `chrome.i18n.getUILanguage()` by default, overridable with `uiLocale` | Matches Chrome's own UI, and allows a manual switch on the Options tab |
| X-page relationship badges and observer dock | selected language when `uiLocale` is not `auto`; otherwise X document `<html lang>`, then Chrome UI language | Follow-the-browser stays with the host page; a manual choice updates page labels too |

Normalization: `zh-*` becomes `zh-CN`, `ja-*` becomes `ja`, `en-*` becomes `en`. Any other language falls back fully to English. The Side Panel and fieldbook language switcher defaults to **Match browser language**. Choosing English, Japanese, or Simplified Chinese writes `uiLocale` to `chrome.storage.sync`. Already-open extension pages, the toolbar title, and X-page badges and dock switch immediately. The preference is a syncable presentation setting and is not written into users/observations. It still stays on this device when Chrome is signed out or sync is off. Older settings without the field are treated as `auto`.

## Two catalogs

Chrome's Manifest parse stage needs `public/_locales/en/messages.json`, `ja/messages.json`, and `zh_CN/messages.json`. Those files only contain the extension name, short name, 132-character summary, and default toolbar title. `public/manifest.json` declares `default_locale: en` and uses `__MSG_*__` references.

Runtime UI uses `src/i18n/index.ts`. The Chinese catalog defines `MessageKey`. English and Japanese catalogs must satisfy the same key set; TypeScript rejects missing or extra entries. The module also centralizes:

- plain-text placeholder substitution such as `{count}` and `{handle}`;
- labels, short labels, and descriptions for the four visible base relationships, three attributable change events, neither-following `none`, generic changed, and internal-only unknown copy (never shown or persisted at runtime);
- observation source names such as profile, timeline, and thread;
- document-language and Chrome UI-language normalization, plus `uiLocale` preference resolution.

Relative and absolute times use `Intl.RelativeTimeFormat` and `Intl.DateTimeFormat` so the project does not hand-write three plural and date systems. CSV keeps stable English field names; `relationship_label` uses the extension language at export time.

Zero-record guidance must stay consistent across the three languages: it should say that hovering the author can read extra relationship evidence when a card has no badge. It must not be translated as the extension opening hover cards automatically, and it must not imply that Home requires a hover first. After the first observation, the dock returns to the generic "only visible page evidence is recorded" copy.

Change events also belong in the runtime catalog. A current mutual state displays Mutual. Following-only defaults to One-way. Only after history confirms they used to follow the viewer, you still follow them, and they no longer follow you do the short labels **They unfollowed / You unfollowed / They blocked you** appear (Chinese four-character shorts 对方取关 / 你已取关 / 对方拉黑; Japanese 相手が解除 / 自分が解除 / 相手がブロック). The Japanese follows-you short label is 被フォロー, not フォロー中, because フォロー中 is X's own Following control. Neither-following shows no badge. The dock does not split these events; it localizes one changed total.

Side Panel category-filter eyebrows, empty states, `aria-pressed` action copy, and the open-profile ARIA label must also be complete in all three languages. Categories reuse the relationship presentation catalog; do not keep a second set of names.

## Adding or changing copy

1. Add a semantically specific key to the Chinese catalog. Do not reuse nearby copy from a different context.
2. Finish English and Japanese in the same change. Button titles and ARIA labels are user-visible copy.
3. Call `translate()` from components. Relationships and sources use `relationshipPresentation()` and `sourceTypeLabel()`.
4. If Manifest metadata changes, update all three `_locales` files.
5. Run `npm run check`, `npm run build`, and `npm run validate:dist`.
6. Check wrapping, tooltips, empty states, and the first-run consent page at Side Panel width (~420px) and full dashboard width in all three languages.

X relationship-evidence strings are not part of the UI catalog. They stay in `src/content/x-adapter.ts` because they identify facts and need their own fixtures and false-positive tests.

## Chrome Web Store

The three `_locales` directories let Developer Dashboard offer matching listing languages. When publishing, choose English, Japanese, and Chinese (China) and fill in detailed descriptions with the same meaning. Localized screenshots and videos are optional per language, but feature claims, privacy boundaries, and permission explanations must not change with language. English is the default and fallback listing. Homepage URL and Support URL are shared across the three languages and point at the GitHub repository and Issues.

Official references: [Chrome extension i18n](https://developer.chrome.com/docs/extensions/reference/api/i18n), [Internationalize the interface](https://developer.chrome.com/docs/extensions/develop/ui/i18n), [Localize your Web Store listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing/#localize-your-listing).

## Repository documentation languages

The runtime UI is Simplified Chinese, English, and Japanese. Repository docs default to Chinese and expose an English entry, which matches common Chinese-first open-source repositories: root `README.md` stays Chinese and links to `README.en.md` at the top; developer docs default to `docs/`; English pages needed to install and contribute live in [docs/en/](README.md). The public privacy policy and terms are bilingual in `terms/` and `pages/`. Trilingual Store listing copy is in [store-listing.md](../store-listing.md). When behavior changes, update any English counterpart in the same change.
