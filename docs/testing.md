# 测试指南

## 自动检查

```bash
npm run typecheck
npm run test
npm run test:coverage
npm run build
npm run validate:dist
npm run skills:validate
```

自动测试至少覆盖：

- 英语、日语、简体中文关系提示；
- mutual、following-only、follows-you-only、blocked-by，以及内部 unknown 不进入收集；
- `UserName` 与评论线程 `User-Name` 作者结构；
- 当前登录用户排除、评论区明确 blocked-by、三项互动受限加同页基线、无计数浮窗独立证据、普通 unavailable 和用户正文防误判；
- 工具栏 `ON` / `!` 三种状态，以及 X 页面观察 dock 的完整面板/悬浮球切换；
- 已知关系变化；
- `following_only → mutual`、`mutual → following_only` 和已知正常关系 `→ blocked_by` 分别显示回关、取关和拉黑事件；歧义转换保持通用 changed，确认后恢复基础关系；
- unknown 不覆盖已知关系、不显示、不发送，旧 unknown 被清理；
- 只有转发不可用、互动控件缺失（即使同页有正常对照）、三项受限但缺少同页对照、正常浮窗含计数时不误判 blocked-by；
- 已确认的本地 blocked-by 可回标当前证据不足的同 handle 卡片；
- 同 handle 完整浮窗可用 follow/unfollow 与 `userFollowIndicator` 补全普通关系，不匹配浮窗不会污染其他作者；
- 评论线程的徽标固定在显示名称同一行，移除徽标时也清理局部横排类，不改变 `@handle` 与日期结构；
- 可见且已启用页面每 2 秒兜底复扫，隐藏页暂停，恢复可见/焦点时立即复扫，重复 start 不产生多个计时器且 stop 清理监听；
- observation 签名只在对应用户确认持久化后提交；未确认发送保持可重试，已确认的相同证据保持去重；
- service worker 把数据变化广播到有 content script 的标签页并忽略无接收端标签页；档案页变更会使已打开 X 页清除本地关系缓存；
- Side Panel 真实 React 组件中的分类按钮、`aria-pressed` 切换、同分类再次取消、变化筛选、筛选空状态、本人排除，以及标准 `https://x.com/<handle>` 新标签链接；
- 已打开扩展页面通过共享 settings hook 接收其他上下文的 viewer handle 与观察器设置变化，并在卸载时移除监听；
- 观察器总数为零时，dock 与 Side Panel 三语空状态把悬停说成补充路径；首条观察后 dock 恢复可见证据说明；
- 首页时间线可从 `/handle/status/:id`、头像链接或带双向隔离符的 `@handle` 识别作者，证据不足时保持 unknown 且不把引用帖回退成外层作者；
- 当前页 UI store、tweet 祖先 fiber，以及页面已完成的 TweetDetail 等 GraphQL 响应中的 `following` / `followed_by` / `blocked_by` 可把首页和评论区 unknown 卡片提升为已知关系；store 里已有查看者时仍要继续读回复作者；缺少完整布尔值不得编造；DOM 已可收集证据时 store 不得覆盖；
- CSV escaping 与 JSON schema validation；
- Manifest 文件、最小权限和所需 build artifacts；
- `en`、`ja`、`zh_CN` Manifest catalog、语言归一化、翻译占位符、关系与来源名称。

## Chrome 手工验收

使用专门测试配置，不提供账号凭据给开发工具。

1. 加载 `dist/`，确认安装时只声明访问 `x.com`，并自动打开扩展自己的安装引导页。
2. 同意前确认工具栏显示琥珀色 `!`；打开 X 并滚动，确认没有关系徽标且 IndexedDB 没有新增观察，同时页面 dock 提示尚未开启。
3. 在引导页或 Side Panel 核对显著披露后主动同意；确认工具栏变为酸性黄 `ON`，刷新 X 后观察开始。
4. 打开 X 首页，确认自己关注的作者在无需悬停时出现单向关注或互关徽标；完全没有载入关系字段的卡片不得出现“未知”徽标，也不得进入最近观察。
5. 打开自己的 following 页面，验证可见 UserCell 的 following 证据。
6. 打开自己的 followers 页面，验证 follows-you 证据。
7. 分别把 Chrome UI 设为英语、日语和简体中文，验证 Side Panel、管理页、首次披露、工具栏 title、时间与确认对话框自动切换；未支持语言应完整回退英语。
8. 把 X 语言设成与 Chrome 不同的支持语言，验证 X 页面徽标和观察 dock 跟随 X 而不是 Chrome。
9. 主动打开一个明确显示 blocked notice 的测试资料，验证本地化的“拉黑了你”。
10. 打开帖子详情/评论线程，验证带明确 blocked-by 平台提示的 `User-Name` 作者被标注。
11. 找到一个评论作者的回复、转发、点赞都不可操作、而同页其他帖子三项正常的场景，验证显示名称同一行出现红色 `! 拉黑了你` 增强徽标并写入档案，同时 `@handle` 与日期仍保持 X 原生排列。
12. 悬停打开一个已知 blocked-by 作者的完整浮窗，验证没有关注/粉丝链接时独立标注并收集；关闭浮窗、刷新页面后仍由本地已知记录回标该评论 ID。
13. 验证只有转发不可用、普通“帖子不可用”、用户正文写出 blocked you、三项按钮尚未渲染（包括同页存在正常基线时）、三项受限但没有同页基线、正常浮窗含计数时均不标注、不收集。
14. 确认自己的帖子/评论没有徽标，Side Panel 最近观察和所有统计也没有本人。
15. 核对 X 页面 dock 的状态和四项概览，点击本地化详情按钮确认打开当前标签页 Side Panel。
16. 点击 dock 右上角 `×`，确认收为带对应状态点的 NB 悬浮球；刷新 X 后仍为悬浮球，点击球、按 Enter 和按 Space 都可恢复完整概览。
17. 保持正常滚动一分钟，确认没有重复徽标、重复 dock、明显布局跳动或控制台异常。
18. 分别以浅色和暗黑系统主题检查扩展页，再切换 X 主题检查页面徽标、完整 dock 与悬浮球。
19. 打开 Side Panel，核对计数和最近列表；依次点击四个分类数字与变化提示，确认列表、标题、`aria-pressed` 和空筛选状态正确，再次点击同一分类恢复全部。用鼠标、Enter 和 Space 激活分类，点击或键盘激活具体用户，确认只在新标签页打开对应 `https://x.com/<handle>` Profile。
20. 打开完整管理页，测试搜索、筛选、排序、展开历史与确认变化；分别核对“回关了你”“取关了你”“拉黑了你”事件，确认 dock 仍只显示一个变化合计数字，确认事件后徽标恢复当前基础关系。
21. 导出 JSON/CSV；确认没有 unknown，CSV 的关系标签使用当前插件语言，再在备份后测试 JSON 合并导入。
22. 暂停观察器，确认工具栏变灰色 `!`、徽标移除且不再收集；恢复后确认继续工作。
23. 导出备份后测试删除单条和清空全部本地数据。
24. 保持 X 标签页打开，在 `chrome://extensions` 重新加载扩展；确认旧脚本不再重复产生 `reading 'local'` 或未捕获的 `Extension context invalidated`，随后刷新 X，确认新脚本恢复 dock 与标注。
25. 在评论区分别悬停互关、我单向关注和未关注的作者，等待浮窗完整加载；验证 `*-unfollow` 加 `userFollowIndicator` 得到互关、只有 `*-unfollow` 得到我单向关注、其他作者当前打开的浮窗不会改变目标评论的关系。
26. 使用空数据库启动观察器，验证 X 页面 dock 和 Side Panel 空状态提示在首页或评论区悬停作者；悬停产生首条可信观察后，dock 改回“只记录当前页面可见证据”。刷新首页或滚走再滚回同一帖，确认本地已确认账号无需再次悬停也能回标。
27. 重载并刷新 X 后，确认 dock 根节点的 `data-xro-version` 等于候选包版本；保持一个关系浮窗打开但不继续操作，确认最迟约 2 秒内出现徽标；切到其他标签页超过 4 秒再返回，确认隐藏期间没有定期扫描，返回后立即补扫。
28. 在 DevTools 中观察一分钟：快速滚动、悬停、切换 X 内页时不得出现并发异常；同一关系和来源不得每 2 秒增加 observationCount，扩展重新加载失效后不再保留轮询或 focus/visibility 监听。
29. 同时打开两个 X 标签页：在标签 A 识别新关系后，标签 B 最迟约 2 秒回标；在档案页确认变化或删除记录后，标签 B 的缓存结果及时更新。普通非 X 标签没有接收端时不得产生未捕获错误，也不得要求新增 `tabs` 权限。
30. 在 Side Panel 和关系档案库页脚点击“发送反馈”，确认新标签页打开 `https://github.com/interjc/chrome-x-not-brother/issues`，且没有因此申请额外权限或发送本地观察数据。

## 边界检查

在 Chrome DevTools Network 和 X 页面行为中确认：扩展没有发起 X API 请求、没有自动滚动或导航、没有对 X 按钮触发 click、没有云端遥测或远程脚本。
