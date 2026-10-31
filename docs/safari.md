# Safari 支持方案：一套代码，双商店发布

本文研究如何用**最小维护成本**让 Not Brother 同时发布到 Chrome Web Store 和 Mac App Store（Safari）。这是**方案文档**，截至本文写作时仓库里还没有任何 Safari 专用代码；落地后要同步更新 [发布指南](release.md)、[测试指南](testing.md)、[技术架构](architecture.md)、`AGENTS.md` 和项目 skill 的 references。

兼容性结论来自 Apple 官方文档与 MDN `@mdn/browser-compat-data` 8.1.7（见文末来源），最后核验于 2026-10-31。Safari 和 App Store Connect 变化较快，开工前请重新核对。

## 1. 结论

**不分叉代码，也不维护第二个仓库或第二个 `src/`。** 只做三件事：

1. **同一份构建产物**：`npm run build` 只产出一个 `dist/`。打包时从这一份 `dist/` 生成两个 ZIP，唯一区别是 Safari 版的 `manifest.json` 由脚本改写。
2. **按能力检测，而不是按浏览器分支**：凡是 Safari 缺失的 API（主要是 `chrome.sidePanel`），调用前先判断 API 是否存在，缺失时走已有的兜底路径（弹窗或 dashboard 标签页）。代码里不出现 `isSafari`、User-Agent 判断。
3. **Safari 原生壳交给 Apple 工具生成**：用 App Store Connect 网页版的 Safari Web Extension Packager 上传 ZIP，Apple 在云端生成 macOS App 并签名。仓库里**不提交 Xcode 工程、不写 Swift**。

预计长期要维护的 Safari 相关差异只有：一个约几十行的平台能力模块、一个 manifest 改写函数（含单测）、几条 i18n 文案、一段发布步骤。日常功能开发照旧只在 Chrome 里开发调试，发版时多上传一个 ZIP。

## 2. 为什么改动量小

本项目已有的设计让 Safari 适配的成本很低：

- 只用 MV3 标准能力：`storage`、`contextMenus`、内容脚本、service worker、`_locales`，全部可在 Safari 中使用。
- 不依赖 `webRequest`、`tabs` 权限、`identity`、远程代码，这些正是 Safari 差异最大的区域。
- 运行时代码全部本地打包（esbuild），没有构建链兼容性问题。
- 已有兜底：侧边栏打不开时回退到 `dashboard.html`（同意披露、规则编辑入口都已如此），`runtime.getContexts` 已做存在性判断。
- Safari 同时支持 `chrome.*` 命名空间和 Promise 风格，不必改成 `browser.*` 或引入 polyfill。
- Safari 会**忽略**不认识的 manifest 键（例如 `side_panel`、`sidePanel` 权限、`minimum_chrome_version`），不会因此拒绝加载。

## 3. Safari 兼容性对照（只列本项目用到的）

| 能力 | 本项目用法 | Safari（macOS） | 处理 |
| --- | --- | --- | --- |
| `sidePanel` API 与 `side_panel` 键 | 状态 / 规则 / 选项主界面 | **不支持** | 改用工具栏弹窗 `action.default_popup` 加载 `sidepanel.html`，大页面仍用 dashboard |
| `content_scripts[].world: "MAIN"` | `page-bridge.js` 读页面已加载的关系数据 | 18 起支持 | 最低版本定为 Safari 18，不需要改注入方式 |
| `background.service_worker` + `type: "module"` | service worker | 15.4 / 16.4 起支持 | 无需改动 |
| `action.setBadgeText` / `setTitle` | 工具栏状态 | 15.4 起支持 | 无需改动 |
| `action.setBadgeBackgroundColor` | 徽标底色 | API 存在但**无效果** | 不改，只在文档里注明 |
| `action.setBadgeTextColor` | 徽标文字色 | **不支持** | 先判断存在再调用 |
| `runtime.getContexts` | 追踪侧边栏是否已打开 | 不支持 | 已做存在性判断 |
| `contextMenus`（`action` 上下文） | 同意前的披露入口 | macOS 15.4 起支持；iOS 不支持 | macOS 无需改动 |
| `options_ui.open_in_tab: false` | 内置选项入口 | 选项页**总在新标签页打开** | `options.tsx` 在侧边栏打不开时已经会切换为独立选项页；只需检查宽屏下的版式 |
| `storage.sync` | 同步设置 | 能读写，但**不跨设备同步**，行为等同 `local` | 无需改动，文档注明 |
| `storage.local` 配额 | 规则文档（单份上限 1 MB，按账号分开） | 默认 **5 MB**（Chrome 为 10 MB） | 多账号时留意；确实不够再评估 `unlimitedStorage` |
| `optional_host_permissions` + `permissions.request` | 远程导入规则 | 15.5 起支持；只对具体 origin 弹授权 | 现在已经按解析出的具体 HTTPS 源申请，符合 Safari 模型 |
| 内容脚本生效时机 | x.com 页面 | **用户在工具栏授权 x.com 后才注入** | 首次引导里加“允许在 x.com 上运行”的提示 |
| IndexedDB（Dexie） | 观察档案库 | 支持 | 实测 service worker 被回收、重启 Safari 后数据仍在 |

结论：真正的阻断只有 **`chrome.sidePanel` 不存在**。现在 `src/background/service-worker.ts:60` 在模块顶层调用 `chrome.sidePanel.setPanelBehavior(...)`，在 Safari 中会抛 `TypeError`，导致整个 service worker 无法启动。其余差异都是降级处理或文档注明。

## 4. 代码怎么改（一次性工作）

### 4.1 平台能力层 `src/platform/`

新增一个小模块，集中处理平台差异 API，业务代码不再直接调用 `chrome.sidePanel`：

```ts
// src/platform/capabilities.ts（示意）
export function hasSidePanel(): boolean {
  return typeof chrome.sidePanel?.open === "function";
}

export async function setBadgeTextColor(color: string): Promise<void> {
  if (typeof chrome.action.setBadgeTextColor === "function") {
    await chrome.action.setBadgeTextColor({ color });
  }
}
```

需要接入的调用点：

| 文件 | 改动 |
| --- | --- |
| `src/background/service-worker.ts:60` | `setPanelBehavior` 只在 `hasSidePanel()` 时调用（**阻断项**） |
| `src/background/service-worker.ts:70` | 右键菜单的披露入口：没有侧边栏时直接走 `openConsentSurface(null)`，打开 dashboard |
| `src/background/service-worker.ts` 中的 `sidepanel:open` 消息处理（约 `:258`–`:290`） | 没有侧边栏时立即回复 `{ ok: false }`。现在会在监听函数里同步抛错，`sendResponse` 永远不会被调用 |
| `src/content/index.ts` 中的 `handleSidePanelOpenFailure` | 现在只有同意前才回退到 dashboard，同意后只显示“请点工具栏图标”的提示。改为：平台没有侧边栏时也打开 dashboard（`openFilterRules` 已经会回退到 `#filter-rules`，不用改） |
| `src/background/service-worker.ts:365` | 改为调用 `setBadgeTextColor` 包装函数 |
| `src/background/side-panel-visibility.ts` | `chrome.sidePanel.onOpened` 等改为 `chrome.sidePanel?.` 访问 |
| `src/ui/open-options-tab.ts` | 已有 try/catch 会返回 `false`，可以不改；改用 `hasSidePanel()` 判断可读性更好 |

原则：**只做能力检测，不做浏览器检测**。以后 Safari 如果补上某个 API，这些分支会自动走 Chrome 那条路径。

### 4.2 弹窗代替侧边栏

Safari 版 manifest 加上 `"action": { "default_popup": "sidepanel.html" }`，同一个页面以弹窗形式打开：

- `sidepanel.html` 原本按侧边栏宽度设计。弹窗按内容决定尺寸，需要在 CSS 里给根元素加固定宽度（例如 `min-width: 380px`）和最大高度，超出部分滚动。用 CSS 处理，不用 JS 判断。
- 不能在 Chrome 版 manifest 里也加 `default_popup`，否则会抢走点击图标打开侧边栏的行为。所以这个键只在 Safari 的 manifest 改写里加入（见 4.3）。
- 页内“打开侧边栏规则页”的入口在 Safari 上会回退到 `dashboard.html#filter-rules`，这条回退路径已经存在。

### 4.3 manifest 改写与打包

新增一个纯函数 `scripts/safari-manifest.mjs`（配 Vitest 单测），输入 Chrome manifest，输出 Safari manifest：

- 删除 `side_panel`、`minimum_chrome_version`，并从 `permissions` 中删除 `sidePanel`（Safari 会忽略它们，但删掉可以减少打包器警告和审核疑问）；
- 新增 `action.default_popup: "sidepanel.html"`；
- 新增 `browser_specific_settings.safari.strict_min_version: "18.0"`；
- 其余字段（版本号、`_locales`、内容脚本、图标）**原样保留**。

`scripts/package.mjs` 在生成 `artifacts/not-brother-<version>.zip` 后，再用同一份 `dist/` 加上改写后的 manifest 生成 `artifacts/not-brother-safari-<version>.zip`。文件名仍匹配 `not-brother-*.zip`，现有的“打包前删除旧 ZIP”规则自动覆盖它，不必另写清理逻辑。

`scripts/validate-dist.mjs` 增加对 Safari manifest 的校验：版本号与 `package.json` 一致、不含 `side_panel`、含 `default_popup`、`world: "MAIN"` 仍在。

`scripts/build.mjs` 的 esbuild `target` 从 `"chrome114"` 改为 `["chrome114", "safari18"]`，这样产物里不会出现 Safari 18 不支持的语法。两个 ZIP 仍共用这一份构建。

### 4.4 首次引导与文案

Safari 默认不给扩展任何站点权限。用户需要在 Safari 设置或工具栏中允许扩展在 x.com 上运行，内容脚本才会注入。

- 欢迎页和同意披露页用 `chrome.permissions.contains({ origins: ["https://x.com/*"] })` 检测；未授权时显示一条“请在 Safari 中允许 Not Brother 访问 x.com”的提示。这同样是能力检测，在 Chrome 上永远返回已授权，提示不会出现。
- 新增文案走 `src/i18n/`，中、英、日三份词库同时补全。

### 4.5 不建议现在就做的

- **iOS / iPadOS**：iOS 版 Safari 不支持 `contextMenus`，x.com 移动版 DOM 不同（`x-adapter.ts` 要重新适配），触屏也没有悬停卡片。创建 App 记录时只勾选 macOS。
- **提交 Xcode 工程或写原生代码**：除非网页版打包器长期不可用，否则不引入（见 5.3）。
- **`browser.*` polyfill**：Safari 原生支持 `chrome.*`，没必要加。

## 5. 发布流程

### 5.1 一次性准备（只做一次）

1. 在 [App Store Connect](https://appstoreconnect.apple.com/) 新建 App：平台只选 **macOS**，Bundle ID 用反向域名（例如 `io.github.interjc.notbrother`，一经确定不要再改），填写 SKU。
2. 填写 App 元数据：名称、副标题、描述可从 [Chrome Web Store 三语文案](store-listing.md) 改写。隐私政策 URL 复用 GitHub Pages 上的 `privacy.html`，支持 URL 用 GitHub Issues。
3. App 隐私问卷：本扩展不收集、不上传数据，按“Data Not Collected”申报，但要与 [隐私政策](../terms/privacy.md) 逐项核对后再勾选。
4. 截图：Mac App Store 接受 1280×800。`assets/store/` 下现有的 1280×800 截图可以直接复用，只需补拍 Safari 版弹窗界面替换侧边栏那张。
5. 类别选 Productivity，与 Chrome Web Store 保持一致。

### 5.2 每次发版（推荐：网页版打包，无需 Mac）

```bash
npm run release          # 同时生成两个 ZIP
```

1. Chrome：照旧把 `artifacts/not-brother-<version>.zip` 上传到 Chrome Web Store。
2. Safari：在 App Store Connect 依次进入 **Users and Access → Xcode Cloud → Safari Web Extension Packager → Upload**，上传 `artifacts/not-brother-safari-<version>.zip`。
3. 打包完成后，先在 TestFlight 里安装验证（按 [测试指南](testing.md) 的 Safari 清单），再把这个构建加到新版本里提交审核。
4. 更新说明复用 `docs/store-listing.md` 中同版本号的条目。

注意：

- 打包占用 Apple Developer Program 每月附带的 25 小时 Xcode Cloud 额度，本项目一次打包远用不完。
- Apple 要求每次上传的版本号或构建号递增。本项目每次发版都会升 `manifest.version`，可以满足；第一次更新时要确认打包器如何从 manifest 推导版本号和构建号，并把结论补进本节。
- 开发者论坛有人报告网页版打包器入口不显示、上传报网络错误、更新版本时出现 “Invalid Pre-Release Train”。遇到这些情况改用 5.3 的命令行方式。

### 5.3 备用：在 Mac 上用命令行打包

```bash
unzip -o artifacts/not-brother-safari-<version>.zip -d /tmp/not-brother-safari
```

```bash
xcrun safari-web-extension-packager /tmp/not-brother-safari \
  --app-name "Not Brother" \
  --bundle-identifier io.github.interjc.notbrother \
  --macos-only --swift --copy-resources \
  --project-location ../not-brother-safari-xcode \
  --no-open --no-prompt --force
```

（`safari-web-extension-packager` 以前叫 `safari-web-extension-converter`。）

然后在 Xcode 里 Archive，再上传到 App Store Connect。生成的 Xcode 工程放在**仓库之外**，每次发版用 `--force` 重新生成即可，不纳入版本管理；版本号和构建号在 Xcode 中设置为与 manifest 一致。

### 5.4 以后再考虑：CI 自动化

等发版节奏稳定后，可以在 GitHub Actions 的 macOS runner 上执行 5.3 的流程，用 App Store Connect API Key（存为仓库 Secrets）上传。社区已有现成的 Action 可参考，但它是第三方代码，接入前要审阅它的源码和所需权限。没有稳定节奏前不建议引入。

## 6. 测试

- **单测**：在 Vitest 中模拟 `chrome.sidePanel === undefined` 和 `chrome.action.setBadgeTextColor === undefined`，断言 service worker 模块能正常加载，且所有入口都回退到 dashboard 或弹窗；manifest 改写函数单独测试。这些测试在 Linux CI 上就能跑，不需要 Mac。
- **手工验收**（每个大版本至少做一次，使用 TestFlight 构建）：授权 x.com、同意披露流程、徽标显示、弹窗三个标签页、dashboard 导入导出、规则快捷添加、时间线隐藏、退出 Safari 再打开后数据仍在、浅色 / 深色主题。
- 日常开发和回归仍以 Chrome 为主。Safari 只在发版前做冒烟测试。

## 7. 维护约定（落地后写进 AGENTS.md）

- 新功能先查 Safari 是否支持所用的 API；不支持的 API 必须经过 `src/platform/` 做能力检测，并且有可用的兜底。
- 禁止在业务代码中按 User-Agent 或 `isSafari` 分支。
- 两个商店使用同一个版本号、同一份更新说明，同一天提交。
- 产品边界不变：Safari 版同样不能自动滚动、不能调用私有接口、不能点击 X 的账号操作控件。

## 8. 工作量估计

| 项 | 规模 | 需要 Mac |
| --- | --- | --- |
| 平台能力层与调用点改造（含单测） | 小 | 否 |
| manifest 改写、打包、校验脚本（含单测） | 小 | 否 |
| 弹窗版式 CSS | 小 | 调试时最好有 |
| Safari 授权提示与三语文案 | 小 | 否 |
| App Store Connect 建档、元数据、隐私问卷、截图 | 一次性 | 否 |
| TestFlight 实机验收 | 每次发版 | 需要一台装有 Safari 18+ 的 Mac |

## 来源

- Apple：[Packaging and distributing Safari Web Extensions with App Store Connect](https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect)
- Apple：[Packaging a web extension for Safari](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari)
- Apple：[Assessing your Safari web extension’s browser compatibility](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility)
- Apple：[Safari extensions 提交说明](https://developer.apple.com/safari/extensions/submission)
- MDN：[`@mdn/browser-compat-data`](https://github.com/mdn/browser-compat-data)（8.1.7，`webextensions` 部分）
- Apple Developer Forums：网页版打包器的已知问题，例如 [thread 845245](https://developer.apple.com/forums/thread/845245)、[thread 843612](https://developer.apple.com/forums/thread/843612)、[thread 844441](https://developer.apple.com/forums/thread/844441)
