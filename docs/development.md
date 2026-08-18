# 开发指南

## 前提

- Google Chrome 116+；
- nvm；
- `.nvmrc` 指定的 Node 24.19.0；
- npm。

非交互 shell 可能解析到旧的系统 Node 8。任何 Node 命令前必须显式加载 nvm：

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
node --version
npm install
```

不要使用系统级 Node 替代 nvm。

本机 Python 由 pyenv 管理。仓库当前没有 Python 运行依赖，也不固定 `.python-version`；若维护工具确实需要 Python，先保证 pyenv 选择的版本可用并通过 `pyenv exec python` 执行，不得静默回退系统或 Framework Python。

## 开发循环

```bash
npm run dev
```

首次在 `chrome://extensions` 启用 Developer mode，选择 **Load unpacked** 并加载 `dist/`。源文件变化后构建会更新 `dist/`，仍需在扩展卡片点击 reload。

本地验收时点击扩展图标打开 Side Panel，先确认首次数据披露并主动同意，再刷新已打开的 X 标签页。若要重测首次同意流程，最简单且最干净的方式是先导出需要保留的数据、移除开发扩展，再重新 Load unpacked；移除扩展会删除该扩展 origin 的本地数据。

## 变更位置

- X 页面结构或文案：`src/content/x-adapter.ts` 与对应 fixture tests；
- DOM 触发、2 秒兜底复扫、single-flight 调度与成功后签名去重：`src/content/index.ts`、`src/content/periodic-rescan.ts`、`src/content/process-scheduler.ts`、`src/content/observation-signatures.ts`；
- 关系规则：`src/domain/relationships.ts`；
- 运行时翻译、关系展示和语言归一化：`src/i18n/index.ts`；
- Chrome 清单本地化：`public/_locales/en|ja|zh_CN/messages.json`；
- 数据结构与迁移：`src/storage/database.ts`；
- 注入徽标：`src/content/badge.ts`、`public/content-script.css`；
- X 页面观察 dock：`src/content/observer-panel.ts`、`public/content-script.css`；
- 工具栏状态与安装引导：`src/background/action-state.ts`、`src/background/service-worker.ts`；
- Side Panel：`src/ui/sidepanel.tsx`；
- 管理页：`src/ui/dashboard.tsx`；
- 视觉 token：`src/ui/styles.css`；
- 品牌源图与 Chrome icons：`assets/branding/`、`public/icons/`；
- 权限：`public/manifest.json`，同时更新校验与隐私文档。

新增或修改用户可见文案时，必须同时补齐 `src/i18n/index.ts` 的 `en`、`ja`、`zh-CN` catalog。修改扩展名称、简短说明或工具栏默认标题时，还要同步三个 `_locales` 目录；`npm run typecheck` 和 `npm run validate:dist` 分别检查运行时词库与 Manifest 词库的完整性。

## 完整检查

```bash
npm run check
npm run test:coverage
npm run build
npm run validate:dist
npm run skills:validate
```

创建或大改项目 skill 时，还应按 `skill-creator` 的要求使用其官方 `quick_validate.py` 做一次校验。该上游脚本需要 Python 与 PyYAML；常规仓库检查使用无额外 Python 依赖的 `npm run skills:validate`。

不要为了方便添加网页自动化、私有 API 或广泛 Chrome 权限。功能建议若越过“标注、收集”边界，必须重新与用户确认。

对外贡献、Issue 和 Pull request 流程见 [贡献指南](contributing.md)。用户反馈入口是 [GitHub Issues](https://github.com/interjc/chrome-x-not-brother/issues)。
