# Usage workflow

1. Build and load `dist/` as an unpacked Chrome extension.
2. Use the automatically opened install guide or side panel to review the prominent local-data disclosure and affirmatively consent before observation begins.
3. Browse `https://x.com` normally. Do not expect the extension to auto-scroll or open profiles.
4. Read the compact badge beside recognized users. Insufficient evidence produces no badge or local record.
5. Read the toolbar badge: lime `ON` is active; gray `!` is paused; amber `!` needs first-run setup.
6. Use the X-page observer dock for local counts and click it to open the side panel. Its `×` minimizes it to a status-bearing NB floating button; activate the button to restore the overview. The presentation preference persists locally.
7. Open the fieldbook for full search, filtering, sorting, change review, export, import, local deletion, or full local reset.
8. Use the Side Panel or Fieldbook footer feedback link to open `https://github.com/interjc/chrome-x-not-brother/issues`. Do not attach passwords, cookies, or real relationship exports.

The side panel, fieldbook, and toolbar copy follow the Chrome UI language. Badges and the observer dock injected into X follow the X page language. English, Japanese, and Simplified Chinese switch automatically; unsupported locales fall back to English.

“Blocked you” is opportunistic: it is collected from a directional platform notice, when reply/repost/like are all unavailable with a normal same-page baseline, or from a fully loaded already-visible hover card that has no relationship-count links. Generic unavailable-post text and a single disabled repost are not evidence. Once known locally, the relation can annotate later cards for the same handle. The extension cannot enumerate every account that has blocked the viewer. The signed-in viewer and unknown results are excluded from all observation UI.

Home timeline cards usually omit follow controls, but X already loads `following` / `followed_by` into the current page UI store. The extension reads those already-loaded fields for visible authors and does not make extra X requests. A fully loaded visible author hover card may still supplement ordinary relationship facts for that exact handle: `*-unfollow` means the viewer follows the account, `*-follow` means they do not, and `userFollowIndicator` means the account follows the viewer. Hover cards never contribute evidence to a different author.

When the active observer still has zero records, empty-state copy may mention hover as a fallback. That is not a claim that Home requires opening every hover card.

DOM mutations normally trigger an immediate debounced pass. While the consented observer page is visible, a 2-second fallback rescan covers reused nodes and missed asynchronous updates; returning focus or visibility triggers an immediate pass. Hidden pages pause periodic work, and signature deduplication prevents unchanged evidence from appending history every interval.

JSON export preserves users and observation history. CSV export contains the current user summary. Import accepts only a Not Brother JSON export and merges it into local data.

Unreviewed changes are specific when the stored transition is a single attributable action: a current mutual state displays mutual. One-way following displays following-only unless history shows they used to follow the viewer, in which case it displays unfollowed-you (mutual or follows-you-only to following-only, or follows-you-only to none). Mutual to follows-you-only displays you-unfollowed, and a known normal relationship to blocked-by displays blocked-you. Other neither-following transitions remove the badge instead of showing a change label. Other double-action transitions remain generic. Page badges, recent records, and the fieldbook show the event; the dock keeps one aggregate changed count. Reviewing the change restores the current base-relationship label without deleting history.

In the Side Panel, activate a base-relationship count or the changed callout to filter the recent list; activate the selected category again to show all recent users. A filtered view shows up to 40 recent matches and an explicit empty state when none exist. Activating a user row opens that standard X profile in a new tab from the user gesture; it does not start automated traversal.
