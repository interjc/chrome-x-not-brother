# Privacy Policy / 隐私政策

- Developer / 开发者：Justin Chen
- Source / 源码：https://github.com/interjc/chrome-x-not-brother
- Contact / 联系：https://github.com/interjc/chrome-x-not-brother/issues
- Public page / 公开页面：https://interjc.github.io/chrome-x-not-brother/privacy.html
- Terms of use / 使用条款：https://interjc.github.io/chrome-x-not-brother/terms.html
- Effective date / 生效日期：2026-08-27

Do not paste passwords, cookies, export backups, or other people's account data into Issues.

请不要在 Issues 中粘贴密码、Cookie、导出备份或其他人的账号资料。

## 中文

不是兄弟（Not Brother）是一个本地优先的 Chrome 扩展。它只在你正常浏览 `x.com` 时，读取当前页面可见账号以及 X 已经为这些账号载入的关系提示，并保存在当前 Chrome 配置中；若你开启自定义内容过滤，也会只在本地即时匹配当前可见帖子正文。它不会为此额外请求 X 接口。

### 开始收集前

首次安装后，观察器默认关闭。Side Panel 或安装引导页会说明读取的数据、用途、保存位置和不会执行的行为。只有你主动同意后，扩展才会标注页面并写入本地数据库。

同意版本与其他小型偏好保存在 `chrome.storage.sync`。如果以后收集的数据类型、用途、接收方或保存方式发生实质变化，必须提高同意版本并重新取得同意。

### 收集内容

扩展只保存当前页面已显示、且与关系标注有关的最小信息：

- X handle、显示名称、头像 URL 和标准资料 URL；
- 当前与上一次关系；
- 关系证据类型；
- 首次、最后及历史观察时间；
- 观察来源 URL 和页面类型；
- 当前登录账号的小写 handle（`viewerHandle`），仅用于排除本人，不作为观察对象。

扩展不保存帖子正文，不读取私信，不读取 cookies，不使用 X API，也不收集浏览器全局历史。只有你打开“应用自定义拦截规则”且存在内容规则时，扩展才会读取当前候选帖子的可见正文，在内存中与 contains 或已安全校验的正则匹配；正文不会写入规则、关系档案、日志或导出，也不会发送给开发者或规则来源。证据不足的结果不保存。评论区互动按钮只用于当场判断是否全部不可用，不保存按钮内容或操作行为。

你可以自己创建拦截规则，其中可能包含 X handle、显示名称匹配文字、内容关键词/正则、启用状态和到期时间。这些是你主动提供的本地配置，不是扩展自动收集的关系事实。

### 保存位置

- 用户与观察记录保存在扩展 origin 的 IndexedDB；
- 同意版本、观察开关、徽标开关、dock 收起偏好、界面语言、侧栏标签和三个可选时间线过滤总开关保存在 `chrome.storage.sync`；用户登录 Chrome 并启用同步时，Chrome 可通过该 Chrome 账号在浏览器间同步这些小型偏好；未登录、关闭同步或离线时，它们仍保存在当前设备；
- `viewerHandle` 单独保存在 `chrome.storage.local`，不会随 Chrome 账号同步；
- 完整拦截规则文档单独保存在 `chrome.storage.local`，不进入 Chrome Sync，也不与关系档案备份混合；
- 扩展没有开发者服务器、扩展账号系统或遥测。关系观察数据不会进入 Chrome Sync，也不会发送给开发者；设置同步由 Chrome 提供。

侧栏和档案库优先显示观察时保存的 X CDN 头像 URL；没有保存地址或图片加载失败时才按 handle 请求公开头像（`https://unavatar.io/x/{handle}`），仍失败则显示本地生成的 handle 首字母。第三方请求只用于显示，观察记录仍只保存在本地。

### 权限

- `https://x.com/*`：只为在 X 页面运行 content script；
- `contextMenus`：只在插件自己的工具栏图标右键菜单（不是网页右键）中提供隐私说明与同意入口；不读取网页右键或页面选中内容，打开该入口本身不会记录同意；完成当前同意后隐藏该项；
- `storage`：保存扩展设置；
- `sidePanel`：显示 Chrome 原生侧栏。
- 可选的 `https://*/*` host access：只为用户主动从公开 HTTPS JSON 或 Gist 导入规则。该权限安装时不授予；点击“加载地址”后，Chrome 才针对所需来源显示授权请求。拒绝不影响本地文件导入、规则编辑或其他扩展功能。

扩展不申请 `tabs`、`scripting`、`cookies` 或 `webRequest`。它没有常驻全站 host access；上述 optional host access 只在用户手势后按来源授予。

从远程地址导入时，浏览器会直接联系该公开文件所在站点；导入 Gist 时会联系 `api.github.com`，若 GitHub API 返回截断文件才可能联系 `gist.githubusercontent.com`。和普通网页请求一样，来源站点可能看到 IP 地址、User-Agent、请求时间和所请求的 URL。扩展请求不携带 cookies、X 页面内容、本地关系档案或已有规则；地址只读取一次，不保存为订阅，也不自动刷新。开发者不接收这些请求。

### 你的控制

你可以随时暂停观察、隐藏页面徽标、打开或关闭可选时间线过滤、编辑/导入/导出/清空本地拦截规则、收起或展开观察 dock、导出 JSON/CSV、删除单个用户及其历史、清空全部本地档案，或卸载扩展以删除其 origin 数据。时间线过滤只改变当前浏览器的显示，不保存静音名单，也不对 X 执行静音或拉黑。

### 政策更新

政策变化会写进本文件并更新日期。实质的数据处理变化还会通过扩展内披露重新征求同意。

## English

Not Brother is a local-first Chrome extension. While you browse `x.com` normally, it reads visible accounts and relationship hints X already loaded for those accounts on the current page and stores them in this Chrome profile. If you enable custom content filtering, it also matches currently visible post text locally. It does not make extra X requests for this.

### Before collection starts

Observation stays off after install. The side panel or install guide explains what is read, why, where it is stored, and what the extension will not do. Collection and page annotation start only after you agree.

The accepted consent version and other small preferences are stored in `chrome.storage.sync`. A material change to data types, purposes, recipients, or storage requires a new consent version before collection resumes.

### What is collected

The extension stores only the minimum information already loaded for visible accounts and needed for relationship annotation:

- X handle, display name, avatar URL, and standard profile URL;
- current and previous relationship;
- evidence type;
- first-seen, last-seen, and historical observation times;
- source URL and page type;
- the signed-in account's lowercase handle (`viewerHandle`), used only to exclude the viewer and never stored as an observation.

It does not save post text, read direct messages or cookies, call X APIs, or collect browser-wide history. Only when you enable “Apply custom filter rules” and have a content rule does it read visible text from the current candidate post and compare it in memory with a contains matcher or a safety-checked regular expression. Post text is not written to rules, the relationship archive, logs, or exports, and is not sent to the developer or a rule source. Insufficient evidence is discarded. Reply, repost, and like controls are inspected only to decide whether they are all unavailable; their labels and click actions are not stored.

You may create filter rules containing X handles, display-name match text, content keywords or regular expressions, enabled state, and expiration times. These are local settings you provide, not relationship facts collected automatically by the extension.

### Where it is stored

- Users and observations stay in IndexedDB under the extension origin;
- consent version, observer state, badge preference, dock-collapsed preference, UI language, side-panel tab, and the three optional timeline-filter master switches are stored in `chrome.storage.sync`; when the user is signed in to Chrome with sync enabled, Chrome may sync these small preferences between browsers through that Chrome account; when signed out, sync is disabled, or the browser is offline, they remain available on the current device;
- `viewerHandle` stays separately in `chrome.storage.local` and is not synced through the Chrome account;
- the full filter-rule document stays separately in `chrome.storage.local`, does not enter Chrome Sync, and is separate from relationship archive backups;
- the extension has no developer server, extension account system, or telemetry. Relationship observations do not enter Chrome Sync and are not sent to the developer; preference sync is provided by Chrome.

Side Panel and Fieldbook first display the X CDN avatar URL saved during observation. Only when no saved URL exists or that image fails do they request a public avatar by handle (`https://unavatar.io/x/{handle}`); if that also fails, they show a locally generated handle initial. The third-party request is only for display; observation records stay local.

### Permissions

- `https://x.com/*` to run the content script on X;
- `contextMenus` only to add a privacy-notice and consent entry to the extension's own toolbar-icon menu (`contexts: ["action"]`), not the webpage context menu; it does not inspect webpage menus or page selection, and opening the item does not record consent; the item is hidden after the current consent version is accepted;
- `storage` to save extension settings;
- `sidePanel` to show Chrome's native side panel.
- optional `https://*/*` host access only when the user chooses to import rules from a public HTTPS JSON file or Gist. It is not granted at install. Chrome asks for the needed source after the user clicks Load. Denial does not affect local file imports, rule editing, or other extension features.

The extension does not request `tabs`, `scripting`, `cookies`, or `webRequest`. It has no persistent all-sites host access; the optional host access above is granted per source only after a user gesture.

For a remote import, the browser contacts the public-file host directly. Gist imports contact `api.github.com` and, only when the API reports truncated content, may contact `gist.githubusercontent.com`. Like an ordinary web request, that host may see the IP address, User-Agent, request time, and requested URL. The request carries no cookies, X page content, relationship archive, or existing local rules. The URL is fetched once, is not stored as a subscription, and is not refreshed automatically. The developer does not receive these requests.

### Your controls

You can pause observation, hide page badges, turn optional timeline filters on or off, edit/import/export/clear local filter rules, collapse or expand the observer dock, export JSON or CSV, delete one local record, clear the archive, or uninstall the extension to delete its origin data. Timeline filters only change what this browser shows; they do not save a mute list or mute/block anyone on X.

### Changes

Updates are published in this file with a new effective date. Material data-handling changes also require in-extension disclosure and a new consent.
