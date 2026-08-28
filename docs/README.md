# 开发者文档

面向使用者的说明在仓库根目录 [README.md](../README.md)，其中「自定义拦截规则」一节说明界面编写、导入导出和公开托管。本目录保存产品边界、架构、开发、测试、发布和商店文案。给编码代理的入口是 [AGENTS.md](../AGENTS.md) 与 [项目 skill](../skills/x-relationship-observer/SKILL.md)。阅读或改写导出的规则 JSON 用 [x-not-brother-rules](../skills/x-not-brother-rules/SKILL.md)。

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [可行性研究](feasibility.md) | Chrome 能力、X 约束、风险和结论 |
| [确认需求](requirements.md) | 首版范围与验收标准 |
| [产品与界面设计](design.md) | 交互原则、标注语义和视觉语言 |
| [国际化设计](localization.md) | 中英日自动切换、词库边界、扩展语言与商店本地化 |
| [技术架构](architecture.md) | 运行时数据流、模块边界和安全约束 |
| [数据模型](data-model.md) | users、observations、合并和迁移规则 |
| [自定义拦截规则](filter-rules.md) | filter-rules JSON v1、匹配语义、限制与导入权限 |
| [开发指南](development.md) | nvm、安装、构建、目录与日常流程 |
| [测试指南](testing.md) | 自动检查和 Chrome 手工验收清单 |
| [维护指南](maintenance.md) | X DOM 漂移、数据迁移与故障处置 |
| [X 扩展实时观察调研](x-extension-resilience-research.md) | 其他开源 X 扩展的 DOM 策略与本项目混合复扫设计 |
| [使用指南](usage.md) | 加载、标注、档案库、导入导出、清空与反馈 |
| [贡献指南](contributing.md) | 产品边界、Issue、开发环境、检查与 Pull request |
| [隐私政策](../terms/privacy.md) | 收集内容、保存位置、权限、删除方式和联系方式 |
| [使用条款](../terms/terms.md) | 独立软件声明、使用范围、识别限制与免责 |
| [首次上架准备](deploy.md) | 第一次发布：已完成项、截图做法、Dashboard 逐步操作 |
| [发布指南](release.md) | 版本、检查、打包、商店准备和回滚 |
| [Chrome Web Store 上架](chrome-web-store.md) | 开发者账号、文案、素材、隐私披露、审核、更新与回滚 |
| [Chrome Web Store 三语文案](store-listing.md) | 可粘贴的中英日名称、简介、详细说明、更新说明、权限理由与审核备注 |

公开隐私政策和条款的 HTML 在 [pages/](../pages/)，由 GitHub Pages 发布：

- https://interjc.github.io/chrome-x-not-brother/privacy.html
- https://interjc.github.io/chrome-x-not-brother/terms.html

## 项目结构

```text
src/content/       X 页面证据提取与徽标注入
src/background/    service worker 与持久化消息入口
src/domain/        关系解析、合并语义、导入导出
src/i18n/          中英日运行时词库、语言归一化与本地化展示
src/storage/       IndexedDB 与扩展设置
src/ui/            Side Panel、选项页与完整管理页
assets/branding/   品牌源图
assets/store/      Chrome Web Store 图标、截图与宣传图
pages/             GitHub Pages：公开隐私政策与使用条款
public/            Manifest、HTML、内容样式与图标
scripts/           构建、校验、打包
skills/            项目级开发 skill
docs/              开发者与维护文档
terms/             公开隐私政策与使用条款源稿
```

## 质量命令

先加载 nvm，再在仓库根目录执行。

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm run check             # TypeScript + unit tests
npm run test:coverage     # coverage report
npm run build             # production extension in dist/
npm run validate:dist     # manifest, permissions, files
npm run skills:validate   # project skill structure
npm run package           # ZIP in artifacts/ and output/
npm run version:bump -- patch   # 同步升版本并插入商店更新说明标题
npm run release           # 完整本地发布构建；上传 output/not-brother-<version>.zip
```
