# Usage

[简体中文](../usage.md) · **English**

## Load a development build

1. Produce `dist/` with the [development guide](development.md).
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Choose **Load unpacked** and select the repository `dist/`.
5. Install opens the local onboarding page automatically. You can also pin Not Brother to the toolbar.

When you update a development build, click **Reload** on `chrome://extensions` and then refresh any X tabs that are already open. Otherwise the old content script in those tabs is marked `Extension context invalidated`. From 0.4.1 the old script shuts itself down, but a refresh is still required to inject the new version.

The onboarding page and Side Panel explain which x.com information is read, why, and where it is stored. The observer stays off until you click **Agree and start**; it then keeps running. Before consent, the expanded X dock, the amber button beside the floating ball, and the toolbar-icon item **Review privacy notice and agree…** all open that notice. None of those entries records consent by itself. You can pause later at any time.

Toolbar badge in the lower-right of the icon: acid-yellow `ON` means observing; gray `!` means paused; amber `!` means first-run setup is not finished.

## Interface language

The extension supports Simplified Chinese, English, and Japanese. The Side Panel, full fieldbook, and toolbar copy default to the Chrome UI language. After you open the Side Panel or fieldbook, the language switcher can pin English, Japanese, or Simplified Chinese. That choice is stored in this Chrome profile. A pinned language also updates relationship badges and the observer dock on X. **Match browser language** keeps those page labels on the X document language. Unsupported locales fall back to English.

## Annotation and collection

Open `https://x.com` and browse normally. The extension only processes user regions that are already rendered. It does not auto-scroll or open other pages.

Badge meanings are in the Chinese [design doc](../design.md). Missing page evidence produces no "unknown" badge and no collection. **Blocked you** can come from an explicit notice when you visit a profile. In a post thread, it can also come from reply, repost, and like all being drawn and explicitly disabled while another post in the same overlay or page layer is fully actionable, or from a fully loaded author hover card that omits following and follower counts. A single disabled repost, generic "this post is unavailable", or an unstable engagement bar while a photo lightbox is scrolling is not evidence. Once confirmed on any path, the local record can re-annotate the same handle later, including after the hover card closes.

Following-only and blocked-by use an enhanced badge immediately before the thread `@handle`, with amber or red emphasis on the ID cluster. X's native `@handle` and date stay in place. The extension does not click those native controls.

Home timeline posts usually omit follow/unfollow buttons, but X already puts `following` / `followed_by` into the current page UI store when the timeline loads. The extension reads those already-loaded fields for authors visible on the page. It does not make extra X requests for this and does not auto-hover. Follow controls or author hover cards already in the DOM still win.

Likes, reposts, and follows on the notifications page get the same badge beside the person's name. The extension recognizes the account from that notification's avatar. The relationship comes from follow controls already drawn on the row, user fields the current page already loaded, or the local archive. A historical sentence such as "so-and-so followed you" does not rewrite the current relationship.

If a visible card still has no badge, hover the author avatar or ID and wait for X's author card to finish loading. The extension reads follow/unfollow controls and the "follows you" indicator already shown on that same-handle card. That is a fallback, not a requirement for Home recognition.

While observation has just started and the count is still zero, the page dock and Side Panel say you can hover the author for extra relationship evidence when a card has no badge. That is not a claim that the extension opens every hover card.

Relationship evidence usually triggers recognition from a DOM mutation immediately. If X reused nodes or did not emit a catchable structural change, a visible running page falls back to a rescan within about 2 seconds. Backgrounded pages pause that periodic rescan; returning to the page or regaining focus triggers an immediate pass. The rescan does not scroll, and the same evidence does not append history every 2 seconds.

The signed-in account never enters observations, the recent list, or statistics. The bottom-right of X shows the Not Brother observer dock. **View details** opens the Side Panel for the current tab; activate it again to collapse. After consent, the expanded dock also shows whether that account's filter rules are applying, how many rules are active, this-page intercepts, and lifetime intercepts, plus **Edit rules** to open the side panel Rules tab (fieldbook rules page as fallback). The top-right `×` collapses it to an NB floating ball with a status dot, still in the bottom-right corner. X's own Chat/Grok buttons shift up so they do not cover the ball or the timeline. Activate the ball to restore the overview. That preference stays on this device across refresh. If Chrome refuses a programmatic open, the dock tells you to click the toolbar NB icon instead.

## Optional timeline filters

All three filters default off. Turn them on in the side panel **Options** tab (toolbar icon right-click → **Options** lands here) or in the relationship fieldbook:

- **Hide muted accounts completely**: even mutual follows disappear from Home, search, notifications, and post threads. X's native mute often does nothing for people you still follow; this adds that layer. Profile pages stay open so you can unmute.
- **Hide accounts that blocked you**: hides accounts this extension already confirmed blocked you, on Home, search, notifications, and post threads. This is not a complete list; it only covers handles already observed.
- **Apply custom filter rules**: hide by handle, display name, or post text in the local rules. Text rules may use contains or a safety-checked regular expression, and each rule can be enabled or expired on its own.

Filters only change what this browser shows. They do not click mute/block and they do not make extra X requests. Mute marks come from the `muting` field X already loaded for visible posts; blocked-you uses live evidence or the local archive. Accounts already in the local list hide immediately; a newly detected account not yet on the list collapses first, then disappears. A quote tweet stays visible when the outer author is not the filtered account.

**Edit rules & view guide** beside **Apply custom filter rules** opens the side panel Rules tab; from fieldbook Options it opens the fieldbook Rules page. Rules are stored per signed-in X account in this Chrome profile's `chrome.storage.local` and do not sync with the Chrome account. Only the master switch can sync. Uploading local JSON needs no site permission. Importing public HTTPS JSON or a public Gist asks Chrome for read access to that source after the click, then asks whether to update by ID or clear-and-replace. The fetch happens once. There is no saved subscription and no auto-refresh. Post text is matched in place and never enters rules, the relationship archive, or an export. The side panel Rules tab and fieldbook stats bar show active-rule count and lifetime intercepts. The X dock hiding block has two lines: a rule summary such as `Filter rules · 3 active / 5 total`, plus this-page / lifetime hidden posts; the edit icon is on the right, and **View details** at the bottom uses the side-panel icon.

After consent you can also quick-add from the X timeline, with an immediate save: **Not Brother!** next to the name on an avatar hover card writes that handle; the same item at the top of a post's three-dot menu writes that post's author; selecting post text and choosing **Hide keyword** writes a contains-text rule. If the master switch is still off, adding this way turns it on. This only changes extension display. It does not click X mute/block controls.

Installer-facing authoring steps, the form, export/backup, and recommended hosting (public Gist, GitHub Raw, other public HTTPS URLs) are in root [README.en.md](../../README.en.md#custom-filter-rules). JSON fields, limits, and validation are in [Custom filter rules v1](filter-rules.md). You can also give exported JSON to an assistant that has `skills/x-not-brother-rules`.

## Side Panel

Click the toolbar icon to open the side panel. The top switches between **Status**, **Rules**, and **Options**: Status is the observation overview and user list; Rules is the hiding overview and the signed-in account's filter-rule editor; Options holds interface language, page badges, and timeline filters. Right-click the toolbar NB icon and choose **Options** to open the Options tab directly. The extension's "Extension options" entry on `chrome://extensions` uses the same path.

- Activate the mutual, following-only, follows-you, or blocked-you counts to filter the list below; activate the changed callout to see every unreviewed change.
- Activate the selected category again to restore all recent observations. A filtered empty state appears when nothing matches.
- Activate a whole user row (avatar, display name, or @handle) to open that standard X profile in a new tab from your gesture. The extension does not open or traverse profiles on its own. Avatars first use the latest observed X CDN URL, try `https://unavatar.io/x/{handle}` only when it is missing or fails, and show the handle initial if both sources fail.
- Unfiltered views show up to the 8 most recent users; filtered views show up to 40 recent matches. The full set stays in the relationship fieldbook.

Extension pages follow the system light/dark preference. Badges and the dock on X follow the actual light/dark background of the X page.

## Full fieldbook

Three top tabs, one page at a time: **Archive**, **Rules**, and **Options**. Rules are stored separately per signed-in X account. After you switch accounts, editing and filtering use only that account's rules.

- Activate the avatar, display name, or @handle to open that standard X profile in a new tab. Avatars use the latest observed X CDN URL, then a handle-derived public image, then the handle initial.
- The left index filters by relationship.
- Search handle or display name at the top.
- Sort by recency, handle, or observation count.
- The history button expands the 30 most recent local observations.
- Page badges, Side Panel, and archive rows: a current mutual state shows Mutual. Following-only defaults to One-way; **They unfollowed** appears only when history shows they used to follow you and you still follow them. Your unfollow or their block still uses the matching short label. When neither side follows (including a previous follows-you-only), there is no badge. Simultaneous changes that cannot be attributed to one side still show **Changed**. The dock **Changed** count is the aggregate of those unreviewed events.
- The check button marks a relationship change as reviewed and restores the current base-relationship label.
- The delete button removes only that local record.
- Option switches control the observer, page badges, and optional timeline filters.
- Footer **Send feedback** opens [GitHub Issues](https://github.com/interjc/chrome-x-not-brother/issues) in a new tab.

The Side Panel footer has the same feedback entry. Do not paste account passwords, cookies, or export backups that contain real relationship data.

## Backup and restore

- JSON: users and observations, for a full backup and a merge restore.
- CSV: current user summary, for spreadsheets.
- CSV machine field names stay English. `relationship_label` uses the extension UI language at export time.
- Import: only a Not Brother schema v1 JSON, merged into existing local data.
- Clear: a second confirmation deletes the entire local archive in this Chrome profile.

Filter rules use a separate `not-brother-filter-rules` JSON v1. Relationship-archive backups and rule imports do not overwrite each other. The rules area can download, upload, import from a public URL/Gist, or clear on its own.

Export JSON before you clear data, switch Chrome profiles, or uninstall. Chrome does not sync IndexedDB across profiles.
