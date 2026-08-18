# Privacy Policy / 隐私政策

- Developer / 开发者：Justin Chen
- Source / 源码：https://github.com/interjc/chrome-x-not-brother
- Contact / 联系：https://github.com/interjc/chrome-x-not-brother/issues
- Public page / 公开页面：https://interjc.github.io/chrome-x-not-brother/privacy.html
- Terms of use / 使用条款：https://interjc.github.io/chrome-x-not-brother/terms.html
- Effective date / 生效日期：2026-08-18

Do not paste passwords, cookies, export backups, or other people's account data into Issues.

请不要在 Issues 中粘贴密码、Cookie、导出备份或其他人的账号资料。

## 中文

不是兄弟（Not Brother）是一个本地优先的 Chrome 扩展。它只在你正常浏览 `x.com` 时，读取当前页面可见账号以及 X 已经为这些账号载入的关系提示，并保存在当前 Chrome 配置中。它不会为此额外请求 X 接口。

### 开始收集前

首次安装后，观察器默认关闭。Side Panel 或安装引导页会说明读取的数据、用途、保存位置和不会执行的行为。只有你主动同意后，扩展才会标注页面并写入本地数据库。

同意版本保存在 `chrome.storage.local`。如果以后收集的数据类型、用途、接收方或保存方式发生实质变化，必须提高同意版本并重新取得同意。

### 收集内容

扩展只保存当前页面已显示、且与关系标注有关的最小信息：

- X handle、显示名称、头像 URL 和标准资料 URL；
- 当前与上一次关系；
- 关系证据类型；
- 首次、最后及历史观察时间；
- 观察来源 URL 和页面类型；
- 当前登录账号的小写 handle（`viewerHandle`），仅用于排除本人，不作为观察对象。

扩展不保存帖子正文，不读取私信，不读取 cookies，不使用 X API，也不收集浏览器全局历史。证据不足的结果不保存。评论区互动按钮只用于当场判断是否全部不可用，不保存按钮内容或操作行为。

### 保存位置

- 用户与观察记录保存在扩展 origin 的 IndexedDB；
- 同意版本、观察开关、徽标开关、dock 收起偏好和 `viewerHandle` 保存在 `chrome.storage.local`；
- 没有服务器、账号系统、遥测或云同步。数据不会发送给开发者或第三方。

头像仍通过页面上已有的 X CDN URL 展示。打开扩展管理页时，浏览器可能直接请求该图片。

### 权限

- `https://x.com/*`：只为在 X 页面运行 content script；
- `storage`：保存扩展设置；
- `sidePanel`：显示 Chrome 原生侧栏。

扩展不申请 `tabs`、`scripting`、`cookies`、`webRequest` 或全站访问权限。

### 你的控制

你可以随时暂停观察、隐藏页面徽标、收起或展开观察 dock、导出 JSON/CSV、删除单个用户及其历史、清空全部本地档案，或卸载扩展以删除其 origin 数据。

### 政策更新

政策变化会写进本文件并更新日期。实质的数据处理变化还会通过扩展内披露重新征求同意。

## English

Not Brother is a local-first Chrome extension. While you browse `x.com` normally, it reads visible accounts and relationship hints X already loaded for those accounts on the current page, and stores them in this Chrome profile. It does not make extra X requests for this.

### Before collection starts

Observation stays off after install. The side panel or install guide explains what is read, why, where it is stored, and what the extension will not do. Collection and page annotation start only after you agree.

The accepted consent version is stored in `chrome.storage.local`. A material change to data types, purposes, recipients, or storage requires a new consent version before collection resumes.

### What is collected

The extension stores only the minimum information already loaded for visible accounts and needed for relationship annotation:

- X handle, display name, avatar URL, and standard profile URL;
- current and previous relationship;
- evidence type;
- first-seen, last-seen, and historical observation times;
- source URL and page type;
- the signed-in account's lowercase handle (`viewerHandle`), used only to exclude the viewer and never stored as an observation.

It does not save post text, read direct messages or cookies, call X APIs, or collect browser-wide history. Insufficient evidence is discarded. Reply, repost, and like controls are inspected only to decide whether they are all unavailable; their labels and click actions are not stored.

### Where it is stored

- Users and observations stay in IndexedDB under the extension origin;
- consent version, observer state, badge preference, dock-collapsed preference, and `viewerHandle` stay in `chrome.storage.local`;
- there is no server, account system, telemetry, or cloud sync. Observation data is not sent to the developer or third parties.

Avatars are shown from existing X CDN URLs. Opening an extension page may cause the browser to request that image directly.

### Permissions

- `https://x.com/*` to run the content script on X;
- `storage` to save extension settings;
- `sidePanel` to show Chrome's native side panel.

The extension does not request `tabs`, `scripting`, `cookies`, `webRequest`, or all-sites access.

### Your controls

You can pause observation, hide page badges, collapse or expand the observer dock, export JSON or CSV, delete one local record, clear the archive, or uninstall the extension to delete its origin data.

### Changes

Updates are published in this file with a new effective date. Material data-handling changes also require in-extension disclosure and a new consent.
