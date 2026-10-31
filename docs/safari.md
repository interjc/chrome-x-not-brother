# Safari 支持：GitHub Release 自动构建，手动安装

Chrome Web Store 仍是唯一的正式发布渠道。Safari 只是锦上添花：**不上 Mac App Store，也不增加人工发布步骤**。`main` 上每出现一个新版本号，GitHub Actions 就自动构建 Safari 安装包并挂到 GitHub Release，Safari 用户自己下载安装。安装步骤写在 [README](../README.md#safari) / [README.en](../README.en.md#safari)。

兼容性结论来自 Apple 官方文档、WWDC26 与 MDN `@mdn/browser-compat-data` 8.1.7（见文末来源），最后核验于 2026-10-31。

## 1. 结构

| 层 | 做法 | 文件 |
| --- | --- | --- |
| 代码 | 同一个 `src/`，同一次 `npm run build`。Safari 缺失的 API 先做能力检测再调用，不做浏览器检测 | `src/platform/capabilities.ts` |
| 打包 | `npm run package` 从同一份 `dist/` 写出两个 ZIP，Safari 版只换了 manifest | `scripts/safari-manifest.mjs`、`scripts/package.mjs` |
| 发布 | `main` 上 `package.json` 变化且该版本还没有 Release 时，自动打 tag、建 Release、上传安装包 | `.github/workflows/release.yml`、`scripts/release-notes.mjs` |
| 签名 | 可选：macOS runner 用 Developer ID 签名并公证 Safari App | 同上；密钥配置见 [Apple 签名与公证密钥配置](apple-signing.md) |

本地发版流程不变：`npm run release:patch` → 上传 Chrome 商店 → 推到 `main`。

## 2. 用户的两种安装方式

### A. 签名并公证的 App（推荐）

Release 附件 `Not-Brother-Safari-<version>.zip`：一个用 Developer ID 签名并经 Apple 公证的 macOS App，扩展就在这个 App 里。

- 要求 **Safari 18.4 及以上**：Apple 从这个版本起允许在 App Store 之外分发 Developer ID 签名、公证过的 Safari 扩展。
- 已经公证，Gatekeeper 不会拦，也不需要开发者模式；装好后长期有效。
- 不会自动更新：用户下载新版本覆盖旧 App。扩展数据保存在扩展自己的存储里，Bundle ID 不变时覆盖安装会保留数据。

### B. 临时扩展（零签名后备）

Release 附件 `not-brother-safari-<version>.zip`：扩展文件夹本身。Safari 26 起可以在「设置 → 开发者」里用 **Add Temporary Extension…** 直接加载，需要先打开「允许未签名的扩展」。**退出 Safari 后扩展会被卸载**，适合尝鲜，或者在签名还没配置好时先提供一个渠道。

不提供未签名的 `.app`：用户既要绕过 Gatekeeper，又要在每次启动 Safari 时打开「允许未签名的扩展」，比 B 还麻烦。

## 3. 自动构建

### 3.1 触发

- `push` 到 `main` 且改动了 `package.json`：读取版本号，`v<version>` 已有 Release 就跳过，所以普通依赖升级不会重复发版；
- `workflow_dispatch`：手动补发还没有 Release 的版本；勾选 `safari_only` 时只为当前版本的现有 Release 重做签名 App（排查签名问题时使用）。

### 3.2 `release` job（Ubuntu）

`npm ci` → `npm run check` → `npm run package` → `gh release create v<version>`，附上 Chrome ZIP 和 Safari 文件夹 ZIP。正文由 `scripts/release-notes.mjs` 从 [store-listing.md](store-listing.md) 中提取 `### Version <version> release notes`，并追加下载说明。

### 3.3 `safari-app` job（macOS，可选）

只有仓库变量 `SAFARI_SIGNING` 为 `true` 时才运行；没配置时 Release 里仍有方式 B 的包，workflow 不会报红。步骤：

1. 从 Release 下载 Safari 文件夹 ZIP 并解压；
2. 记录 Secret 中 `.p12` 的 sha256 和结构（不含密钥内容），用 OpenSSL 检查其中同时有私钥和证书，再重新打包成 macOS `security import` 一定能读的 3DES/SHA1 格式（Keychain、Xcode、OpenSSL 各版本导出的加密方式不同，`security` 读不了的私钥会被悄悄跳过）；然后导入一个临时 keychain，同时导入 Apple 的 Developer ID G2 中间证书；
3. `xcrun safari-web-extension-packager` 生成只含 macOS 的 Xcode 工程（`--copy-resources --no-open --no-prompt --force`）。工程**只在 CI 里临时生成，不提交进仓库**；scheme 用 `xcodebuild -list -json` 自动选取；
4. `xcodebuild archive`：手动指定 `Developer ID Application` 身份，开启 hardened runtime 和 `--timestamp`。`MARKETING_VERSION` 取 manifest 版本，`CURRENT_PROJECT_VERSION` 取 `GITHUB_RUN_NUMBER`。打包器模板只用到不受限的 entitlements，所以不需要注册 App ID，也不需要描述文件；
5. `notarytool submit --wait`：状态不是 `Accepted` 时打印公证日志并失败；随后执行 `stapler staple` 和 `spctl --assess`；
6. `gh release upload --clobber`，然后删除临时 keychain 和 API Key 文件。

Bundle ID 默认是 `io.github.interjc.notbrother`，可以用仓库变量 `SAFARI_BUNDLE_ID` 覆盖。**首次发布后不要再改**，否则用户会看到两个不同的 App，数据也不会跟着迁移。

macOS runner 对公开仓库免费；私有仓库按 10 倍系数消耗 Actions 分钟数。

## 4. 代码差异

### 4.1 能力检测

`src/platform/capabilities.ts` 提供 `hasSidePanel()` 和 `setBadgeTextColor()`。业务代码不写 `isSafari`，也不判断 User-Agent。

| 位置 | 没有侧边栏时的行为 |
| --- | --- |
| `service-worker.ts` 顶层 | 跳过 `setPanelBehavior`。这里原本会在 Safari 中抛 `TypeError`，导致整个 service worker 起不来 |
| 同意前的工具栏右键入口 | 直接打开 `dashboard.html` 中的完整披露页 |
| `sidepanel:open` 消息 | 立即回复 `{ ok: false }`。悬浮面板显示现有的“点工具栏图标”提示，Safari 上点图标正好打开弹窗；规则编辑入口回退到 `dashboard.html#filter-rules` |
| `side-panel-visibility.ts` | 不注册侧边栏开关监听 |
| `open-options-tab.ts` | 返回 `false`，`options.html` 显示独立选项页 |
| 工具栏徽标 | 不支持 `setBadgeTextColor` 时跳过，徽标文字照常显示 |

`src/background/service-worker.test.ts` 用一个没有 `sidePanel`、`setBadgeTextColor`、`getContexts` 的 Safari 形态 `chrome` 加载 service worker，并断言上述回退路径都可用。

### 4.2 Safari manifest

`scripts/safari-manifest.mjs` 的 `toSafariManifest()`：

- 删除 `side_panel` 和 `minimum_chrome_version`，从 `permissions` 中删除 `sidePanel`；
- 新增 `action.default_popup: "popup.html"`；
- 新增 `browser_specific_settings.safari.strict_min_version: "18.4"`；
- 其他字段原样保留。`npm run validate:dist` 会检查这一点，同时检查 Chrome manifest 中**没有** `default_popup`（否则点击图标时会打开弹窗，不再打开侧边栏）。

`public/popup.html` 与 `sidepanel.html` 加载同一个 `sidepanel.js`，只是在 `<html>` 上多了 `surface-popup` class。弹窗的尺寸由内容决定，所以 `styles.css` 在这个 class 下把面板固定为 400×580，由内部滚动。Chrome 包里也带着这个文件，但 Chrome manifest 不会引用它。

### 4.3 刻意不做（等有用户反馈再说）

- 应用内的“请允许访问 x.com”提示和对应的三语文案：先在 README 安装步骤里说明。
- iOS / iPadOS：不支持 `contextMenus`，x.com 移动版 DOM 不同。
- Mac App Store：将来如果要上架，同一个 Safari ZIP 可以用 App Store Connect 的网页版 Safari Web Extension Packager 上传，不影响本方案。

## 5. Safari 兼容性对照（本项目用到的部分）

| 能力 | Safari（macOS） | 处理 |
| --- | --- | --- |
| `sidePanel` / `side_panel` | **不支持** | `popup.html` 弹窗 + dashboard |
| `content_scripts[].world: "MAIN"` | 18 起支持 | `page-bridge.js` 不用改 |
| `background.service_worker` + `type: "module"` | 15.4 / 16.4 起支持 | 不用改 |
| `action.setBadgeText` / `setTitle` | 15.4 起支持 | 不用改 |
| `action.setBadgeBackgroundColor` | API 存在但**无效果** | 不改 |
| `action.setBadgeTextColor` | **不支持** | 能力检测 |
| `runtime.getContexts` | 不支持 | 已有存在性判断 |
| `contextMenus`（`action` 上下文） | 15.4 起支持 | 不用改 |
| `options_ui.open_in_tab: false` | 总在新标签页打开 | 独立选项页 |
| `storage.sync` | 能读写，但**不跨设备同步** | README 注明 |
| `storage.local` 配额 | 默认 5 MB（Chrome 为 10 MB） | 多账号规则较大时留意 |
| `optional_host_permissions` + `permissions.request` | 15.5 起支持，只对具体 origin 弹授权 | 现有实现已按具体源申请 |
| 内容脚本注入 | 用户授权 x.com 后才注入 | README 安装步骤说明 |
| IndexedDB（Dexie） | 支持 | 冒烟测试时确认重启 Safari、覆盖安装后数据仍在 |

## 6. 测试与维护约定

- **自动**：`npm run check` 包含 Safari 形态的 service worker 测试、`toSafariManifest()` 和 `release-notes.mjs` 的单测；`npm run validate:dist` 校验两份 manifest。这些都在 Linux 上运行。
- **人工**：只在大版本或用户报告问题时，用方式 A 的 App 在 Safari 中冒烟测试一次：授权 x.com、同意流程、徽标、弹窗、dashboard、时间线隐藏、重启后数据仍在。日常开发只测 Chrome。
- **约定**：新代码用到 Safari 不支持的 API 时，必须经 `src/platform/` 做能力检测并提供兜底；产品边界与 Chrome 版完全一致。

## 来源

- Apple：[Distributing your Safari web extension](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension)（Developer ID 签名与公证的商店外分发）
- Apple Developer Forums：[thread 782005](https://developer.apple.com/forums/thread/782005)（Developer ID 签名扩展从 Safari 18.4 起受支持）
- Apple：[WWDC26 Session 216](https://developer.apple.com/videos/play/wwdc2026/216/)，以及 [Stefan vd：在 Safari 26 中不用 Xcode 加载扩展](https://www.stefanvd.net/blog/?p=2105)（Add Temporary Extension）
- Apple：[Packaging a web extension for Safari](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari)（`safari-web-extension-packager` 参数）
- Apple：[Assessing your Safari web extension’s browser compatibility](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility)
- Apple：[Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
- MDN：[`@mdn/browser-compat-data`](https://github.com/mdn/browser-compat-data)（8.1.7，`webextensions` 部分）
