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
- 当前登录用户排除、评论区明确 blocked-by、三项互动受限加同层基线、无计数浮窗独立证据、普通 unavailable 和用户正文防误判；
- 工具栏 `ON` / `!` 三种状态，以及 X 页面观察 dock 的完整面板/悬浮球切换；同意后展开 dock 显示自定义黑名单应用状态与编辑入口，未同意或收起为球时不出现该行；
- 已知关系变化；
- `following_only → mutual` 与 `follows_you_only → mutual` 显示互关；首次或非取关历史的 `following_only` 显示单向关注；`mutual → following_only` 与 `follows_you_only → following_only` 显示对方取关；`follows_you_only → none` 与其他明确双方都已取消关注不显示徽标；`mutual → follows_you_only` 和已知正常关系 `→ blocked_by` 分别显示你已取关和对方拉黑；双方同时变化保持通用 changed，确认后恢复基础关系；
- 「跟隨誰 / Who to follow」建议卡只有 Follow 按钮时保持 unknown，不得写成 none 或对方取关；有 Follows you 时仍可收集 follows-you-only；
- unknown 不覆盖已知关系、不显示、不发送，旧 unknown 被清理；
- 只有转发不可用、互动控件缺失（即使同页有正常对照）、空 testid 壳、滚动 `pointer-events: none`、`aria-hidden` 虚拟单元格、图片浮层借用背后时间线、三项受限但缺少同层对照、正常浮窗含计数时不误判 blocked-by；
- 已确认的本地 blocked-by 可回标当前证据不足的同 handle 卡片；
- 同 handle 完整浮窗可用 follow/unfollow 与 `userFollowIndicator` 补全普通关系，不匹配浮窗不会污染其他作者；
- 评论线程的徽标固定插在可见 `@handle` 之前，不得出现在时间戳之后；没有可见 handle 时才跟在显示名称后面；帖子详情等不含时间戳的 `User-Name` 应把 X 原有显示名和 `@handle` 放在一行，关系标签单独在下一行，左边线与显示名之间只留 1–2px；移除徽标时也清理局部横排/堆叠类，不改变已含时间祖先的 `@handle` 与日期结构；
- 相关用户 / UserCell 的徽标放在头像正下方，不插入显示名称行；
- Side Panel 最近观察整行打开该账号 X 资料；档案库的头像、显示名和 @handle 也打开同一资料；头像优先使用观察时保存的 X CDN 地址，没有时才按 handle 请求公开图片；
- 可见且已启用页面每 2 秒兜底复扫，隐藏页暂停，恢复可见/焦点时立即复扫，重复 start 不产生多个计时器且 stop 清理监听；
- observation 签名只在对应用户确认持久化后提交；未确认发送保持可重试，已确认的相同证据保持去重；
- service worker 把数据变化广播到有 content script 的标签页并忽略无接收端标签页；档案页变更会使已打开 X 页清除本地关系缓存；
- Side Panel 真实 React 组件中的分类按钮、`aria-pressed` 切换、同分类再次取消、变化筛选、筛选空状态、本人排除、标准 `https://x.com/<handle>` 新标签链接，以及语言选择器默认跟随浏览器并在手工切换后即时改写面板文案；
- 已打开扩展页面通过共享 settings hook 接收 `chrome.storage.sync` 偏好和 `chrome.storage.local` viewer handle 的变化，并在卸载时移除监听；旧 local 偏好迁移不覆盖已有 sync 值，sync 单项保持低于 8 KB；
- 观察器总数为零时，dock 与 Side Panel 三语空状态把悬停说成补充路径；首条观察后 dock 恢复可见证据说明；
- 未同意时，展开 dock 与收起悬浮球旁都有三语、键盘可达的显著披露入口；action 图标右键菜单项可打开 Side Panel、失败时回退 dashboard，完成同意后自动隐藏且不影响内建“选项”；
- 首页时间线可从 `/handle/status/:id`、头像链接或带双向隔离符的 `@handle` 识别作者，证据不足时保持 unknown 且不把引用帖回退成外层作者；
- 主贴和跟帖含大量正文 @提及的线程只识别作者，不把提及 handle 收成候选，平台拉黑提示仍排除 `tweetText`，扫描不得因克隆整篇帖子或遍历提及链接而退化；
- 同意后 HoverCard 在名字旁出现「不是兄弟！」入口、帖子 `caret` 下拉最上方出现同一项、帖子正文划词出现「拉黑关键词」，点击立即保存对应规则且不把浮窗作者误当成正文提及；未同意、本人浮窗或本人帖子不出现该入口；
- 当前页 UI store、tweet 祖先 fiber，以及页面已完成的 TweetDetail 等 GraphQL 响应中的 `following` / `followed_by` / `blocked_by` / `muting` 可把首页和评论区 unknown 卡片提升为已知关系，并供可选时间线过滤使用；store 里已有查看者时仍要继续读回复作者；缺少完整布尔值不得编造；DOM 已可收集证据时 store 不得覆盖；
- 可选时间线过滤默认关闭；打开后互关静音账号和本地已知 blocked-by 账号的首页帖子单元格被隐藏，个人主页/浮窗/UserCell 不隐藏；关闭过滤后单元格恢复；
- 自定义规则 Zod schema 规范化 handle，拒绝未知字段、重复 id/handle、无效或可能灾难性回溯的正则和超限 JSON；handle、显示名、正文、启停与到期匹配正确，关闭总开关或规则到期后帖子恢复；
- content script 仅通过 service worker 的 `filter-rules:get` 取得已校验规则快照；未同意或总开关关闭时后台拒绝返回，content bundle 不包含 Zod 或 `safe-regex2`；
- 规则文件导入会询问追加或清空覆盖，不按 id 合并；公开 HTTPS/Gist URL 解析、单 JSON 选择、截断 Raw 文件、超时/响应大小/HTTP/非法 JSON 错误都安全失败；规则只写当前登录账号命名空间下的 `chrome.storage.local`；
- CSV escaping 与 JSON schema validation；
- Manifest 文件、最小常驻权限、仅用于用户手势远程导入的 optional HTTPS host permission 和所需 build artifacts；
- `en`、`ja`、`zh_CN` Manifest catalog、语言归一化、翻译占位符、关系与来源名称。

## Chrome 手工验收

使用专门测试配置，不提供账号凭据给开发工具。

1. 加载 `dist/`，确认安装时只声明访问 `x.com`，并自动打开扩展自己的安装引导页。
2. 同意前确认工具栏显示琥珀色 `!`；打开 X 并滚动，确认没有关系徽标且 IndexedDB 没有新增观察，同时页面 dock 提示尚未开启。展开 dock 的主按钮应写明“查看说明并同意”；收起后旁边仍有独立高对比入口。两者用鼠标、Enter、Space 均能打开完整披露，但不会自动同意。
3. 右键工具栏图标，确认“查看隐私说明并同意…”与 Chrome 内建“选项”同时存在；前者打开 Side Panel 披露。核对披露后主动同意，确认同意菜单项消失、内建“选项”仍在、工具栏变为酸性黄 `ON`，刷新 X 后观察开始。
4. 打开 X 首页，确认自己关注的作者在无需悬停时出现单向关注或互关徽标；完全没有载入关系字段的卡片不得出现“未知”徽标，也不得进入最近观察。
5. 打开自己的 following 页面，验证可见 UserCell 的 following 证据。
6. 打开自己的 followers 页面，验证 follows-you 证据。
7. 分别把 Chrome UI 设为英语、日语和简体中文，验证 Side Panel、管理页、首次披露、工具栏 title、时间与确认对话框自动切换；未支持语言应完整回退英语。打开 Side Panel 确认语言选择器默认是“跟随浏览器语言”，再分别选日语和英语，确认面板文案、`document.documentElement.lang`、已打开档案库，以及当前 X 页面上的关系徽标和观察 dock 都即时切换；选回“跟随浏览器语言”后，页面标签重新跟随 X 语言。
8. 语言选择保持“跟随浏览器语言”时，把 X 语言设成与 Chrome 不同的支持语言，验证 X 页面徽标和观察 dock 跟随 X 而不是 Chrome。
9. 主动打开一个明确显示 blocked notice 的测试资料，验证本地化的“拉黑了你”。
10. 打开帖子详情/评论线程，验证带明确 blocked-by 平台提示的 `User-Name` 作者被标注。
11. 找到一个评论作者的回复、转发、点赞都不可操作、而同页其他帖子三项正常的场景，验证 `@handle` 前面出现红色 `! 拉黑了你` 增强徽标并写入档案，同时 `@handle` 与日期仍保持 X 原生排列。
12. 悬停打开一个已知 blocked-by 作者的完整浮窗，验证没有关注/粉丝链接时独立标注并收集；关闭浮窗、刷新页面后仍由本地已知记录回标该评论 ID。
13. 验证只有转发不可用、普通“帖子不可用”、用户正文写出 blocked you、三项按钮尚未渲染（包括同页存在正常基线时）、滚动图片查看器右侧列表时出现的空壳/`pointer-events`/`aria-hidden` 单元格、三项受限但没有同层基线、正常浮窗含计数时均不标注、不收集。
14. 确认自己的帖子/评论没有徽标，Side Panel 最近观察和所有统计也没有本人。
15. 核对 X 页面 dock 的状态和四项概览，以及自定义黑名单行：未打开总开关时应显示未应用和规则条数；打开后显示应用中和有效规则数。点击“编辑规则”应打开档案库黑名单页。点击本地化详情按钮确认打开当前标签页 Side Panel。悬停一名作者，点浮窗里紧挨名字的「不是兄弟！」后该 handle 应出现在黑名单并立即保存；打开帖子右上角三个点，菜单最上方同一项应写入该帖作者。在帖子正文划词后点「拉黑关键词」应写入 contains 规则。这些入口都不得点击 X 的拉黑/静音按钮。
16. 点击 dock 右上角 `×`，确认收为带对应状态点的 NB 悬浮球，球仍在右下角；X 自己的聊天/Grok 按钮应上移到球上方，不盖住时间线。刷新 X 后仍为悬浮球，点击球、按 Enter 和按 Space 都可恢复完整概览，聊天/Grok 回到原位。
17. 保持正常滚动一分钟，确认没有重复徽标、重复 dock、明显布局跳动或控制台异常。打开含大量 @提及的帖子详情（例如主贴和跟帖点名很多人的线程），确认页面保持可滚动、只给帖子作者打标、正文提及没有徽标。
18. 分别以浅色和暗黑系统主题检查扩展页，再切换 X 主题检查页面徽标、完整 dock 与悬浮球。
19. 打开 Side Panel，核对计数和最近列表；依次点击四个分类数字与变化提示，确认列表、标题、`aria-pressed` 和空筛选状态正确，再次点击同一分类恢复全部。用鼠标、Enter 和 Space 激活分类，点击或键盘激活具体用户，确认只在新标签页打开对应 `https://x.com/<handle>` Profile。
20. 打开完整管理页，测试搜索、筛选、排序、展开历史与确认变化；核对互关覆盖显示，首次单向关注显示“单向关注”，以及仅在历史比对成立时显示“对方取关”“你已取关”“对方拉黑”；确认其他双方都已取消关注的账号不再出现徽标和概览计数，dock 仍只显示一个变化合计数字，确认事件后徽标恢复当前基础关系。
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
31. 侧栏默认在状态标签显示用户列表；切换到选项后出现语言、徽标和时间线过滤，状态列表被收起。右键工具栏图标选择 **选项**，确认侧栏打开并停在选项标签；三个时间线过滤默认关闭。打开“彻底隐藏已静音账号”后，首页互关但仍被静音的帖子消失，对方主页仍可打开；打开“隐藏拉黑了我的账号”后，本地已记录 blocked-by 的首页帖子以及帖子详情/评论区里该作者的回复都会消失。档案里已有的账号应立刻消失；第一次检测到的账号会先收起再隐藏。档案库的同一开关即时同步。
32. 从旧版本升级时，先在 `chrome.storage.local` 准备旧设置：若 sync 为空，确认偏好迁入 sync、`viewerHandle` 迁入新的 local key；若 sync 已有不同偏好，确认保留 sync 值。未登录 Chrome 或关闭同步时修改偏好仍应立即保存并在重启后保留；登录并启用 Chrome Sync 后由 Chrome 在其他配置恢复这些小型偏好，关系档案和 `viewerHandle` 不应出现。
33. 在 Side Panel、Options 和档案库确认“编辑规则与查看教程”紧邻“应用自定义黑名单规则”开关；前两处点击后打开 `dashboard.html#filter-rules`，规则区自动展开、滚动且键盘焦点落在折叠标题，档案库内点击则原地完成相同行为。确认教程完整解释 handle、文字、正则、时效、导入时的追加或清空覆盖和隐私，并且示例 JSON 可解析且通过 schema。随后添加三种规则并测试启停、大小写和未来/已过期时间；打开总开关后只隐藏允许页面的匹配帖子，Profile、HoverCard、UserCell 和关注列表不隐藏，正文不出现在 IndexedDB 或导出。下载规则 JSON 后选择清空覆盖用文件恢复；再从只有一个 JSON 文件的公开 Gist 导入并选择追加，确认 Chrome 只在点击后请求 GitHub host 权限。拒绝权限、使用 HTTP、超过 1 MiB、多个 JSON 文件或无效正则时，现有规则保持不变且出现可读错误。关闭总开关后全部规则隐藏结果恢复。

## 边界检查

在 Chrome DevTools Network 和 X 页面行为中确认：扩展没有发起 X API 请求、没有自动滚动或导航、没有对 X 按钮触发 click、没有开发者云端遥测或远程脚本。只有用户点击远程规则导入时才访问已授权的公开 HTTPS/Gist 来源，且请求不含 X 数据或本地规则。Chrome 自带的设置同步不包含关系档案、规则文档或 `viewerHandle`。
