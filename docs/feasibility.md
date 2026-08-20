# 可行性研究

研究日期：2026-08-17

## 结论

在“只标注、只收集”的确认范围内，技术可行性高。Chrome 扩展可以读取并修改当前页面 DOM、在 X 用户名旁插入徽标、通过 service worker 把观察写入扩展自己的 IndexedDB，并用 Side Panel 和完整扩展页面展示数据。

首版不应自动滚动、遍历资料页或执行 X 账户操作。除了偏离已确认需求，这些行为还会显著增加 X 条款和账号风险。

## Chrome 能力

- Manifest V3 content script 可以读取和修改匹配页面的 DOM，并通过扩展消息连接其他上下文：[Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)。
- `chrome.sidePanel` 在 Chrome 114+ 的 MV3 扩展中可用；项目最低版本设为 Chrome 116，以支持由 X 页面用户手势调用 `sidePanel.open()`：[Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)。
- `chrome.storage` 可保存设置；扩展上下文也可以使用 IndexedDB 保存持续增长的结构化数据：[Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)。
- Chrome Prompt API 已支持扩展，并适合本地内容分类，但有操作系统、内存、磁盘及模型下载要求；关系判断不需要它：[Prompt API](https://developer.chrome.com/docs/ai/prompt-api)。

## X 能力与限制

- X 页面在关注列表、用户卡片或个人资料中会呈现部分关系证据；扩展只能针对当前已渲染的证据做保守归一化。
- X 官方说明：账号拉黑其他人后，被拉黑者不能点赞、回复、转发等互动；访问拉黑你的账号资料时也会显示提示。因此“拉黑了我”可以在主动浏览资料/线程时，由明确提示或完整互动限制组合机会式记录，但不能枚举完整名单：[Customizing your X experience](https://help.x.com/en/safety-and-security/control-your-x-experience)、[About being blocked](https://help.x.com/en/using-x/someone-blocked-me-on-x)。
- 单个不可用按钮并不充分：受保护帖子本身不能被转发；查看者自己的账号受限时也可能全局失去点赞、转发或发帖能力。因此评论区三项互动限制必须有同一浮层或页面层的正常帖子作对照；滚动中的空壳、`pointer-events` 锁定和虚拟化隐藏单元格不能当成禁用。另一方面，已完整加载且缺少所有关注/粉丝链接的作者浮窗可作为独立的平台资料限制信号：[Repost FAQs](https://help.x.com/en/using-x/repost-faqs)、[Locked and limited accounts](https://help.x.com/en/managing-your-account/locked-and-limited-accounts)。普通“帖子不可用”和用户正文都不算方向性证据。
- X 2026-04-10 生效的条款禁止未经许可抓取服务内容：[X Terms of Service](https://x.com/en/tos)。本项目因此不做自动爬取，只处理用户正常使用中已经加载的少量页面证据，公开发布前仍需重新评估最新条款。
- X 自动化规则明确反对使用脚本操作网站，并限制自动关注与取关：[Automation rules](https://help.x.com/en/rules-and-policies/x-automation?lang=browser)。本项目不执行任何账户变更。
- 官方 follows API 可以读取或修改关注关系，但需要开发者账户、OAuth 和按量计费；block 写接口目前仅 Enterprise 可用：[Follows API](https://docs.x.com/x-api/users/follows/introduction)、[Blocks API](https://docs.x.com/x-api/users/blocks/introduction)、[Pricing](https://docs.x.com/x-api/getting-started/pricing)。这些接口不在 0.1 范围内。

## 主要风险

| 风险 | 处理方式 |
| --- | --- |
| X DOM 和文案变化 | 所有选择器与本地化模式集中在单一 adapter，并用多语言 fixture 测试 |
| 页面证据不完整 | 缺失证据在内部归类为 `unknown` 后立即丢弃；不显示、不保存、不覆盖已知状态 |
| 互动按钮误判 | 三项均须明确禁用并有同层正常帖子对照；受保护帖的单项限制、滚动空壳和图片浮层背后的时间线不得触发；无计数浮窗必须已完整加载且没有 spinner |
| handle 可能更名 | 0.1 以小写 handle 去重，文档明确此限制；不读取私有内部 ID |
| 本地历史持续增长 | 只在关系、来源变化或超过心跳窗口时新增历史；支持导出和清空 |
| 页面性能 | MutationObserver 合并更新、签名去重、批量写入、长列表 `content-visibility` |
| 误解为 X 操作器 | Manifest 不申请 scripting/tabs/cookies/webRequest；界面与文档反复声明无账户操作 |

## 暂缓能力

- 主动滚动完整 following/followers 列表；
- 后台打开或遍历用户资料；
- 自动关注、取关、拉黑、静音或隐藏 X 内容；
- 主动调用 X API、私有 GraphQL 或拦截网络响应；当前页 UI store 里已经载入、且对应可见账号的关系字段除外；
- Chrome Built-in AI 内容标签。
