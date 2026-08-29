# Not Brother / 不是兄弟

[简体中文](README.md) · **English**

Not Brother (Chinese: 不是兄弟; Japanese: 兄貴じゃない) is a Chrome extension for X. While you browse `x.com` normally, it annotates relationship evidence already visible next to accounts on the page, and keeps those observations in the current Chrome profile so you can later notice mutual follows, unfollows, or blocks.

The relationship archive stays on this device. It is not uploaded. Small preferences such as language, switches, and panel state may sync through a signed-in Chrome account; they still remain on this device if Chrome is signed out or sync is off. The extension does not follow, unfollow, block, or mute anyone for you, and it does not auto-scroll or open other people's profiles.

## Features

- **Relationship badges**: mutual follow, you follow only, they follow you, they blocked you, and attributable relationship changes.
- **Local archive**: review, filter, and search accounts you have already seen, in the side panel and the full fieldbook.
- **Preference sync**: small preferences can sync across Chrome profiles that are signed in with Chrome Sync enabled. The relationship archive and the current X handle do not sync.
- **Optional timeline filters**: hide posts from muted accounts, from accounts already known to have blocked you, or from posts that match local custom filter rules. All of these stay off by default.
- **Chinese, English, and Japanese UI**: follows the browser language, or you can pin Simplified Chinese, English, or Japanese in Options.

## Install

### Chrome Web Store

Open [Not Brother on the Chrome Web Store](https://chromewebstore.google.com/detail/dioanbgbpklflgochbljdehpjidckgfd) and choose **Add to Chrome**.

### Load from source

For developers, or when the Store build is behind the commit you need:

1. Install [Chrome](https://www.google.com/chrome/) 116 or later, and [nvm](https://github.com/nvm-sh/nvm).
2. Clone the repository and build:

```bash
git clone https://github.com/interjc/chrome-x-not-brother.git
cd chrome-x-not-brother
source "$HOME/.nvm/nvm.sh"
nvm use
npm install
npm run build
```

3. Open `chrome://extensions` and turn on **Developer mode** in the top right.
4. Choose **Load unpacked** and select the repository's `dist/` directory.

After a rebuild, click **Reload** on the extension card, then refresh any X tabs that are already open.

## Usage

The first time you open the side panel after install, you see a data notice. Annotation and local collection start only after you click **Agree and start**. Before that, the expanded dock on X and the collapsed floating button both show **Review & agree**; you can also right-click the toolbar icon and choose the same item. Those entries only open the full notice; they do not record consent for you. You can pause later at any time.

Toolbar icon states:

- Acid-yellow `ON`: observing
- Gray `!`: paused
- Amber `!`: first-run setup is not finished

### Page badges

Browse X normally. Home usually has enough already-loaded relationship fields. If a card still has no badge, hover the author's avatar or ID and wait for X's own relationship hover card. Missing evidence does not show an "unknown" badge and is not archived.

Change labels stay specific when they can: they unfollowed, you unfollowed, they blocked you. When a single-sided action cannot be inferred, the badge shows **Changed**.

### Side panel

Click the toolbar icon to open the side panel. The top switches between **Status**, **Rules**, and **Options**.

- **Status**: observation overview, relationship filters, and recent accounts. Activating a row opens that account's X profile.
- **Rules**: hiding overview (active-rule count and lifetime intercepts) and the filter-rule editor for the signed-in account.
- **Options**: interface language, page badges, and timeline filters. Right-click the toolbar icon and choose **Options** to open this tab directly.

X also has an observation overview in the bottom-right corner, which can collapse to a floating button. **View details** opens the side panel; activate it again to collapse. After consent, the expanded overview shows whether filter rules are applying, how many rules are active, this-page intercepts, and lifetime intercepts, plus **Edit rules** to open the side panel Rules tab. Before consent, a prominent agree entry stays beside the floating button.

### Timeline filters

Turn these on in side panel **Options**. They all default off:

- **Hide muted accounts completely**: even mutual follows disappear from Home, search, notifications, and post threads. Profile pages stay open so you can unmute.
- **Hide accounts that blocked you**: hides accounts this extension already confirmed blocked you. This is not a complete list; it only covers accounts already observed.
- **Apply custom filter rules**: hide posts by handle, display name, or post text. Write rules in the UI or import JSON. See the authoring guide below.

Accounts already in the local list hide immediately; a newly detected account collapses first, then hides. Filters only change what this browser shows.

### Custom filter rules

Custom filter rules only change how X looks in this browser: matching posts hide on Home, search, notifications, and post threads. They do not mute or block anyone, subscribe to a remote file, or auto-refresh.

Rules are stored separately for the **currently signed-in X account**. A different X account uses a different list. The master switch **Apply custom filter rules** stays off by default; writing rules is not enough until you turn it on.

#### Where to open the editor

Use any of:

- the side panel **Rules** tab
- the **Rules** tab at the top of the relationship fieldbook (full editor)
- side panel **Options**, the Chrome Options page, or **Edit rules** on the X observation dock

The first time there are no local rules, the Rules page loads the repository example so you can compare it. It does **not** turn the master switch on by itself. The in-page rule-authoring guide stays collapsed until you open it.

#### Write rules in the UI

You do not need to hand-write JSON. On the Rules page:

1. Choose the match target: **account handle list**, **display name**, or **post content**.
2. Enter handles one per line or separated by commas. `@` is optional; matching ignores case. X's internal numeric id is not supported.
3. For display names and post content, prefer **Contains text** for ordinary keywords. Use a regular expression only when needed: enter the JavaScript Unicode pattern body, without surrounding `/`. Expressions that cannot compile, are too complex, or could lock the page are rejected.
4. Each rule can be enabled on its own and can expire; leave expiration blank to keep it forever. Any one enabled, unexpired match hides the post.
5. Click the prominent **Save rules** control in the lower right. It stays visible while there are unsaved edits; leaving the Rules page or closing the tab asks for confirmation.
6. Turn on **Apply custom filter rules**, then check the result on X.

Post text is matched only in the current page. It is never written into the rule file, the relationship archive, or an export backup.

#### Export and import

In **Import and export** on the Rules page:

- **Download rule JSON**: backup, move to another computer, or hand the file to someone / an AI and import it back.
- **Upload JSON file**: import from this device. No website permission is required.
- **Load URL**: paste a public `https://` address and click **Load URL**. Chrome asks for read access to that site first. The fetch happens once; there is no saved subscription and no background refresh.

Downloaded JSON keeps each rule's **id**. Every import asks you to choose: **Update by ID**, or **Clear and replace**. Update by ID replaces any rule with the same id and appends ids that are new; rules that exist only locally are kept. Clear and replace deletes every existing rule for the current X account.

#### Where to host shared rules

The rule document does not use Chrome Sync. To move a list between computers, or share it, put it at an anonymously readable public HTTPS URL and import it with **Load URL**.

| Method | How to use | Notes |
| --- | --- | --- |
| [GitHub Gist](https://gist.github.com/) | Create a **public** Gist whose file uses `.json`. You can paste the Gist page URL, the Gist API URL, or the file's Raw URL. | If a Gist has several JSON files, use the target file's Raw URL. Private Gists are not supported. |
| GitHub Raw file | Put the JSON in a public repository and copy the Raw link. | Community example: [filter-default.json](https://github.com/interjc/chrome-x-not-brother-rules/raw/refs/heads/main/rules/filter-default.json) |
| Other public HTTPS URL | Any `https://` URL that returns one JSON document, such as your own site or a public object-storage link. | Must open anonymously, without redirects or login. Private drives and cookie- or token-gated URLs are not supported. |

The import field is prefilled with the community example URL above. You can refill it in one click.

#### Sharing filter lists

Rules are meant for public collaboration. Contributions, reuse, and discussion live in [chrome-x-not-brother-rules](https://github.com/interjc/chrome-x-not-brother-rules). The extension's default import URL also points at that repository. Strip personal accounts, private keywords, and anything that should not be public before sharing.

#### Quick add from the timeline

After consent, you can add a rule without opening the fieldbook. The save is immediate:

- Hover an avatar until X's own profile card appears, then click **Not Brother!** next to the **name**. That account's handle becomes a rule.
- Open the three-dot menu at the top right of a post. The same item at the top of the menu writes that post's author.
- Select text in a post body and choose **Hide keyword**. The selection becomes a contains-text rule.

If the master switch is still off, adding a rule this way turns on **Apply custom filter rules** so hiding starts immediately. This only changes the extension's own display. It does not click X's block or mute controls.

Full fields, size limits, and validation are in [Custom filter rules v1](docs/en/filter-rules.md). When an AI should read or edit exported JSON, give it the [x-not-brother-rules](skills/x-not-brother-rules/SKILL.md) skill.

### Relationship fieldbook

The bottom of the side panel opens the full archive: search, filter, sort, review changes, inspect history, export JSON/CSV, import a JSON backup, delete one record, or clear all local data.

Export JSON before you switch computers or clear data. Chrome does not sync this archive across profiles.

Options, rules, and the archive are separate: language, the observer switch, page badges, dock/side-panel state, and the three timeline-filter master switches go into `chrome.storage.sync`. The custom rule document, intercept counts, the current X handle, and the full relationship archive stay on this device. When Chrome is signed out, sync is off, or the browser is briefly offline, small options still work on this device and Chrome restores sync later when it can.

## Privacy

The extension only reads account names, handles, avatars, and relationship hints already shown on the current `x.com` page. It reads current post text locally for in-memory matching only when you enable custom content rules. Post text is not stored or uploaded. It does not read DMs or cookies, and it does not make extra X requests. A public rule URL is fetched only after you explicitly click import.

- [Privacy policy](https://interjc.github.io/chrome-x-not-brother/privacy.html)
- [Terms of use](https://interjc.github.io/chrome-x-not-brother/terms.html)

## Local development

The repository pins Node through nvm in `.nvmrc` (currently `24.19.0`):

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm install
npm run dev
```

`npm run dev` watches sources and updates `dist/`. After reloading the extension on `chrome://extensions`, also refresh any open X tabs.

Common commands:

```bash
npm run check             # typecheck + unit tests
npm run build             # write dist/
npm run validate:dist     # check the manifest and permissions
npm run package           # write a loadable ZIP
```

Conventions, layout, and release flow are in [docs/en/](docs/en/README.md). Repository rules for agents and automation are in [AGENTS.md](AGENTS.md). The original Chinese developer docs remain in [docs/](docs/README.md).

## Contributing

Please file problems or suggestions on [GitHub Issues](https://github.com/interjc/chrome-x-not-brother/issues). Do not paste passwords, cookies, or export backups that contain real relationship data.

Read the [contributing guide](docs/en/contributing.md) before sending code, and run this locally:

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm run check
npm run build
npm run validate:dist
npm run skills:validate
```

Do not add automatic scrolling, profile traversal, private X APIs, or clicks on Follow / Unfollow / Block / Mute.

## License and author

[MIT License](LICENSE) © 2026 [Justin Chen](https://interjc.net)

- GitHub: [interjc/chrome-x-not-brother](https://github.com/interjc/chrome-x-not-brother)
- X: [@interjc](https://x.com/interjc)
- Site: [interjc.net](https://interjc.net)

Not Brother is an independent extension. It is not affiliated with, endorsed by, or sponsored by X Corp.
