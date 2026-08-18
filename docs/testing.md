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
- unknown 不覆盖已知关系、不显示、不发送，旧 unknown 被清理；
- 只有转发不可用、三项缺少同页对照、正常浮窗含计数时不误判 blocked-by；
- 已确认的本地 blocked-by 可回标当前证据不足的同 handle 卡片；
- 同 handle 完整浮窗可用 follow/unfollow 与 `userFollowIndicator` 补全普通关系，不匹配浮窗不会污染其他作者；
- 观察器总数为零时，dock 与 Side Panel 三语空状态明确提示悬停评论作者；首条观察后 dock 恢复可见证据说明；
- CSV escaping 与 JSON schema validation；
- Manifest 文件、最小权限和所需 build artifacts；
- `en`、`ja`、`zh_CN` Manifest catalog、语言归一化、翻译占位符、关系与来源名称。

## Chrome 手工验收

使用专门测试配置，不提供账号凭据给开发工具。

1. 加载 `dist/`，确认安装时只声明访问 `x.com`，并自动打开扩展自己的安装引导页。
2. 同意前确认工具栏显示琥珀色 `!`；打开 X 并滚动，确认没有关系徽标且 IndexedDB 没有新增观察，同时页面 dock 提示尚未开启。
3. 在引导页或 Side Panel 核对显著披露后主动同意；确认工具栏变为酸性黄 `ON`，刷新 X 后观察开始。
4. 打开 X 首页，确认证据不足的卡片没有“未知”徽标，也没有进入最近观察或数据库。
5. 打开自己的 following 页面，验证可见 UserCell 的 following 证据。
6. 打开自己的 followers 页面，验证 follows-you 证据。
7. 分别把 Chrome UI 设为英语、日语和简体中文，验证 Side Panel、管理页、首次披露、工具栏 title、时间与确认对话框自动切换；未支持语言应完整回退英语。
8. 把 X 语言设成与 Chrome 不同的支持语言，验证 X 页面徽标和观察 dock 跟随 X 而不是 Chrome。
9. 主动打开一个明确显示 blocked notice 的测试资料，验证本地化的“拉黑了你”。
10. 打开帖子详情/评论线程，验证带明确 blocked-by 平台提示的 `User-Name` 作者被标注。
11. 找到一个评论作者的回复、转发、点赞都不可操作、而同页其他帖子三项正常的场景，验证作者 `@handle` 后出现红色 `! 拉黑了你` 增强徽标并写入档案。
12. 悬停打开一个已知 blocked-by 作者的完整浮窗，验证没有关注/粉丝链接时独立标注并收集；关闭浮窗、刷新页面后仍由本地已知记录回标该评论 ID。
13. 验证只有转发不可用、普通“帖子不可用”、用户正文写出 blocked you、三项按钮缺失但没有同页基线、正常浮窗含计数时均不标注、不收集。
14. 确认自己的帖子/评论没有徽标，Side Panel 最近观察和所有统计也没有本人。
15. 核对 X 页面 dock 的状态和四项概览，点击本地化详情按钮确认打开当前标签页 Side Panel。
16. 点击 dock 右上角 `×`，确认收为带对应状态点的 NB 悬浮球；刷新 X 后仍为悬浮球，点击球、按 Enter 和按 Space 都可恢复完整概览。
17. 保持正常滚动一分钟，确认没有重复徽标、重复 dock、明显布局跳动或控制台异常。
18. 分别以浅色和暗黑系统主题检查扩展页，再切换 X 主题检查页面徽标、完整 dock 与悬浮球。
19. 打开 Side Panel，核对计数和最近列表。
20. 打开完整管理页，测试搜索、筛选、排序、展开历史与确认变化。
21. 导出 JSON/CSV；确认没有 unknown，CSV 的关系标签使用当前插件语言，再在备份后测试 JSON 合并导入。
22. 暂停观察器，确认工具栏变灰色 `!`、徽标移除且不再收集；恢复后确认继续工作。
23. 导出备份后测试删除单条和清空全部本地数据。
24. 保持 X 标签页打开，在 `chrome://extensions` 重新加载扩展；确认旧脚本不再重复产生 `reading 'local'` 或未捕获的 `Extension context invalidated`，随后刷新 X，确认新脚本恢复 dock 与标注。
25. 在评论区分别悬停互关、我单向关注和未关注的作者，等待浮窗完整加载；验证 `*-unfollow` 加 `userFollowIndicator` 得到互关、只有 `*-unfollow` 得到我单向关注、其他作者当前打开的浮窗不会改变目标评论的关系。
26. 使用空数据库启动观察器，验证 X 页面 dock 和 Side Panel 空状态提示悬停作者；悬停产生首条可信观察后，dock 改回“只记录当前页面可见证据”。

## 边界检查

在 Chrome DevTools Network 和 X 页面行为中确认：扩展没有发起 X API 请求、没有自动滚动或导航、没有对 X 按钮触发 click、没有云端遥测或远程脚本。
