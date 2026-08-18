# X 扩展实时观察与 DOM 健壮性调研

调研日期：2026-08-18。

## 结论

X 是 React 驱动的单页应用，时间线会虚拟化、复用和异步替换节点。只在启动时全量查询一次会漏掉后续内容；只监听 `childList` 也可能漏掉复用节点上的属性或文字更新。成熟扩展通常把“首次扫描、MutationObserver、局部等待、去重和页面生命周期清理”组合使用。

Not Brother 采用以下混合方案：

```text
初次扫描
  + DOM 子树/文字/关键属性 MutationObserver（180ms 合并）
  + 可见且已启用页面每 2 秒兜底复扫
  + focus / visibility restore 立即补扫
  → single-flight 串行处理
  → userKey + relationship + source + evidence 签名去重
  → service worker 跨 X 标签广播本地关系缓存失效
```

轮询只检查当前已经渲染的 DOM，不滚动、不导航、不打开资料、不读取 X 网络接口，也不触发任何 X 控件。页面隐藏时暂停定期复扫；扩展上下文失效时停止 Observer、定时器和事件监听。

## 开源扩展观察

### Control Panel for Twitter

[Control Panel for Twitter](https://github.com/insin/control-panel-for-twitter) 把稳定的 `data-testid` 等选择器集中管理；`observeElement()` 为 Observer 命名并按 global/page/modal 范围保存，重复建立前先断开旧实例；`processCurrentPage()` 在 SPA 页面变化时清理 page observer 后重新配置。`observeTimeline()` 会先处理已有时间线，再观察替换和新增；`getElement()` 使用 `requestAnimationFrame`、timeout 与 `stopIf` 等待异步节点。

可采用：语义选择器、首次处理、Observer 生命周期分组、SPA 换页重建、等待器超时和停止条件。

采用其读取当前页 UI store 中已载入 `following` / `followed_by` 的做法，让首页时间线不必等悬停。不采用：Cookie、主动 GraphQL（例如 AboutAccountQuery）和网络拦截。

### Tweet Recall

[Tweet Recall content script](https://github.com/sourav-bhar/tweet-recall/blob/main/src/content/index.ts) 启动时先枚举已有 tweet，MutationObserver 只处理新增节点自身及其子树；IntersectionObserver 确认节点进入视口，tweet ID Set 去重，500ms 队列防抖后批量发送。

可采用：已有节点首扫、节点自身加子树检查、Set/签名去重、批量合并。

Not Brother 不用 IntersectionObserver 作为硬门槛，因为 X 的 hover card 和关系提示可能短暂显示在时间线节点之外；页面可见性只用于暂停兜底轮询。

### Eight Dollars

[Eight Dollars page script](https://github.com/wseagar/eight-dollars/blob/main/script.js) 同时收集 mutation target、新增节点及其子树中的 tweet、HoverCard、UserCell 与 UserName；它观察 childList 和部分 attribute 变化，用 Set 与 `dataset.processed` 防止重复处理，并以 MutationObserver `waitForElm()` 等待异步节点。

可采用：关键属性变化、候选节点集合、处理去重和异步挂载等待思想。

不采用：用 `innerHTML` 改写原生结构，或主动拉取尚未载入当前页的账号。主世界 bridge 只暴露已经在页面 UI store / tweet fiber 里的关系字段。

## 本项目参数选择

| 机制 | 参数 | 原因 |
| --- | --- | --- |
| Mutation 合并 | 180ms | 吸收 React 一次提交产生的大量 mutation，同时保持接近实时 |
| 可见页兜底 | 2,000ms | 覆盖节点复用、漏报属性、异步浮窗和 SPA 边界；当前页面通常只有少量可见作者节点 |
| 隐藏页 | 不定期复扫 | 避免后台 CPU 消耗；MutationObserver 事件仍可排队，恢复可见时立即补扫 |
| 并发 | single-flight + 最多一次补扫 | 避免慢 storage/message 往返与下一次触发重叠 |
| 写入去重 | observation signature | 相同 userKey、关系、来源和证据在确认持久化后不因 2 秒轮询重复写历史；失败发送不提交签名并保持可重试 |
| 属性监听 | 关系相关白名单 | 覆盖 disabled/ARIA/testid/href；避开高频 class/style 全局噪声 |

2026-08-18 在真实帖子详情页记录到 21 个 `UserName` / `User-Name` 节点。对同类语义选择器、handle 查找和互动控件枚举做 300 次只读基线，共约 90ms，平均约 0.3ms/次。该数字不是完整 adapter 的基准，但证明 2 秒兜底间隔相对当前可见 DOM 规模留有充分余量；发布前仍按测试指南观察长时间滚动和低性能设备。

## 维护原则

- 选择器优先级：`data-testid`、语义 role/ARIA、标准 profile href、精确可见关系文案；
- 每次 X DOM 漂移先保存最小脱敏 fixture，再改 adapter；
- 轮询是漏报兜底，不是扩大观察范围的扫描器；
- 调低间隔前先测量单次扫描时间、可见候选数和 observation 写入次数；
- 可以只读当前页已载入的 UI store 关系字段；不使用 Cookie、私有 GraphQL 请求、网络拦截或自动操作。
