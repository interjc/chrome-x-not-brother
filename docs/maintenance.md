# 维护指南

## X DOM 漂移

页面标注最可能因 X 的 DOM 和本地化文案变化失效。发现问题时：

1. 在 Side Panel 暂停观察器，避免继续生成错误数据。
2. 记录 URL 类型、X 界面语言、预期关系和实际标注。
3. 保存最小化、脱敏的 DOM fixture；不要保存帖子正文或不必要个人数据。
4. 只修改 `src/content/x-adapter.ts`，并添加复现测试。
5. 证据消失时返回内部 unknown，不得猜测 negative；unknown 不得进入徽标、数据库、导入导出或计数。
6. 运行完整检查和手工验收。

优先使用语义化 `data-testid`、标准个人资料 href 和明确可见文本。禁止依赖混淆后的 React 内部属性或 X 私有网络响应。

帖子作者常使用 `data-testid="User-Name"`，列表/资料常使用 `UserName`，两者都必须保留 fixture。blocked-by 平台提示匹配必须排除 `tweetText`；不得把用户正文或泛化的 “This Post is unavailable” 当作拉黑证据。

评论区互动限制的结构规则必须同时覆盖 reply、retweet/unretweet、like/unlike。只有三组全部不可操作且同页存在三组均正常的帖子时才生成 `blocked-interaction-restriction`。X 可能把 `data-testid` 放在按钮本身、把禁用状态放在更外层祖先，因此 actionability 检查必须遍历到评论 surface。

已显示的 `HoverCard` 在没有 progress/loading 状态且找不到该 handle 的 `/following`、`/followers`、`/verified_followers` 链接时，独立生成 `blocked-profile-summary-restriction`。保留正常浮窗含计数链接、仅禁用转发、没有同页基线和查看者全局受限等反例 fixture。已知记录由 `users:lookup` 回标，删除或导入数据后 `data:changed` 必须清空 content cache 并重新查询。

普通关系补全也可使用已完整加载的可见 `HoverCard`，但必须按规范化 handle 精确配对。优先使用稳定的 `*-follow`、`*-unfollow` 与 `userFollowIndicator`，不要只依赖本地化文案；保留互关、我单向关注、未支持语言 indicator 和跨 handle 不污染的 fixture。

评论区卡片通常不直接包含关系字段，只有用户悬停作者后 X 才渲染 `HoverCard`。观察器运行但总数为零时，dock 与 Side Panel 必须用三语文案说明这一证据可见性要求；出现首条可信观察后，dock 恢复通用的可见证据说明。排查“一个用户也没识别”时，先在真实页面悬停一个已知关系作者并观察浮窗、徽标与 summary 是否同步变化，再判断为 adapter 或存储故障。

## 错误关系恢复

- 修复 adapter 后，可让后续可信观察更新当前关系；
- unknown 在 content/storage 边界被丢弃，启动时会清除旧版 unknown；
- 用户可删除单条本地记录；
- 大范围污染时先导出备份，再清空数据库重新观察。

## 扩展上下文失效

在 `chrome://extensions` 重新加载开发版后，已经打开的 X 标签页仍可能短暂保留旧 content script。Chrome 会使旧脚本的扩展 API 上下文失效，典型日志是 `Extension context invalidated`，旧代码还可能继续访问缺失的 `chrome.storage.local`。

content script 必须把这种情况视为生命周期结束：捕获 promise rejection、停止定时器、断开 MutationObserver，并移除旧徽标和观察 dock；不得把它作为普通运行时错误持续重试。开发者重新加载扩展后仍需刷新所有已打开的 X 标签页，注入新版本脚本。错误页保存的是历史记录，复验前先点击 Clear all，再刷新目标页。

## 数据库

任何 schema 变化都必须使用新的 Dexie version 和迁移。不得在升级时静默清空数据库。破坏性迁移需要明确发布说明和用户备份步骤。

如果读取的数据类型、用途、传输对象或保存位置发生实质变化，提高 `CURRENT_CONSENT_VERSION`，同步修改首次披露与隐私文档，并在新版本继续观察前重新取得用户同意。纯文案修正不得随意重置同意。

`viewerHandle` 仅用于排除本人。修改账号识别逻辑时同时验证：扫描阶段不生成本人 observation、UI 过滤旧记录、service worker 删除已存本人数据。

## 依赖

通过 nvm 进入固定 Node，逐项更新依赖并阅读发布说明。特别关注 TypeScript、esbuild、Dexie、React 和 Chrome types。升级后运行构建、权限校验与 clean profile 手工测试。

## 翻译维护

所有运行时用户文案集中在 `src/i18n/index.ts`，关系识别用的 X 文案仍只放在 adapter。新增 key 必须一次补齐中英日三套 catalog；Manifest 元数据则同步 `public/_locales/en`、`ja`、`zh_CN`。不得在 React 组件、content dock 或 background action 中重新写死某一种语言。

翻译变更后检查窄 Side Panel、完整 dashboard、确认对话框、ARIA label、CSV `relationship_label` 和 X 页面 dock。不要让翻译改变关系语义、隐私承诺或支持功能集合；完整流程见 [国际化设计](localization.md)。

## 文档同步

行为或流程变化时同步维护 `docs/`、README 索引和 `skills/x-relationship-observer/references/` 对应工作流。
