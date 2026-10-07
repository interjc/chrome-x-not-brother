# 内容脚本性能改造

本文记录 x.com 页面上内容脚本 CPU 占用偏高的排查结论、已落地的改造和保留的约束。改造不改变产品边界和识别语义：仍然只读已渲染的 DOM 和页面已加载的数据，不新增请求，不点击 X 控件。

## 背景

用户反馈插件在浏览 X 时持续占用 CPU，并给出四个怀疑点：

1. `getComputedStyle` 写在沿祖先链逐层向上查的循环里，造成 layout thrashing；
2. 每 2 秒无条件全页重扫；
3. MutationObserver 监听整个文档、范围过宽，与定时复扫、800ms 心跳叠加；
4. `BLOCKED_PATTERNS` 中的 `[^。]*` 有灾难性回溯风险。

我们逐条核对了代码，又顺着一次扫描的完整链路（`processPage` → `scanXDocument` → page-store 桥接 → service worker）找到了几处更大的开销。

## 一次扫描的成本构成（改造前）

一次 DOM 变动或一次定时触发，大致会经过下面这些步骤：

| 步骤 | 位置 | 成本 |
| --- | --- | --- |
| 读设置 | `getSettings()` | `chrome.storage.sync` + `chrome.storage.local` 两次跨进程读取 |
| 读过滤状态 | `refreshFilterStatus()` → `filter-rules:status` | 唤醒 service worker，后者再读设置、规则、拦截计数三份存储 |
| DOM 扫描 | `scanXDocument()` | 每个候选做多次子树遍历、`matches()`、NFKC 归一化 |
| page-store 查询 | `loadPageUserRelationships()` → `page-bridge.ts` | 主世界遍历 Redux state（预算 18,000 个对象）和 React fiber（80 个起点），再把会话内累计的**全部**用户结构化克隆回内容脚本 |
| 时间线过滤 | `applyHideNow()` | 再做一次完整的 `scanXDocument()` |

开启任一时间线过滤后，隐藏扫描器的延迟是 0ms，每批 DOM 变动都会额外跑一次完整扫描。

## 对四个怀疑点的评估

### 1. `getComputedStyle` 逐层查询

影响被高估了：

- `isSemanticallyVisible()` 只对 `HoverCard` 和 `Dropdown` 调用，页面上平时只有 0–1 个，并不是每个候选元素都会调用。
- `computedStyleHides()` 只在 `/status/` 线程页判断互动限制时运行。
- 读 `display` / `visibility` / `opacity` 只触发样式重算，不触发 layout。扫描阶段只读不写，所以只有第一次调用在样式变脏时付费，后续读取命中已算好的样式。

但线程页确实存在重复计算：回复、转推、点赞三种控件的祖先链高度重叠，`actionableEngagementLayers()` 和每个候选的 `engagementIsUnavailable()` 又会把同一批元素再查一遍。

**没有改用 `element.checkVisibility()`。** 它和现有逻辑的语义不同：

- 它会一直查到文档根，而 `isRenderedEngagementTarget()` 只在当前帖子表面内查；
- 子元素写了 `visibility: visible` 时，它认为可见，现有逻辑认为父级隐藏就不可见；
- 它还会把 `content-visibility: hidden` 算进去。

这些差异会直接改变线程页"拉黑"的判定，不属于纯性能改动。

### 2. 每 2 秒无条件重扫

这确实存在，但不能简单改成 30 秒或指数退避。这次复扫是文档规定的兜底机制，负责 MutationObserver 覆盖不到的情况：

- X 高频修改的 `style` / `class` 没有加入 `attributeFilter`，比如浮窗淡入完成；
- `tweetText` 内部的变动被刻意忽略，可选规则要靠这次复扫看到已渲染完的正文；
- 带到期时间的规则过期后，靠复扫恢复被隐藏的帖子；
- 观察结果写入失败时，签名不会提交，靠复扫重试。

真正的浪费在于，滚动期间 DOM 变动本来就在持续触发扫描，定时复扫却照样按点再跑一轮。

### 3. MutationObserver 范围过宽

不能只盯 `[data-testid="primaryColumn"]`：

- 浮窗（HoverCard）和三点菜单（Dropdown）渲染在 `#layers` 里，不在主列内；
- 右侧"推荐关注"在 `aside` 里；
- SPA 切页时 `primaryColumn` 会被整个替换，挂在旧节点上的监听会失效。

800ms 心跳只比较 URL，并读一次 `body` 的背景色来同步主题，开销很小，不是主要来源。

监听范围内确实有可以排除的噪声：

- 视频播放时，计时文本、进度和控件标签每秒都在变，每一次都会排一次全页扫描；
- 扩展自己把徽标插进 X 的节点时，产生的 childList 记录的 target 是 X 的节点，原有过滤条件拦不住，会多扫一轮。

### 4. 正则灾难性回溯

风险很低。匹配对象是 `blockedNoticeText()` 的结果，已经排除了 `tweetText`、`UserName`、`UserDescription` 和扩展自己的徽标，剩下的是很短的平台提示文本。即使模式里有两段 `[^。]*`，在几百字符以内也不会出现可感知的卡顿。

不过大多数帖子根本不含"拉黑"类词汇，每次都跑十几个正则没有必要。

## 新发现的更大开销

### A. 每次扫描都有 4–5 次跨进程调用

`processPage()` 每次都调用 `getSettings()` 和 `refreshFilterStatus()`。后者会唤醒 service worker，再读三份存储。滚动时每秒触发数次，页面静止时也是每 2 秒一次。这部分 CPU 算在扩展的 service worker 进程上，在 Chrome 任务管理器里也会显示为扩展占用。

可是设置、规则和拦截计数都存在 `chrome.storage` 里，变化时本来就会触发 `storage.onChanged`，没有必要每次扫描都重新读。

### B. page-store 桥接每次都回传全量数据

主世界的 `publishUsers()` 每次查询都会：

1. 遍历 Redux state，最多 18,000 个对象；
2. 从最多 80 个起点遍历 React fiber；
3. 把 `harvested`（会话内所有 GraphQL 响应里出现过的用户，只增不减）与上面的结果合并；
4. 通过 `window.postMessage` 把全部用户结构化克隆一遍。

第 4 步的数据量随浏览时间不断增长。`window.postMessage` 还会把这份数据投递给页面上所有 `message` 监听器，包括 X 自己的。

内容脚本实际只用得到两类用户：当前扫描里可见的候选，以及被静音或拉黑你的用户（时间线过滤需要提前知道）。

### C. 时间线过滤开启后，隐藏扫描没有节流

`hideScheduler` 的延迟是 0ms。连续滚动时 X 几乎每帧都在改 DOM，于是全页扫描可能接近每帧一次。

## 改造方案

| # | 问题 | 改造 | 位置 |
| --- | --- | --- | --- |
| 1 | 每次扫描都读设置 | 设置缓存在内容脚本里，`storage.onChanged` 收到设置变化时失效，另设 30 秒上限兜底。用代际计数防止读取过程中发生的变化被旧结果覆盖 | `index.ts`：`readSettings()`、`invalidateSettings()` |
| 2 | 每次扫描都请求 `filter-rules:status` | 结果按当前账号缓存。设置、规则或拦截计数（新增监听 `isHideStatsStorageChange`）变化时失效，30 秒上限兜底 | `index.ts`：`filterStatusIsFresh()`、`invalidateFilterStatus()` |
| 3 | 桥接回传全量用户 | 查询消息新增可选的 `handles` 字段，携带本次扫描的可见 handle。主世界只回传这些用户，外加所有 `muting` / `blocked_by` 为 true 的用户 | `page-store.ts`：`selectPageUsersForQuery()`；`page-bridge.ts`：`publishUsers()` |
| 4 | Redux state 每次都重新遍历 | Redux 根 state 的引用不变时，复用上次的遍历结果 | `page-store.ts`：`usersFromReactStore()` |
| 5 | 2 秒兜底与变动触发的扫描重复 | 每次 `processPage()` 开始时调用 `periodicRescan.postpone()`，重新起算计时，只有连续 2 秒没有扫描才触发兜底 | `periodic-rescan.ts`：`postpone()` |
| 6 | 隐藏扫描没有节流 | 调度器新增 `minIntervalMs`。安静后的第一次请求仍然立即执行，持续变动时最多每 100ms 一次 | `process-scheduler.ts`；`index.ts`：`HIDE_MIN_INTERVAL_MS` |
| 7 | 视频播放器的变动触发扫描 | target 在 `videoPlayer` / `videoComponent` 内部的 mutation 直接忽略。选择器放在 adapter 里 | `x-adapter.ts`：`isInsideXMediaPlayer()` |
| 8 | 插入自己的徽标触发扫描 | 只新增节点、且新增的全是扩展注入 UI 的 childList 记录直接忽略 | `index.ts`：`mutationCannotChangeEvidence()` |
| 9 | 线程页重复读 computed style | 单次扫描内按元素缓存 `computedStyleHides()` 的结果，语义不变 | `x-adapter.ts`：`ComputedHiddenCache` |
| 10 | 每次都跑全部拉黑正则 | 所有拉黑模式都包含 block / ブロック / 屏蔽 / 拉黑 / 封鎖 之一，先用一个正则预筛，不含这些词就跳过整组 | `x-adapter.ts`：`matchesBlockedNotice()` |
| 11 | 个人主页根节点多算一份文本 | `relationshipFacts()` 只在需要时才计算整块表面的平台文本；个人主页根节点是整个主列，原来会白算一遍 | `x-adapter.ts` |

### 关键设计取舍

**过滤后的桥接结果为什么要带上静音和拉黑你的用户。** 时间线过滤要求"已知被静音或拉黑你的账号立即隐藏、不播动画"。这依赖 `muteMemory` 在用户成为候选之前就已经记住了他。如果只回传可见 handle，这类用户要等进入视口后的下一次扫描才被知道，第一次出现时会闪一下。把 `muting` / `blocked_by` 为 true 的用户一并带上，就能保持原有行为，而这类用户通常很少。

**为什么先合并、再过滤。** 主世界先把 `harvested` 和 Redux / fiber 的结果合并，然后才过滤。如果先过滤再合并，同一个用户在两边的字段（比如一边有 `following`，另一边有 `muting`）可能合并不完整。

**为什么设置缓存要加代际计数。** 如果 `getSettings()` 还在进行中时收到了 `storage.onChanged`，读回来的旧值不能被标记为新鲜。代际变化后，这次结果只用一次，下一次扫描会重新读取。过滤状态用同样的办法处理。

**为什么只靠 Redux 根引用判断，不缓存 fiber。** Redux 的约定是不可变更新：根引用不变，内容就没变，否则 X 自己的 selector 也会失效。fiber 的 props 虽然一般也不可变，但其中嵌套的 GraphQL 对象没有同样的保证。一旦缓存过期，错误的关注状态可能被持久化成观察记录，所以 fiber 不做缓存。

## 第二轮改造

第一轮之后，开启时间线过滤时，一批 DOM 变动仍可能触发三次全页 `scanXDocument()`：隐藏调度器一次，`processPage()` 一次，`processPage()` 内部的 `applyHideNow()` 又一次。DOM 扫描本身也会对每个候选的子树反复遍历，并对每个元素调用长选择器的 `matches()`。

| # | 问题 | 改造 | 位置 |
| --- | --- | --- | --- |
| 12 | `processPage()` 扫描后，内部隐藏步骤又全页扫一遍 | 新增 `evidenceGeneration` 计数：未被忽略的 mutation 批次、URL 变化和 2 秒兜底复扫都会递增。`processPage()` 扫描前记下计数和 URL，等待结束后两者都没变，就把本次候选的浅拷贝交给 `applyHideNow()`，否则照旧重扫。独立的隐藏调度器仍然每次都重新扫描，不做跨轮缓存 | `index.ts`：`applyHideNow(scanned?)` |
| 13 | 未开启过滤时，每批变动仍调度一次空的隐藏步骤 | MutationObserver、兜底复扫和 URL 变化改用 `scheduleHideIfFiltering()`：只有已同意且开启了任一过滤时才调度。设置变化、`data:changed`、快捷添加、page-store 更新和启动仍无条件调度，保证关闭过滤后能恢复已隐藏的帖子 | `index.ts` |
| 14 | 主题属性每 800ms 和每次扫描都写一次 | 值没变就不写 | `index.ts`：`setPageTheme()` |
| 15 | 每批变动都对新增节点做浮窗 / 菜单子树查询 | 先查一次文档里有没有 HoverCard / Dropdown；没有时只检查 caret 的 `aria-expanded` 属性变化 | `index.ts`：`batchTouchesQuickRuleHost()` |
| 16 | 子树遍历对每个元素都调用跳过选择器的 `matches()` | 观察、拉黑文案三组跳过选择器的每个分支都要求元素自身带 `data-testid` 或 `data-xro-badge`，所以先用 `hasAttribute` 预筛。单元测试会逐个分支校验这一前提 | `x-adapter.ts`：`maySkip()` |
| 17 | `relationshipFacts()` 对同一表面分别遍历出拉黑文本和普通文本 | 非个人主页根节点时合并成一次遍历，同时产出两段文本，输出与原来逐字相同；个人主页根节点路径不变 | `x-adapter.ts`：`observationAndBlockText()` |
| 18 | `coversHandle()` 每次都线性扫描全部候选 | 按 userKey 建立锚点索引，判断条件不变 | `x-adapter.ts`：`scanXDocument()` |
| 19 | 桥接查询先合并会话内全部 `harvested` 用户再筛选 | 先算出需要的 key（可见 handle，加上任一来源里静音或拉黑你的用户），只合并这些 key，再用合并后的值做最终筛选。结果和原来的"先合并再过滤"完全一致，包括顺序 | `page-store.ts`：`mergeSelectedPageUsers()` |
| 20 | 每个 GraphQL 响应后都推送全部静音 / 拉黑你的用户 | 按用户记录已推送内容的指纹，只推送新增或变化的用户。查询应答仍然包含全部此类用户，内容脚本不会漏掉 | `page-bridge.ts`：`scheduleHideSignal()` |

**为什么复用扫描要传浅拷贝。** `applyHideNow()` 会再次把 page-store 数据写进候选的 `observation`。如果直接用 `processPage()` 的候选对象，等待期间到达的 page-store 更新就会改掉随后要持久化的观察结果。浅拷贝后，持久化内容与原来一致。

**为什么不在隐藏调度器和 `processPage()` 之间共享扫描结果。** 两次扫描通常相隔不到 180ms，但 X 的 `style` / `class` 变化（例如浮窗淡入）和 `src` 变化不在 `attributeFilter` 里，计数感知不到。跨轮复用可能把过期的浮窗可见性或头像写进观察记录，所以只在同一个 `processPage()` 内复用。

## 行为差异

| 场景 | 改造前 | 改造后 |
| --- | --- | --- |
| 开启过滤后连续滚动 | 每批变动后立即隐藏 | 最多晚约 100ms 隐藏；安静后的第一次变动仍然立即处理 |
| 兜底复扫 | 固定每 2 秒一次 | 距上次扫描满 2 秒才触发 |
| 设置或规则变化 | 下一次扫描时读到 | 通过 `storage.onChanged` 立即失效并复扫，30 秒上限兜底 |
| 其他标签页累计的拦截计数 | 下一次扫描时刷新 | 拦截计数存储变化时立即刷新 |
| 未开启任何时间线过滤时的页面变动 | 每批变动都执行一次空的隐藏步骤 | 不再调度；关闭过滤的那一刻仍会恢复全部已隐藏帖子 |
| `processPage()` 等待期间没有新变动 | 内部隐藏步骤重新全页扫描 | 复用本次扫描结果 |

关系识别、拉黑判定、观察写入和徽标展示的结果不变。

## 验证

### 自动检查

```bash
npm run check
npm run build
npm run validate:dist
npm run skills:validate
```

新增的单元测试：

- `process-scheduler.test.ts`：突发请求按最小间隔合并，安静后的请求立即执行；
- `periodic-rescan.test.ts`：`postpone()` 之后，兜底要等满一个完整的安静周期才触发；停止后调用 `postpone()` 无效；
- `page-store.test.ts`：Redux state 引用不变时不重新遍历，引用变化后读到新值；`selectPageUsersForQuery()` 的筛选规则；查询消息 `handles` 字段的校验；
- `x-adapter.test.ts`：视频播放器内节点的识别；关键词预筛后，中英日拉黑文案仍能识别，正文里的拉黑词汇不会误判；三组跳过选择器的每个分支都带 `data-testid` 或 `data-xro-badge`；合并遍历的两段文本与原来分两次遍历的结果一致；
- `page-store.test.ts`（第二轮）：`mergeSelectedPageUsers()` 与"先合并全部再筛选"的结果（含顺序）完全一致。

### 在 Chrome 里测 CPU

自动测试只能证明语义不变，CPU 的实际下降需要在已登录的 X 页面上测：

1. 打开 Chrome 任务管理器（Shift+Esc），分别记录 x.com 标签页和 Not Brother 扩展进程的 CPU。
2. 用 DevTools Performance 面板分别录 10 秒静止和 10 秒连续滚动，对比改造前后脚本耗时，重点看 `scanXDocument` 和 `processPage`。
3. 打开一条带视频的帖子，播放时确认标签页的 CPU 不再随视频计时周期性上升。
4. 分别在关闭和开启时间线过滤两种状态下各测一次。

**注意：** 点"暂停 Observing"不能用来判断是不是本扩展占用了 CPU：

- 只要开启了任一时间线过滤，暂停观察后扫描仍会继续（`shouldRescan` 同时检查 `observerEnabled` 和过滤开关）；
- 主世界对 fetch / XHR 的钩子始终运行，每个 GraphQL 响应都会被再解析一遍。

## 暂未处理的项目

| 项目 | 原因 |
| --- | --- |
| 按 DOM 节点用 WeakMap 缓存扫描结果，只重算新增或变化的 cell | X 的虚拟列表会复用节点，需要从 mutation 记录精确推出失效范围；扫描还依赖跨 cell 的上下文（浮窗补充证据、线程互动对照、推荐模块判断）。改动大、风险高，应先拿到性能数据，确认 DOM 扫描本身仍是瓶颈再做 |
| 暂停观察或未同意时，跳过 GraphQL 响应的二次解析 | 主世界拿不到扩展设置，需要新增一条从内容脚本到主世界的配置消息，还要处理页面加载早期的时序。按网络事件触发，不是持续开销 |
| 把隐藏扫描改成只扫描变动的 cell | 同第一项。`applyTimelineHiding()` 会恢复所有不在本次结果里的已隐藏 cell，局部扫描需要先改成按 cell 维护期望状态 |
