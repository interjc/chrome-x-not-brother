# 国际化设计与维护

Not Brother 首版界面支持简体中文、英语和日语自动切换。国际化只改变展示，不参与关系事实判断，也不写入 users 或 observations。

本地化品牌名固定为：简体中文「不是兄弟」、英语「Not Brother」、日语「兄貴じゃない」。日文使用日语正字「兄貴」；内部包名、数据库名和导出格式继续使用稳定的 `not-brother`，不随界面语言变化。

## 自动语言选择

| 表面 | 语言来源 | 原因 |
| --- | --- | --- |
| Manifest 名称、说明、Chrome 管理页 | Chrome `_locales` 解析 | 由 Chrome 在扩展启动前选择 |
| Side Panel、Relationship Fieldbook、工具栏运行时 title | `chrome.i18n.getUILanguage()` | 与 Chrome 自身界面一致 |
| X 页面关系徽标、观察 dock | X 文档的 `<html lang>`，缺失时回退 Chrome UI 语言 | 注入内容与宿主页面一致 |

语言归一化规则：`zh-*` 使用 `zh-CN`，`ja-*` 使用 `ja`，`en-*` 使用 `en`；任何其他语言完整回退英语。当前不提供手动语言选择器，修改 Chrome 或 X 语言并重新打开/刷新对应页面即可切换。

## 两类词库

Chrome 在 Manifest 解析阶段需要 `public/_locales/en/messages.json`、`ja/messages.json` 和 `zh_CN/messages.json`。这些文件只包含扩展名称、短名称、132 字符内简短说明及工具栏默认标题。`public/manifest.json` 声明 `default_locale: en` 并使用 `__MSG_*__` 引用。

运行时 UI 使用 `src/i18n/index.ts`。中文 catalog 定义 `MessageKey`，英文和日文 catalog 必须满足完全相同的 key 集合，TypeScript 会拒绝缺失或多余项。该模块还集中提供：

- `{count}`、`{handle}` 等纯文本占位符替换；
- 四种可见基础关系、三种可归因变化事件、双方无关的 `none`、通用 changed 的 label、short label 与 description，以及仅供内部兼容的 unknown 文案（运行时不展示或持久化）；
- profile、timeline、thread 等观察来源名称；
- 文档语言和 Chrome UI 语言归一化。

相对时间和绝对时间使用 `Intl.RelativeTimeFormat` 与 `Intl.DateTimeFormat`，避免手写三套复数和日期规则。CSV 的稳定字段名保持英文，`relationship_label` 使用导出时的插件语言。

零记录引导也必须三语一致：它应说明没有徽标时可以悬停作者读取补充关系；不得翻译成扩展会自动打开浮窗，也不得再暗示首页必须先悬停。出现首条观察后，dock 改回通用的“只记录当前页面可见证据”。

变化事件也属于运行时词库：当前已是互关时中文显示“互关”。我单向关注默认显示“单向关注”；只有历史比对确认对方取关后才用四字短标“对方取关 / 你已取关 / 对方拉黑”，英文使用 “They unfollowed / You unfollowed / They blocked you”，日文使用「相手が解除 / 自分が解除 / 相手がブロック」。其他双方都已取消关注不显示徽标。dock 不拆分这些事件，只本地化一个变化总数。

Side Panel 分类筛选的 eyebrow、空状态、`aria-pressed` 操作说明和打开 Profile 的 ARIA label 同样必须三语完整；分类本身复用关系展示词库，不维护第二套名称。

## 新增或修改文案

1. 在中文 catalog 增加语义明确的 key，而不是复用含义相近但上下文不同的文案。
2. 同时完成英文、日文翻译；按钮 title 与 ARIA label 也属于用户可见文案。
3. 在组件中调用 `translate()`，关系与来源分别调用 `relationshipPresentation()`、`sourceTypeLabel()`。
4. 若修改 Manifest 元数据，同步三个 `_locales` 文件。
5. 运行 `npm run check`、`npm run build`、`npm run validate:dist`。
6. 以 Side Panel 约 420px 宽度和完整 dashboard 宽度检查三语换行、tooltip、空状态和首次同意页。

X 的关系证据文本不属于 UI 翻译词库；它们仍集中在 `src/content/x-adapter.ts`，因为这些文本用于识别事实，需要独立的 fixture 和防误判测试。

## Chrome Web Store

三个 `_locales` 目录会让 Developer Dashboard 提供对应 listing 语言。上架时分别选择 English、Japanese 和 Chinese (China)，为每种语言填写含义一致的详细说明；可以为各语言上传本地化截图和视频，但功能声明、隐私边界与权限说明不得因语言而变化。英语是默认和兜底 listing。Homepage URL 与 Support URL 三种语言共用，分别指向 GitHub 仓库和 Issues。

官方参考：[Chrome extension i18n](https://developer.chrome.com/docs/extensions/reference/api/i18n)、[Internationalize the interface](https://developer.chrome.com/docs/extensions/develop/ui/i18n)、[Localize your Web Store listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing/#localize-your-listing)。
