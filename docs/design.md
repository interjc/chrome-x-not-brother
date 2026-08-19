# 产品与界面设计

## 产品模型

产品流程是：

```text
Observe → Mark → Remember → Detect change → Review
```

不存在 `Act` 阶段。管理页中的确认、导入、导出和删除只修改扩展本地数据。

## 页面标注

徽标插在 X 用户名区域，保持不可点击，避免与 X 原生控制混淆。时间线与评论区放在显示名称同一行；关注列表、相关用户和作者浮窗等 `UserCell` / `HoverCard` 把关系标签放在头像正下方，不插入显示名称行，也不覆盖右侧关注按钮。

| 状态 | 中文短标 | 色彩 | 证据要求 |
| --- | --- | --- | --- |
| Mutual | 互关 | 绿色 | following=true 且 followsYou=true |
| Following only | 单向关注 | 琥珀色 | following=true 且 followsYou=false |
| Follows you only | 关注了你 | 蓝色 | following=false 且 followsYou=true |
| Blocked by | 拉黑了你 | 珊瑚红 | 明确平台提示、三项互动限制加同页对照，或已加载的无关系计数浮窗 |
| Unfollowed you | 对方取关 | 琥珀色 | 历史比对：互关变为我单向关注，或对方原先关注我现在不再关注 |
| You unfollowed | 你已取关 | 蓝色 | 互关变为对方关注我 |
| Blocked you | 对方拉黑 | 红色 | 已知正常关系变为 blocked-by |
| Changed | 关系变化 | 玫红色 | 双方同时变化、无法单方归因的其他已知关系变化 |

关系变化是由 `previousRelationship` 与当前基础关系动态推导的覆盖显示状态，基础当前关系仍保存在记录中。当前已是互关时一律显示“互关”。当前是我单向关注时默认显示“单向关注”；只有历史比对证明对方曾经关注我、现在不关注，才覆盖为“对方取关”。可以明确归因的单方取关或拉黑用四字短标：对方取关、你已取关、对方拉黑。`follows_you_only → none` 属于对方取关，要显示并进入待确认变化；其他双方都已取消关注（`none`）不插入徽标，也不进入概览计数。只有双方同时变化的歧义切换保留通用“关系变化”，且不得把用户自己的关注/取关说成对方行为。用户在管理页确认后，徽标恢复显示当前基础关系。

`unknown` 只用于 adapter 表示证据不足，不是用户可见关系：不插入徽标、不写本地档案，旧版本的 unknown 记录也会被清理。重点关系采用更强的 ID 区域提示：我单向关注使用琥珀色左边线与底色，blocked-by 使用红色左边线、底色和带 `!` 的高对比矩形徽标。徽标与显示名称放在同一条紧凑横排中，X 的 `@handle` 与日期元数据仍保留在原生位置；底色和边线不增加用户名区域的几何尺寸，避免评论卡片被撑成额外一行。

评论区 blocked-by 有两条独立证据路径：回复、转发、点赞三项同时不可操作且同页另有三项都正常的帖子；或该账号当前已经完整显示的浮窗没有 following/follower 链接。真实 X DOM 可能只把转发设为 disabled，而回复和点赞仍显示为可点击，随后由后端拒绝；这种情况下只有浮窗路径能够被动、无副作用地确认。受保护帖只有转发不可用时不得触发。

content script 会向 service worker 批量查询当前可见 handle 的本地已知记录。因此一个账号通过浮窗或资料提示被确认后，即使浮窗关闭或以后某张评论卡片没有新证据，仍会以已保存的可信关系回标 ID；不会显示 unknown。

普通关系也会使用已经显示且完整加载的同 handle 作者浮窗作为补充表面。X 的 `*-unfollow` / `*-follow` 控件分别表达我已关注/未关注，稳定的 `userFollowIndicator` 表达 TA 关注了我；因此评论卡片本身没有关系字样时，悬停作者仍可识别互关、我单向关注或 TA 关注了我。浮窗必须按规范化 handle 精确配对，绝不向其他作者传播证据。

## Side Panel

侧栏用于首次显著披露与低干扰概览：未同意时显示数据用途、同意按钮和本地档案入口；同意后显示观察器运行状态、已观察账号总数、四个重要关系计数、待确认变化提示、最近账号，以及打开完整档案库。四个计数是带 `aria-pressed` 的 editorial index 筛选按钮，变化提示筛选所有待确认事件；再次激活当前筛选返回全部。筛选态用酸性黄色底和标题变化表达，空分类有独立空状态。用户整行是键盘可达的 Profile 链接，以新标签页打开 X；这始终是用户手势导航，不是自动遍历。

最近观察、统计和完整档案均排除 `viewerHandle`。content script 发现当前登录 handle 后，由 service worker 删除已有的本人记录，避免旧版本数据继续出现。

## X 页面观察 Dock

content script 在页面右下角插入一个不可与 X 原生控件混淆的固定 div：显示观察中/已暂停/尚未开启、已观察总数、单向关注、拉黑你和关系变化四项概览。“查看详情/打开侧栏”只打开扩展侧栏；右上角 `×` 将面板收为 54px NB 悬浮球，球上的状态点继续表达运行状态，点击球恢复完整概览。收起偏好保存在 `chrome.storage.local`，刷新和跨 X 标签页保持一致。这些交互都只改变扩展 UI，不触发 X 操作。窄屏时完整 dock 横向贴合安全边距，悬浮球仍固定在右下安全边距。

当观察器已启动但本地总数为零时，dock 的次要说明改为“没有徽标时可悬停作者读取补充关系”，Side Panel 空状态也给出相同操作线索。出现首条可信观察后，dock 恢复为“只记录当前页面可见证据”，避免长期占用状态区域。

## 工具栏状态与安装引导

- 酸性黄 `ON`：用户已同意且观察器运行中；
- 灰色 `!`：用户主动暂停；
- 琥珀色 `!`：尚未完成首次同意。

首次安装会打开扩展自己的 dashboard 引导页。Chrome 不允许在没有用户同意前静默处理页面，因此“自动启动”发生在用户主动确认披露后，而不是安装瞬间。

## 品牌与主题

扩展使用 ImageGen 生成的几何 NB 变形：N 的斜线切入 B，纸白字形配酸性黄切口，置于深墨绿色底。原始生成图保存在 `assets/branding/logo-imagegen-source.png`，Chrome 尺寸位于 `public/icons/`。

最终源图由内置 ImageGen 以 `logo-brand` 用例生成。核心提示词：`single geometric NB monogram; N diagonal structurally cuts through B; warm paper-white glyph; small acid-lime negative-space accent; uniform #16221B square background; flat hard edges; no other text, shadow, gradient, 3D, mockup or watermark`。生成结果只做确定性的尺寸缩放，没有重绘字形。

扩展页面遵循 `prefers-color-scheme`，在暖纸色与深墨绿色之间切换；X 页面 dock 根据宿主页面实际背景亮度选择主题，而不是假定系统主题与 X 主题一致。两种主题保留同一关系色语义，并尊重 `prefers-reduced-motion`。

## 语言与排版

Side Panel、Relationship Fieldbook、工具栏提示和 Manifest 元数据跟随 Chrome UI 语言；X 页面用户名徽标与观察 dock 跟随 `document.documentElement.lang`，因此用户把 X 设成与 Chrome 不同的语言时，注入内容仍与页面一致。支持简体中文、英语和日语，其他语言使用英语兜底。

翻译不仅覆盖正文，也覆盖首次同意、确认对话框、按钮 tooltip、ARIA label、空状态、相对时间、来源类型、CSV 关系标签和 blocked-by 徽标。所有语言复用相同关系色、信息层级和交互，不因语言改变功能集合。详细规则见 [国际化设计](localization.md)。

## Relationship Fieldbook

完整管理页采用“研究者野外记录册”视觉：暖纸色背景、墨绿色正文、酸性黄强调、Newsreader 展示字和 Instrument Sans 正文字。它刻意避开常见 SaaS 白卡片与紫色渐变。

页面由不对称标题、统计条、左侧索引和高密度记录列表组成。列表使用图标按钮配合 tooltip/ARIA label，长列表启用 `content-visibility`，并尊重 `prefers-reduced-motion`。

## 本地操作

- 确认关系变化：清除 `hasChanged`，不修改 X；
- 查看历史：展开最多 30 条最近观察；
- 删除记录：删除本地用户及其历史；
- 导出：JSON 保留全部数据，CSV 只保留当前摘要；
- 导入：只接受格式正确的 Not Brother JSON 并合并；
- 清空：二次确认后清除全部本地 users 和 observations。
- 反馈：Side Panel 与档案库页脚的“发送反馈”只打开公开 GitHub Issues，不上传本地观察数据。
