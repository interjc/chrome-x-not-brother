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

实时识别采用事件与轮询混合机制。MutationObserver 负责新增/移除节点、关系文案和关键可访问性属性变化；可见且已启用的页面每 2 秒兜底复扫一次，页面恢复可见或重新获得焦点时立即复扫。轮询只查询当前 DOM，不滚动、不打开页面、不触发 X 控件。扫描必须保持 single-flight，MutationObserver、轮询、设置变化和 SPA URL 变化同时触发时只排队一次补扫；签名去重必须阻止相同结果重复写历史，但只能在 service worker 确认对应用户已持久化后提交，瞬时发送失败要留给后续复扫重试。

注入 dock 的 `data-xro-version` 是只读诊断标记。重新加载 unpacked 扩展后必须刷新已有 X 标签页；维护者可用该标记确认页面已经替换旧 content script，再进行真实页面验收。

调整轮询时先测量可见 `User-Name` 数量、单次扫描耗时和一分钟内 observation 写入次数。不得在隐藏标签页维持兜底复扫；扩展上下文失效时必须移除 visibility/focus 监听并停止定时器。`style` 与 `class` 变化频率很高，不加入全局 attributeFilter，依靠 2 秒兜底覆盖。

关系档案的确认、删除、导入和清空必须向 service worker 发送 `data:changed`，service worker 再用 `chrome.tabs.sendMessage` 尝试通知全部标签页；没有 content script 的标签页拒绝消息属于正常情况。content script 收到后无条件清除 record/requested cache，运行中才安排复扫。不要清空 observation signature，否则用户刚删除的当前可见记录可能被同一证据立即重新写回。

帖子作者常使用 `data-testid="User-Name"`，列表/资料常使用 `UserName`，两者都必须保留 fixture。blocked-by 平台提示匹配必须排除 `tweetText`；不得把用户正文或泛化的 “This Post is unavailable” 当作拉黑证据。互动限制路径还必须确认回复、转发、点赞三种控件都已实际渲染，控件缺失不能等同于禁用。

评论区互动限制的结构规则必须同时覆盖 reply、retweet/unretweet、like/unlike。只有三组控件均已渲染、全部不可操作且同页存在三组均正常的帖子时才生成 `blocked-interaction-restriction`。X 可能把 `data-testid` 放在按钮本身、把禁用状态放在更外层祖先，因此 actionability 检查必须遍历到评论 surface。

已显示的 `HoverCard` 在没有 progress/loading 状态且找不到该 handle 的 `/following`、`/followers`、`/verified_followers` 链接时，独立生成 `blocked-profile-summary-restriction`。保留正常浮窗含计数链接、仅禁用转发、没有同页基线和查看者全局受限等反例 fixture。已知记录由 `users:lookup` 回标，删除或导入数据后 `data:changed` 必须清空 content cache 并重新查询。

普通关系补全也可使用已完整加载的可见 `HoverCard`，但必须按规范化 handle 精确配对。`hidden`、`inert`、`aria-hidden`、`display:none`、`visibility:hidden` 或透明度为零的残留浮窗不得参与判断。优先使用稳定的 `*-follow`、`*-unfollow` 与 `userFollowIndicator`，不要只依赖本地化文案；保留互关、我单向关注、未支持语言 indicator、隐藏旧浮窗和跨 handle 不污染的 fixture。

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

“回关了你”“取关了你”“拉黑了你”是从前后基础关系动态推导的展示事件，不是新的数据库关系值。修改推导规则时覆盖三种正向转换与用户自身关注变化的歧义反例；保持 dock 只按 `hasChanged` 汇总，不要为展示标签增加 schema 字段。

如果读取的数据类型、用途、传输对象或保存位置发生实质变化，提高 `CURRENT_CONSENT_VERSION`，同步修改首次披露与隐私文档，并在新版本继续观察前重新取得用户同意。纯文案修正不得随意重置同意。

`viewerHandle` 仅用于排除本人。修改账号识别逻辑时同时验证：扫描阶段不生成本人 observation、UI 过滤旧记录、service worker 删除已存本人数据。

## 依赖

通过 nvm 进入固定 Node，逐项更新依赖并阅读发布说明。特别关注 TypeScript、esbuild、Dexie、React 和 Chrome types。升级后运行构建、权限校验与 clean profile 手工测试。

## 翻译维护

所有运行时用户文案集中在 `src/i18n/index.ts`，关系识别用的 X 文案仍只放在 adapter。新增 key 必须一次补齐中英日三套 catalog；Manifest 元数据则同步 `public/_locales/en`、`ja`、`zh_CN`。不得在 React 组件、content dock 或 background action 中重新写死某一种语言。

翻译变更后检查窄 Side Panel、完整 dashboard、确认对话框、ARIA label、CSV `relationship_label` 和 X 页面 dock。不要让翻译改变关系语义、隐私承诺或支持功能集合；完整流程见 [国际化设计](localization.md)。

## 文档同步

行为或流程变化时同步维护 `docs/`、README 索引和 `skills/x-relationship-observer/references/` 对应工作流。
