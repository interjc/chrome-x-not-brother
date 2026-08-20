# Chrome Web Store 标准上架指南

本文是 Not Brother 从本地开发版走向 Chrome Web Store 的政策与字段手册。第一次上手请先读 [首次上架准备](deploy.md)，再回到这里核对隐私申报和审核口径。政策和后台界面会变化；每次提交都应重新打开文末的官方链接核对。本文最后核验于 2026-08-18。

[Chrome Web Store 2026 政策更新](https://developer.chrome.com/blog/cws-policy-updates-2026) 自 2026-08-01 起执行更严格的披露要求：扩展收集的所有用户数据都必须显著告知用户，不再因为数据与单一用途密切相关而豁免；安装后的数据处理方式变化也必须主动披露。本项目因此同时保留商店详细说明、扩展内首次显著披露和主动同意，三者不可互相替代。

## 1. 先决定发布通道

Chrome Web Store 的可见性与测试方式不同：

- **Private**：只给指定的受信测试者，适合第一轮真实账号测试；
- **Unlisted**：只有拿到链接的人可安装，仍然会审核；
- **Public**：可被搜索和公开安装，适合稳定版。

建议先以 Private 条目完成审核和真实环境验收，再决定是否切到 Unlisted 或 Public。测试版和正式版若长期并行，应建立两个商店条目并明确用途，避免触发重复内容政策。

## 2. 注册开发者账号

1. 使用长期可控、会定期查看邮件的 Google 账号登录 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)。
2. 按 [注册开发者账号](https://developer.chrome.com/docs/webstore/register/) 完成一次性注册费用、开发者邮箱和协议确认。
3. 完成账号要求的身份/邮箱验证。若以后以组织发布，优先建立 publisher group，避免扩展永久依赖个人账号。
4. 账号启用两步验证；代码仓库、Google 账号与后续签名私钥不要共享同一套凭据。

注册费用和验证步骤以 Dashboard 当天显示为准，不要在项目文档中写死金额。

## 3. 建立可审计的候选包

从干净工作区使用 nvm 构建：

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm ci
npm run check
npm run test:coverage
npm run skills:validate
npm run package
```

产物位于 `artifacts/not-brother-<version>.zip`。提交前检查：

- ZIP 解压后的根目录直接包含 `manifest.json`，不是再套一层 `dist/`；
- `package.json` 与 `public/manifest.json` 版本完全一致，且高于已发布版本；
- 包内没有源码映射、测试数据、真实 X 账号截图、开发缓存或秘密；
- 没有远程脚本、混淆代码或运行时下载代码；
- 权限仍只有 `storage`、`sidePanel` 和精确的 `https://x.com/*` content-script match；
- `npm run validate:dist` 通过。

官方的 [准备扩展](https://developer.chrome.com/docs/webstore/prepare/) 要求上传完整 ZIP，并建议在提交前以 unpacked 方式充分测试。当前 ZIP 远低于 2 GB 的上传上限。

## 4. 在真实 Chrome 中做发布验收

先按 [测试指南](testing.md) 完整执行本地验收，尤其检查：

1. 首次安装后观察器默认关闭，收集前显示显著披露；
2. 用户必须主动点击“同意并开始”才会标注和写入 IndexedDB；
3. 暂停后不再标注或收集；删除与清空确实移除本地数据；
4. Network 面板没有开发者服务器、遥测、X API 或远程代码请求；
5. 扩展没有自动滚动、导航、点击或任何关注/取关/拉黑/静音行为；
6. 英语、日语、简体中文 X 界面只在证据足够时给出关系；
7. “TA 拉黑了我”只在主动浏览时由明确平台提示、带同页对照的三项互动限制，或已加载的无关系计数浮窗机会式记录，不宣传为完整扫描。

另外分别使用英语、日语和简体中文 Chrome UI 打开 Side Panel 与档案库，并把 X 设为不同语言验证 `auto` 时注入 UI 跟随 X。再在 Side Panel 语言选择器中改成另一种支持语言，确认扩展页、页面徽标和观察 dock 都跟随选择。未支持的 Chrome/X 语言应完整回退英语，不能出现空白 `__MSG_*__` 或混合半套翻译。

测试账号和截图使用虚构或已获授权的数据。不要把自己的关注关系、来源 URL 或他人的头像直接提交为商店素材。

## 5. 准备商店文案

可直接复制的中英日完整 listing、当前版本更新说明、权限理由和审核备注集中在 [Chrome Web Store 三语文案](store-listing.md)。本节说明文案边界与填写原则。

### 单一用途说明

可直接使用以下中文草稿：

> 在用户正常浏览 x.com 时，标注页面上可确认的账号关系证据，并将观察历史保存在用户本机，供用户检索、核对和导出。

### 简短说明

> 标注你在 X 页面上已经看到的关系证据，并把变化历史只保存在本机。

### 详细说明必须明确

- 只在 `x.com` 运行；
- 被动处理当前已经渲染的账号区域；
- 支持互关、我单向关注、TA 关注了我、机会式 blocked-by 和变化；证据不足不标注或保存；
- 本地 Side Panel 与关系档案库；
- JSON/CSV 导出、JSON 合并导入和删除；
- 数据不发送给开发者；
- 不自动滚动、不扫描整站、不调用 X API、不执行账户操作；
- 识别结果取决于 X 当前显示的界面证据；证据不足时没有标注，也可能因 X 改版需要更新。

不要使用“找出所有拉黑你的人”“百分百准确”“官方 X 工具”等无法证明或可能造成误解的描述。不要暗示与 X Corp. 存在隶属、认可或合作关系。

### 权限理由草稿

| 权限/访问 | Dashboard 中的说明 |
| --- | --- |
| `https://x.com/*` | 在用户主动浏览 X 时，读取当前页面已经显示的账号身份和关系提示，以注入本地关系徽标并形成观察记录。 |
| `storage` | 在 `chrome.storage.local` 保存同意状态、观察器开关、徽标开关、dock 收起偏好和用于排除本人的当前 handle。 |
| `sidePanel` | 在 Chrome 原生侧栏中显示本地关系概览和首次使用披露。 |

### 商店链接

Dashboard 的 Additional fields 填这些公开 HTTPS 地址：

| 字段 | URL |
| --- | --- |
| Homepage URL | https://github.com/interjc/chrome-x-not-brother |
| Support URL | https://github.com/interjc/chrome-x-not-brother/issues |
| Privacy policy URL | https://interjc.github.io/chrome-x-not-brother/privacy.html |
| Terms of use（无独立字段时写入隐私政策或详细说明） | https://interjc.github.io/chrome-x-not-brother/terms.html |

三种 listing 语言共用这些 URL。扩展内 Side Panel 与档案库页脚的“发送反馈”也打开同一 Issues 页面。

### 本地化 listing

上传包含 `_locales/en`、`ja`、`zh_CN` 的候选包后，在 Store listing 顶部语言下拉框依次选择 English、Japanese、Chinese (China)，分别填写详细说明并上传对应语言截图。英语作为默认 listing。三种说明必须保持同一单一用途、功能范围、权限理由和隐私承诺；small promo tile 与 marquee tile 不能按语言分别上传，因此其画面尽量减少文字。

## 6. 准备图片素材

怎么把窗口裁成 1280×800、5 张图拍什么、宣传图怎么做，见 [首次上架准备](deploy.md) 第 7–8 节。成品放到 `assets/store/`。

按照 [商店素材说明](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) 与 [Supplying Images](https://developer.chrome.com/webstore/images) 准备：

- 128×128 PNG 商店图标；方形图标建议实际内容为 96×96，四周各留 16 px 透明边距；
- 至少 1 张 1280×800 截图，最多 5 张；
- 440×280 PNG/JPEG small promo tile；
- 可选 1400×560 marquee promo tile；
- 可选 YouTube 演示视频。

建议截图顺序：首次同意页、带观察 dock 的 X 页面关系徽标、工具栏 `ON` 状态、Side Panel、暗黑模式完整档案库。商店截图使用固定的虚构账号数据，保持全幅、无圆角、无额外浏览器装饰。每次提交前以 Dashboard 实际显示的必填项为准。

## 7. 填写隐私字段

本项目会处理 X 用户名、页面内容中的关系提示和具体来源 URL。即使只在 IndexedDB 中本地处理，Chrome 仍要求如实披露。参考 [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) 与 [User Data Policy](https://developer.chrome.com/docs/webstore/user_data)。

在 Privacy practices 中建议至少申报并解释：

- personally identifiable information / usernames；
- website content；
- web browsing activity（仅限扩展功能所需的 `x.com` 来源 URL）；
- 数据用途仅为扩展的单一用户可见功能；
- 不出售、不用于广告、信用评估或与单一用途无关的用途；
- 不传输给开发者或第三方；头像显示可能由浏览器直接请求现有 X CDN URL；
- 遵守 Limited Use 要求。

不要为了减少申报项目而漏报。Dashboard 选项和商店说明、扩展首次同意界面、[隐私政策](../terms/privacy.md) 必须相互一致。

公开法律文本的源稿在仓库 `terms/`，商店要填的是 GitHub Pages 上的独立 HTML，不要填 GitHub `blob` 或 `raw` 链接：

https://interjc.github.io/chrome-x-not-brother/privacy.html

https://interjc.github.io/chrome-x-not-brother/terms.html

页面由 `pages/` 经 GitHub Actions 发布。第一次使用前须在仓库 Settings → Pages 把 Source 设为 **GitHub Actions**，推送 `main` 并等 workflow 成功后，再用无痕窗口确认上述地址能打开。文件必须包含开发者身份、Issues 联系方式和生效日期。以后如果改用独立站点，再同时更新 Dashboard、`src/domain/project.ts` 和本文。

## 8. 上传并提交审核

1. 在 Developer Dashboard 选择 **New item**；
2. 上传 `output/not-brother-<version>.zip`（由 `npm run release` 或 `npm run package` 生成）；
3. 完成 Store listing、Privacy practices、Distribution 和测试说明；
4. 若审核员需要登录 X 才能复现，提供不含密码的清晰操作路径和使用虚构数据的演示视频；绝不在备注中提交个人账号凭据；
5. 选择 **Submit for Review**；正式发布建议取消自动发布，使用 deferred publishing，在审核通过后人工检查再发布。

官方 [发布流程](https://developer.chrome.com/docs/webstore/publish/) 说明了新条目上传步骤。[审核流程](https://developer.chrome.com/docs/webstore/review-process) 在 2026-04 起显示提交量激增、审核时间延长的警告；为排期预留数天到数周，不要围绕某一天承诺上线。若超过官方页面所述的升级阈值，再联系支持，不要重复撤回和重提。

## 9. 审核常见问题的回答原则

- **为什么读取 x.com？** 页面关系标注是核心且唯一用途，只读取用户当前正在浏览的精确站点。
- **为什么保存来源 URL？** 为用户提供本地可核对的观察出处；不发送到外部。
- **为什么需要用户名？** 用户必须知道徽标和历史对应哪个 X 账号。
- **是否自动化 X？** 否。没有点击、滚动、导航、X API 或后台遍历代码。
- **数据在哪里？** users/observations 在扩展 origin 的 IndexedDB；设置在 `chrome.storage.local`；没有后端。
- **如何删除？** 可删除单条、清空全部，或卸载扩展删除其 origin 数据。

回答必须以当前代码为准。如果代码后来新增同步、遥测、AI、远程头像代理或 X API，必须先更新权限、同意流程、隐私政策和商店披露，再提交。

## 10. 发布后更新与回滚

每次更新：

1. 提高 manifest 和 package 版本；
2. 上传包含全部文件的新 ZIP，不是增量包；
3. 更新变化过的文案、素材和隐私字段；
4. 重新提交审核；
5. 使用 deferred publishing 时，审核通过后需在 30 天内人工发布，否则会退回草稿。

[更新指南](https://developer.chrome.com/docs/webstore/update/) 说明，新增权限会再次提示用户，并可能导致扩展停用等待授权。大规模用户的百分比发布有额外门槛；早期版本优先使用 deferred publishing 和保留上一版产物。若发布后发现问题，先在 Dashboard 使用官方 rollback 能力或停止发布；不要通过静默清空用户 IndexedDB 来解决 schema 问题。

## 最终提交清单

- [ ] `npm run release` 全部通过，上传 `output/` 中的 ZIP；
- [ ] clean Chrome profile 与真实 X 页面手工验收通过；
- [ ] 首次同意发生在任何收集之前；
- [ ] 单一用途、权限理由、隐私申报彼此一致；
- [ ] 公开 HTTPS 隐私政策是 GitHub Pages 的 `privacy.html`，无痕可打开，含开发者身份、Issues 联系方式和日期；
- [ ] Homepage 指向 GitHub 仓库，Support 指向 Issues；
- [ ] 图片素材无真实关系数据、无误导性 X 官方暗示；
- [ ] ZIP 根目录正确，版本号递增，保留上一版产物；
- [ ] 重新核验 Chrome Web Store 政策与 X 条款；
- [ ] 先选择 Private/Unlisted/Public 中明确的一种分发策略；
- [ ] 选择自动发布或 deferred publishing，并记录负责人。
