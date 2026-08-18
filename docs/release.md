# 发布指南

第一次上架已经提交审核。这份文档管**以后每一次更新**。第一次账号、Pages、商店字段怎么点，见 [首次上架准备](deploy.md)。

## 当前已落实

- 开发者账号按非交易者申报；以后做付费或产品站引流再改交易者。
- 公开隐私政策是 GitHub Pages，不是仓库 `blob` 链接。商店不接受 `github.com/.../blob/...`。
- 隐私政策：https://interjc.github.io/chrome-x-not-brother/privacy.html
- 使用条款：https://interjc.github.io/chrome-x-not-brother/terms.html
- 商店 Homepage 是 GitHub 仓库，Support 是 Issues。
- 类别是 **Productivity**。
- 上传用的 ZIP 在 gitignore 的 `output/`；`artifacts/` 保留历史包。

源稿在 `terms/`，对外 HTML 在 `pages/`。改了条款或隐私后必须同步这两处，推到 `main`，等 Actions 里 `Deploy GitHub Pages` 变绿，再用无痕窗口确认公开页。

## 以后再发一版

1. 功能仍只做标注和本地收集。
2. 升版本：

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm run version:bump -- patch
```

`patch` 可换成 `minor`、`major` 或具体号，例如 `0.5.0`。脚本会同时改 `package.json` 和 `public/manifest.json`，并在 [store-listing.md](store-listing.md) 插入三语更新说明空标题。把新版本的要点写进去，三种语言说同一件事。

3. 若改了权限、收集范围或同意流程：先改 `terms/` 与 `pages/`、提高同意版本，再打包。
4. 本地构建并打上传包：

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm ci
npm run release
```

这会依次跑 `check`、覆盖率测试、`skills:validate`、`build`、`validate:dist`、打包，并检查 GitHub Pages 上的隐私政策和条款还能打开。没有网时用 `npm run release -- --skip-pages`。

5. 上传文件是：

`output/not-brother-<version>.zip`

不要手压 `dist/`。解压后根目录必须直接是 `manifest.json`。

6. 在干净 Chrome 配置里 Load unpacked `dist/`，按 [测试指南](testing.md) 做相关验收。
7. Dashboard → 该条目 → Package → 上传新 ZIP。更新三种语言的 listing 更新说明。隐私字段若没变就不用改。取消自动发布后提交审核。
8. 审核通过后 30 天内点 Publish。新增权限会让已装用户再授权。

`npm run validate:dist` 仍会检查：三语 Summary 不超过 132 字且与 store-listing 一致；当前版本的三语更新说明标题都在。

## 单个脚本

先加载 nvm，再在仓库根目录执行。

| 命令 | 做什么 |
| --- | --- |
| `npm run check` | TypeScript + 单元测试 |
| `npm run test:coverage` | 覆盖率 |
| `npm run build` | 产出 `dist/` |
| `npm run validate:dist` | 检查 dist、权限、商店 URL、版本文案 |
| `npm run skills:validate` | 检查项目 skill |
| `npm run package` | 构建、校验，并把 ZIP 写到 `artifacts/` 和 `output/` |
| `npm run verify:pages` | 请求公开隐私政策和条款页 |
| `npm run version:bump -- patch` | 同步升版本并插入商店更新说明标题 |
| `npm run release` | 完整本地发布构建；上传 `output/not-brother-<version>.zip` |

对应文件在 `scripts/`：`build.mjs`、`validate-dist.mjs`、`package.mjs`、`verify-pages.mjs`、`bump-version.mjs`、`release.mjs`。

## 商店更新时记得

- 隐私政策 URL 必须是 `https://interjc.github.io/chrome-x-not-brother/privacy.html`。
- 主机权限理由仍只解释 `https://x.com/*`，文案在 [store-listing.md](store-listing.md)。
- 不要把 GitHub README 上的作者 X / Profile 写进商店简介当推销。
- 商店审核通过不代表 X 允许额外行为。

政策和字段细节见 [Chrome Web Store 标准上架指南](chrome-web-store.md)。

## 回滚

保留 `artifacts/` 里的上一版 ZIP。回滚前让用户导出 JSON。装回旧包后确认 schema 还能读。不要靠静默清空 IndexedDB 当常规回滚。
