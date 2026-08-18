# 隐私说明

## 开始收集前

首次安装后，观察器默认关闭。Side Panel 会显著说明读取的数据、用途、本地保存方式和不会执行的行为；只有用户主动点击同意按钮后，content script 才会标注页面并写入本地数据库。当前同意版本保存在 `chrome.storage.local`，隐私用途发生实质变化时必须提高版本并重新取得同意。

显著披露覆盖所有处理的数据，即使数据只在本机保存且直接服务于扩展单一用途。商店 listing、扩展内披露、本文和 Dashboard Privacy practices 必须描述相同的数据类别与用途。

## 收集内容

扩展只保存当前页面已显示、且与关系标注有关的最小信息：

- X handle、显示名称、头像 URL 和标准资料 URL；
- 当前与上一次关系；
- 关系证据类型；
- 首次、最后及历史观察时间；
- 观察来源 URL 和页面类型。

首版不保存帖子正文，不读取私信，不读取 cookies，不使用 X API，也不收集浏览器全局历史。

证据不足的 `unknown` 结果不保存。评论区的互动按钮只用于当场判断是否全部不可用，不保存按钮内容、帖子正文或操作行为。

扩展会保存当前登录账号的小写 handle 作为 `viewerHandle`，用途仅是排除本人，避免把自己的帖子、评论和资料计入观察。它不作为观察对象或导出关系记录。

## 保存位置

- users 和 observations 保存在扩展 origin 的 IndexedDB；
- 同意版本、观察开关、徽标开关、dock 收起偏好和 `viewerHandle` 保存在 `chrome.storage.local`；
- 没有服务器、账号系统、遥测或云同步。

头像仍通过已有的 X CDN URL 展示，浏览器可能在打开扩展管理页时请求该图片。

## 权限

- `https://x.com/*`：只为在 X 页面运行 content script；
- `storage`：保存扩展设置；
- `sidePanel`：显示 Chrome 原生侧栏。

扩展不申请 `tabs`、`scripting`、`cookies`、`webRequest` 或全站访问权限。

## 用户控制

用户可以随时暂停观察、隐藏页面徽标、收起或展开观察 dock、导出 JSON/CSV、删除单个用户及其历史、清空全部本地档案，或卸载扩展删除其 origin 数据。
