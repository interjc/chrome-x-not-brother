# Not Brother / 不是兄弟

Not Brother（中文名：不是兄弟；日文名：兄貴じゃない）是一个本地优先的开源 Chrome Manifest V3 扩展。源码在 [interjc/chrome-x-not-brother](https://github.com/interjc/chrome-x-not-brother)；问题、建议和支持请到 [GitHub Issues](https://github.com/interjc/chrome-x-not-brother/issues)。它在你正常浏览 `x.com` 时完成两件事：

1. 给页面中已经出现的用户标注可确认的关系状态；
2. 把观察结果和关系变化历史收集到扩展自己的本地数据库。

它不会自动滚动、遍历账号、调用 X 私有接口，也不会点击关注、取关、拉黑或静音按钮。

## 当前范围

- 关系标注：互关、我单向关注、TA 关注了我、TA 拉黑了我；变化会进一步标成“回关了你”“取关了你”或“拉黑了你”，无法可靠归因于对方的其他切换才保留通用“关系变化”。证据不足时不显示也不收集“未知”。
- 被动观察：首页时间线、帖子详情/评论线程、搜索、通知、用户列表和个人资料等已渲染页面。
- 多语言证据：英语、日语、简体中文，并兼容部分繁体中文提示。
- 多语言界面：插件清单、Side Panel、关系档案库、X 页面徽标、观察 dock、工具栏提示和导出标签支持中英日三语自动切换；其他语言回退英语。
- 本地档案：用户当前状态、上一次状态、首次与最后出现时间、来源和观察历史。
- 查看界面：Chrome Side Panel 概览及独立 Relationship Fieldbook 管理页；侧栏分类数字可筛选最近用户，点击用户可由明确手势在新标签页打开其 X 资料。
- 页面状态：X 页面右下角显示观察状态与本地概览；零记录时提示在评论区悬停作者以显示可读关系，可点 `×` 收为带状态点的 NB 悬浮球、点击恢复或打开 Side Panel；工具栏 icon 用 `ON` / `!` 显示运行状态。
- 主题与品牌：扩展页和注入 UI 支持浅色/暗黑模式，使用 ImageGen 生成的 NB 变形标志。
- 数据管理：搜索、筛选、排序、变化确认、JSON/CSV 导出、JSON 合并导入和本地清空。
- 评论区识别：除明确平台提示外，当同一评论的回复、转发、点赞全部不可用且同页其他帖子正常，或已完整加载的作者浮窗缺少全部关注/粉丝计数时，标记并收集“拉黑了我”；本地已知记录会在以后再次遇到该 ID 时回标。
- 浮窗关系补全：已经显示且加载完成的同 handle 作者浮窗可用 X 的关注/取关控件和 `userFollowIndicator` 补全互关、我单向关注或 TA 关注了我；不会把一个浮窗的证据套给其他评论作者。
- 实时与健壮性：DOM 新增、关系文案和关键属性变化会触发合并扫描；观察器运行且页面可见时每 2 秒兜底复扫，恢复焦点时立即检查，隐藏页暂停轮询，重复结果不会反复写入历史；已经打开的 Side Panel 与档案页也会即时同步本人账号和观察设置。
- 隐私门槛：首次安装默认不观察，只有用户确认本地数据披露后才开始。
- 首版不包含 X API 与 Chrome Built-in AI；AI 只作为后续可选内容标签能力。

## 开始开发

Node.js 通过 nvm 管理。仓库固定使用 `.nvmrc` 中的 Node `24.19.0`：

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm install
npm run check
npm run build
npm run validate:dist
```

然后打开 `chrome://extensions`，启用 Developer mode，选择 **Load unpacked** 并加载仓库中的 `dist/`。每次重新构建并点击扩展的“重新加载”后，还要刷新已经打开的 X 标签页，让旧 content script 退出并注入新版本。

更多步骤见 [开发指南](docs/development.md) 和 [使用指南](docs/usage.md)。代理或自动化工具还必须遵守 [AGENTS.md](AGENTS.md)。

## 项目结构

```text
src/content/       X 页面证据提取与徽标注入
src/background/    service worker 与持久化消息入口
src/domain/        关系解析、合并语义、导入导出
src/i18n/          中英日运行时词库、语言归一化与本地化展示
src/storage/       IndexedDB 与扩展设置
src/ui/            Side Panel 与完整管理页
assets/branding/   ImageGen 品牌源图
assets/store/      Chrome Web Store 图标、截图与宣传图
pages/             GitHub Pages：公开隐私政策与使用条款
public/            Manifest、HTML、内容样式与图标
scripts/           构建、校验、打包
skills/            项目级 Codex skill
docs/              面向开发者和用户的文档
terms/             公开隐私政策与使用条款
CONTRIBUTING.md    开源贡献入口
```

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [可行性研究](docs/feasibility.md) | Chrome 能力、X 约束、风险和结论 |
| [确认需求](docs/requirements.md) | grill-me 后确定的首版范围与验收标准 |
| [产品与界面设计](docs/design.md) | 交互原则、标注语义和视觉语言 |
| [国际化设计](docs/localization.md) | 中英日自动切换、词库边界、扩展语言与商店本地化 |
| [技术架构](docs/architecture.md) | 运行时数据流、模块边界和安全约束 |
| [数据模型](docs/data-model.md) | users、observations、合并和迁移规则 |
| [开发指南](docs/development.md) | nvm、安装、构建、目录与日常流程 |
| [测试指南](docs/testing.md) | 自动检查和 Chrome 手工验收清单 |
| [维护指南](docs/maintenance.md) | X DOM 漂移、数据迁移与故障处置 |
| [X 扩展实时观察调研](docs/x-extension-resilience-research.md) | 其他开源 X 扩展的 DOM 策略、可采用模式与本项目混合复扫设计 |
| [使用指南](docs/usage.md) | 加载、标注、档案库、导入导出、清空与反馈 |
| [贡献指南](docs/contributing.md) | 产品边界、Issue、开发环境、检查与 Pull request |
| [隐私政策](terms/privacy.md) | 收集内容、保存位置、权限、删除方式和联系方式；公开页为 GitHub Pages |
| [使用条款](terms/terms.md) | 独立软件声明、使用范围、识别限制与免责 |
| [首次上架准备](docs/deploy.md) | 第一次发布：已完成项、截图做法、Dashboard 逐步操作 |
| [发布指南](docs/release.md) | 版本、检查、打包、商店准备和回滚 |
| [Chrome Web Store 上架](docs/chrome-web-store.md) | 开发者账号、文案、素材、隐私披露、审核、更新与回滚 |
| [Chrome Web Store 三语文案](docs/store-listing.md) | 可粘贴的中英日名称、简介、详细说明、更新说明、权限理由与审核备注 |
| [项目 skill](skills/x-relationship-observer/SKILL.md) | Codex 开发、维护、使用、发布工作流入口 |

## 质量命令

```bash
npm run check             # TypeScript + unit tests
npm run test:coverage     # coverage report
npm run build             # production extension in dist/
npm run validate:dist     # manifest, permissions, files
npm run skills:validate   # project skill structure
npm run package           # ZIP in artifacts/ and output/
npm run version:bump -- patch   # 同步升版本并插入商店更新说明标题
npm run release           # 完整本地发布构建；上传 output/not-brother-<version>.zip
```

## License

[MIT](LICENSE)

欢迎通过 [GitHub Issues](https://github.com/interjc/chrome-x-not-brother/issues) 反馈问题。代码贡献见 [贡献指南](docs/contributing.md)。

## Author

Justin Chen · [X](https://x.com/interjc) · [Profile](https://interjc.net)
