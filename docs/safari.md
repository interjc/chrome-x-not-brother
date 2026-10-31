# Safari 支持方案：GitHub Release 自动构建，手动安装

Chrome Web Store 仍是唯一的正式发布渠道。Safari 只是锦上添花：**不上 Mac App Store，不新增人工发布步骤**。`main` 分支上每出现一个新版本号，GitHub Actions 就自动构建 Safari 安装包并挂到 GitHub Release，Safari 用户自己下载安装。

这是**方案文档**，截至本文写作时仓库里还没有任何 Safari 专用代码。落地后要同步更新 [发布指南](release.md)、[测试指南](testing.md)、[使用指南](usage.md)、`AGENTS.md` 和项目 skill 的 references；面向用户的安装步骤写进 `README.md` / `README.en.md`。

兼容性结论来自 Apple 官方文档、WWDC26 与 MDN `@mdn/browser-compat-data` 8.1.7（见文末来源），最后核验于 2026-10-31。

## 1. 结论

| 层 | 做法 | 维护成本 |
| --- | --- | --- |
| 代码 | 同一个 `src/`、同一次 `npm run build`。Safari 缺失的 API 先做能力检测再调用，不做浏览器检测 | 一个很小的平台模块，外加几处调用点 |
| 打包 | `npm run package` 从同一份 `dist/` 多生成一个 Safari ZIP，只是 manifest 由脚本改写 | 一个纯函数加单测 |
| 发布 | 新增 `.github/workflows/release.yml`：`main` 上版本号变化时自动打 tag、建 Release、上传安装包 | 一次性配置，之后零操作 |
| 分发 | 用户从 GitHub Release 下载：**A. 签名 App**（推荐，长期安装）或 **B. 临时扩展文件夹**（零配置，每次重启 Safari 要重新加载） | A 需要一次性配置 Apple 证书 Secrets；B 无 |

本地发版流程**完全不变**：照旧 `npm run release:patch`、上传 Chrome 商店、推送到 `main`。Safari 包由 CI 自动生成。

## 2. 用户的两种安装方式

### A. 签名并公证的 App（推荐）

GitHub Release 附件 `Not-Brother-Safari-<version>.zip` 里是一个用你的 **Developer ID 签名并经 Apple 公证**的 macOS App，扩展就在这个 App 里。

- 要求 **Safari 18.4 及以上**：Apple 从这个版本起允许在 App Store 之外分发 Developer ID 签名、公证过的 Safari 扩展；更早的版本仍需打开“允许未签名扩展”。
- 用户的步骤：下载 → 解压 → 把 App 拖进“应用程序” → 打开一次 → 在 Safari 设置的“扩展”里勾选 Not Brother → 允许它访问 x.com。
- 已经公证，所以 Gatekeeper 不会拦，也不需要开发者模式；装好后长期有效。
- 不会自动更新：用户要手动下载新版本覆盖旧 App。数据保存在扩展自己的存储里，覆盖安装后会保留（落地时验证一次）。

### B. 临时扩展（零签名后备）

GitHub Release 附件 `not-brother-safari-<version>.zip` 是扩展文件夹本身。Safari 26 起可以不经过 Xcode 直接加载：

1. Safari 设置 → 高级 → 勾选“显示网页开发者功能”；
2. Safari 设置 → 开发者 → 勾选“允许未签名的扩展”，点击 **Add Temporary Extension…**，选择解压后包含 `manifest.json` 的文件夹；
3. 在扩展设置里允许它访问 x.com。

缺点：**退出 Safari 后扩展会被卸载**，下次要重新加载。适合尝鲜，或者在你还没配置签名 Secrets 时先提供一个渠道。

不建议提供未签名的 `.app`（Xcode 的 “Copy App” 导出）：用户既要绕过 Gatekeeper，又要每次启动 Safari 都打开“允许未签名的扩展”，比 B 还麻烦。

## 3. 自动构建：`.github/workflows/release.yml`

### 3.1 触发条件

现有发版习惯是本地执行 `npm run release:patch` 后，把 `release vX.Y.Z` 提交推到 `main`，仓库里没有 tag。因此 workflow 这样触发：

- `push` 到 `main`，并且 `paths` 包含 `package.json`；
- 读取 `package.json` 的 `version`；如果 tag `v<version>` 已存在就直接结束，所以普通依赖升级不会重复发版；
- 另加 `workflow_dispatch`，方便手动重跑。

### 3.2 两个 job

```yaml
# 示意，不是最终文件
name: Release

on:
  push:
    branches: [main]
    paths: ["package.json"]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.meta.outputs.version }}
      skip: ${{ steps.meta.outputs.skip }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - id: meta
        run: |
          version=$(node -p "require('./package.json').version")
          echo "version=$version" >> "$GITHUB_OUTPUT"
          if git ls-remote --exit-code --tags origin "refs/tags/v$version" >/dev/null; then
            echo "skip=true" >> "$GITHUB_OUTPUT"
          fi
      - if: steps.meta.outputs.skip != 'true'
        run: |
          npm ci
          npm run check
          npm run package          # 同时生成 Chrome 与 Safari 两个 ZIP
      - if: steps.meta.outputs.skip != 'true'
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          node scripts/release-notes.mjs "${{ steps.meta.outputs.version }}" > notes.md
          gh release create "v${{ steps.meta.outputs.version }}" \
            artifacts/not-brother-*.zip \
            --title "v${{ steps.meta.outputs.version }}" --notes-file notes.md

  safari-app:
    needs: build
    if: needs.build.outputs.skip != 'true' && vars.SAFARI_SIGNING == 'true'
    runs-on: macos-latest
    steps:
      # 下载 Release 中的 Safari ZIP → 打包成 Xcode 工程 → Developer ID 签名
      # → 公证 → 装订 → 上传到同一个 Release（命令见 3.3）
```

要点：

- 第一个 job 跑在 Linux 上，和本地 `npm run release` 用同一套命令，保证 Release 里的 Chrome ZIP 与商店版字节一致，也可以作为存档。
- `scripts/release-notes.mjs` 是新增的小脚本：从 `docs/store-listing.md` 中提取 `### Version <version> release notes` 段落。`release.mjs` 已经要求这段存在。
- 第二个 job 由仓库变量 `SAFARI_SIGNING` 控制开关。没配证书之前它不会运行，Release 里仍有方式 B 的文件夹 ZIP，不会报红。
- macOS runner 对公开仓库免费；私有仓库按 10 倍系数消耗 Actions 分钟数，每次发版大约几分钟。

### 3.3 macOS job 的核心命令

```bash
unzip -q "not-brother-safari-$VERSION.zip" -d ext
```

```bash
xcrun safari-web-extension-packager ext \
  --app-name "Not Brother" \
  --bundle-identifier io.github.interjc.notbrother \
  --macos-only --swift --copy-resources \
  --project-location build --no-open --no-prompt --force
```

```bash
xcodebuild -project "build/Not Brother/Not Brother.xcodeproj" \
  -scheme "Not Brother" -configuration Release \
  -archivePath build/NotBrother.xcarchive archive \
  MARKETING_VERSION="$VERSION" CURRENT_PROJECT_VERSION="$GITHUB_RUN_NUMBER" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" ENABLE_HARDENED_RUNTIME=YES \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID"
```

```bash
xcodebuild -exportArchive -archivePath build/NotBrother.xcarchive \
  -exportOptionsPlist scripts/safari/ExportOptions.plist -exportPath build/export
```

```bash
ditto -c -k --keepParent "build/export/Not Brother.app" notarize.zip
```

```bash
xcrun notarytool submit notarize.zip --wait \
  --key "$ASC_KEY_PATH" --key-id "$ASC_KEY_ID" --issuer "$ASC_ISSUER_ID"
```

```bash
xcrun stapler staple "build/export/Not Brother.app"
```

```bash
ditto -c -k --keepParent "build/export/Not Brother.app" "Not-Brother-Safari-$VERSION.zip"
```

```bash
gh release upload "v$VERSION" "Not-Brother-Safari-$VERSION.zip"
```

说明：

- Xcode 工程**每次在 CI 里重新生成，不提交进仓库**，所以不存在“第二份代码”。仓库里只多一个 `scripts/safari/ExportOptions.plist`（`method` 为 `developer-id`，`signingStyle` 为 `automatic`，加上 `teamID`）。
- 签名前要把 Developer ID 证书导入一个临时 keychain（`security create-keychain` / `security import` / `security set-key-partition-list`），job 结束时删除。
- 工程路径和 scheme 名以打包器实际生成的为准，首次运行时用 `xcodebuild -list` 确认后写死。
- 第一次跑通时可能需要调整签名参数，例如 App 扩展的 entitlements 或 provisioning；跑通之后基本不用再改。

### 3.4 一次性准备（只有方式 A 需要）

1. 在 [Apple Developer](https://developer.apple.com/account/resources/certificates) 用 Account Holder 身份创建 **Developer ID Application** 证书，导出为 `.p12`。
2. 在 App Store Connect → Users and Access → Integrations 创建 **Team API Key**（Developer 角色即可），下载 `.p8`。签名时自动管理 provisioning 和公证都用它。
3. 在 Developer 账号里注册 Bundle ID `io.github.interjc.notbrother` 和扩展的 Bundle ID（打包器默认是 `<app>.Extension`）。也可以由 `-allowProvisioningUpdates` 自动创建。
4. 在 GitHub 仓库的 Settings → Secrets and variables → Actions 中添加：

| 名称 | 类型 | 内容 |
| --- | --- | --- |
| `MACOS_CERT_P12_BASE64` | Secret | `.p12` 的 base64 |
| `MACOS_CERT_PASSWORD` | Secret | `.p12` 密码 |
| `APPLE_TEAM_ID` | Secret | 10 位 Team ID |
| `ASC_KEY_ID` / `ASC_ISSUER_ID` | Secret | API Key 的 ID 与 Issuer ID |
| `ASC_KEY_P8_BASE64` | Secret | `.p8` 的 base64 |
| `SAFARI_SIGNING` | Variable | `true` 时启用 macOS job |

证书有效期 5 年。到期前换一次 Secrets，其余不用管。

## 4. 代码改动（最小集）

既然只是锦上添花，代码只改**不改就跑不起来**的部分。

### 4.1 必须改

| 文件 | 改动 | 原因 |
| --- | --- | --- |
| `src/platform/capabilities.ts`（新） | `hasSidePanel()`、`setBadgeTextColor()` 等能力检测包装 | 集中处理平台差异，业务代码里不写 `isSafari` |
| `src/background/service-worker.ts:60` | `setPanelBehavior` 只在 `hasSidePanel()` 时调用 | **阻断项**：Safari 没有 `chrome.sidePanel`，模块顶层直接抛 `TypeError`，整个 service worker 起不来 |
| `src/background/service-worker.ts:70` | 没有侧边栏时直接 `openConsentSurface(null)` | 同意前的右键披露入口改为打开 dashboard |
| `service-worker.ts` 中的 `sidepanel:open` 消息处理 | 没有侧边栏时立即回复 `{ ok: false }` | 否则监听函数同步抛错，`sendResponse` 永远不会被调用 |
| `service-worker.ts:365` | 改用 `setBadgeTextColor()` 包装 | Safari 不支持 `setBadgeTextColor` |
| `src/background/side-panel-visibility.ts` | `chrome.sidePanel.onOpened` 等改为 `chrome.sidePanel?.` 访问 | 同上 |
| `scripts/safari-manifest.mjs`（新，配单测） | Chrome manifest → Safari manifest | 见 4.2 |
| `scripts/package.mjs` | 额外写出 `artifacts/not-brother-safari-<version>.zip` | 文件名仍匹配 `not-brother-*.zip`，现有的旧包清理逻辑自动覆盖 |
| `scripts/validate-dist.mjs` | 校验 Safari manifest：版本号一致、无 `side_panel`、有 `default_popup` | 防止 CI 产出坏包 |
| `scripts/build.mjs` | esbuild `target` 改为 `["chrome114", "safari18"]` | 避免产物里出现 Safari 不支持的语法 |

### 4.2 Safari manifest 改写

- 删除 `side_panel` 和 `minimum_chrome_version`，从 `permissions` 中删除 `sidePanel`；
- 新增 `action.default_popup: "sidepanel.html"`：Safari 用户点工具栏图标时，同一个页面以弹窗打开；
- 新增 `browser_specific_settings.safari.strict_min_version: "18.4"`；
- 其他字段原样保留。

Chrome 版 manifest **不能**加 `default_popup`，否则点图标时会打开弹窗，不再打开侧边栏。

顺带的好处：悬浮面板打开侧边栏失败时，现有提示是“请点工具栏图标”。在 Safari 上点图标正好打开弹窗，这条路径不用改。规则编辑入口已经会回退到 `dashboard.html#filter-rules`。

### 4.3 可以不做（等有用户反馈再说）

- 弹窗专用 CSS：先给 `sidepanel` 根元素加一个固定宽度保证能用，细调以后再说。
- 应用内提示“请允许访问 x.com”和对应的三语文案：先在 README 的安装步骤里说明。
- iOS / iPadOS：不支持 `contextMenus`，x.com 移动版 DOM 不同，不做。
- Mac App Store：将来想上架时，同一个 Safari ZIP 可以直接用 App Store Connect 的网页版 Safari Web Extension Packager 上传，不影响本方案。

## 5. Safari 兼容性对照（本项目用到的部分）

| 能力 | Safari（macOS） | 处理 |
| --- | --- | --- |
| `sidePanel` / `side_panel` | **不支持** | 用 `default_popup` 弹窗和 dashboard 代替 |
| `content_scripts[].world: "MAIN"` | 18 起支持 | `page-bridge.js` 不用改 |
| `background.service_worker` + `type: "module"` | 15.4 / 16.4 起支持 | 不用改 |
| `action.setBadgeText` / `setTitle` | 15.4 起支持 | 不用改 |
| `action.setBadgeBackgroundColor` | API 存在但**无效果** | 不改 |
| `action.setBadgeTextColor` | **不支持** | 能力检测 |
| `runtime.getContexts` | 不支持 | 已有存在性判断 |
| `contextMenus`（`action` 上下文） | 15.4 起支持 | 不用改 |
| `options_ui.open_in_tab: false` | 总在新标签页打开 | `options.tsx` 已能切换为独立选项页 |
| `storage.sync` | 能读写，但**不跨设备同步** | 不改，文档注明 |
| `storage.local` 配额 | 默认 5 MB（Chrome 为 10 MB） | 多账号规则较大时留意 |
| `optional_host_permissions` + `permissions.request` | 15.5 起支持，只对具体 origin 弹授权 | 现有实现已按具体源申请 |
| 内容脚本注入 | 用户授权 x.com 后才注入 | 安装说明里写清楚 |
| IndexedDB（Dexie） | 支持 | 验证重启 Safari、覆盖安装后数据仍在 |

## 6. 测试与维护约定

- **CI 自动**：`npm run check` 里加单测，模拟 `chrome.sidePanel === undefined`，断言 service worker 能正常加载、所有入口都能回退；manifest 改写函数单独测试。这些在 Linux 上就能跑。
- **人工**：只在大版本或用户报告问题时，用方式 A 的 App 在 Safari 里冒烟测试一次：授权 x.com、同意流程、徽标、弹窗、dashboard、时间线隐藏。日常开发仍只测 Chrome。
- **约定**（落地后写进 `AGENTS.md`）：新代码用到 Safari 不支持的 API 时，必须经 `src/platform/` 做能力检测并提供兜底；禁止在业务代码里按 User-Agent 分支；产品边界与 Chrome 版完全一致。
- Release 页面和 README 注明：Safari 版是社区渠道，不经 App Store 审核，不会自动更新，以 Chrome 版为准。

## 来源

- Apple：[Distributing your Safari web extension](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension)（Developer ID 签名与公证的商店外分发）
- Apple Developer Forums：[thread 782005](https://developer.apple.com/forums/thread/782005)（Developer ID 签名扩展从 Safari 18.4 起受支持）
- Apple：[WWDC26 Session 216](https://developer.apple.com/videos/play/wwdc2026/216/)，以及 [Stefan vd：在 Safari 26 中不用 Xcode 加载扩展](https://www.stefanvd.net/blog/?p=2105)（Add Temporary Extension）
- Apple：[Packaging a web extension for Safari](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari)（`safari-web-extension-packager` 参数）
- Apple：[Assessing your Safari web extension’s browser compatibility](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility)
- Apple：[Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
- MDN：[`@mdn/browser-compat-data`](https://github.com/mdn/browser-compat-data)（8.1.7，`webextensions` 部分）
