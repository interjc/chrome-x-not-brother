# Usage workflow

1. Build and load `dist/` as an unpacked Chrome extension.
2. Use the automatically opened install guide or side panel to review the prominent local-data disclosure and affirmatively consent before observation begins.
3. Browse `https://x.com` normally. Do not expect the extension to auto-scroll or open profiles.
4. Read the compact badge beside recognized users. Insufficient evidence produces no badge or local record.
5. Read the toolbar badge: lime `ON` is active; gray `!` is paused; amber `!` needs first-run setup.
6. Use the X-page observer dock for local counts and click it to open the side panel. Its `×` minimizes it to a status-bearing NB floating button; activate the button to restore the overview. The presentation preference persists locally.
7. Open the fieldbook for full search, filtering, sorting, change review, export, import, local deletion, or full local reset.

The side panel, fieldbook, and toolbar copy follow the Chrome UI language. Badges and the observer dock injected into X follow the X page language. English, Japanese, and Simplified Chinese switch automatically; unsupported locales fall back to English.

“Blocked you” is opportunistic: it is collected from a directional platform notice, when reply/repost/like are all unavailable with a normal same-page baseline, or from a fully loaded already-visible hover card that has no relationship-count links. Generic unavailable-post text and a single disabled repost are not evidence. Once known locally, the relation can annotate later cards for the same handle. The extension cannot enumerate every account that has blocked the viewer. The signed-in viewer and unknown results are excluded from all observation UI.

A fully loaded visible author hover card may also supplement ordinary relationship facts for that exact handle: `*-unfollow` means the viewer follows the account, `*-follow` means they do not, and `userFollowIndicator` means the account follows the viewer. Hover cards never contribute evidence to a different author.

When the active observer still has zero records, the X-page dock and side-panel empty state tell the user to hover a reply author. This is an evidence-availability instruction, not a claim that the extension scans or opens every hover card automatically.

DOM mutations normally trigger an immediate debounced pass. While the consented observer page is visible, a 2-second fallback rescan covers reused nodes and missed asynchronous updates; returning focus or visibility triggers an immediate pass. Hidden pages pause periodic work, and signature deduplication prevents unchanged evidence from appending history every interval.

JSON export preserves users and observation history. CSV export contains the current user summary. Import accepts only a Not Brother JSON export and merges it into local data.

Unreviewed changes are specific when the stored transition is attributable to the other account: one-way to mutual displays followed-back, mutual to one-way displays unfollowed-you, and a known normal relationship to blocked-by displays blocked-you. Other transitions remain generic. Page badges, recent records, and the fieldbook show the event; the dock keeps one aggregate changed count. Reviewing the change restores the current base-relationship label without deleting history.

In the Side Panel, activate a base-relationship count or the changed callout to filter the recent list; activate the selected category again to show all recent users. A filtered view shows up to 40 recent matches and an explicit empty state when none exist. Activating a user row opens that standard X profile in a new tab from the user gesture; it does not start automated traversal.
