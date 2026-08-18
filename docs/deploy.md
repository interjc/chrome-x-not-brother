# 首次上架准备

第一次把 Not Brother 放到 Chrome Web Store 时，用这份文档当操作手册。政策和后台会变；提交当天以 [Developer Dashboard](https://chrome.google.com/webstore/devconsole) 为准。

**2026-08-18 状态：** 开发者账号已按非交易者注册；GitHub Pages 已发布；首个条目已提交审核。审核通过后按第 11 节点 Publish。以后升版本走 [发布指南](release.md) 和 `npm run release`，不要再走完整首次注册。

第一次踩过的坑：

- 商店隐私政策不能填 `github.com/.../blob/...`，必须用 `https://interjc.github.io/chrome-x-not-brother/privacy.html`。
- 第一次跑 Pages workflow 前，要在仓库 Settings → Pages 把 Source 设成 **GitHub Actions**，否则会报 `Get Pages site failed`。
- 上传包用 `output/not-brother-<version>.zip`，不要手压 `dist/`。

| 文档 | 什么时候看 |
| --- | --- |
| 本文 | 第一次发布：哪些已经做好、哪些要你拍图、哪些要点击后台 |
| [发布指南](release.md) | 以后升版本、打包、回滚 |
| [商店上架说明](chrome-web-store.md) | 政策、隐私申报原则、审核问答 |
| [三语文案](store-listing.md) | 打开 Dashboard 后逐段粘贴 |
| [测试指南](testing.md) | 干净 Chrome 里的完整手工验收 |

## 1. 分工：仓库已完成 / 你要拍图 / 你要点击

### 仓库里已经做好、不用再写的

- 扩展包构建与校验：`npm run release` 或 `npm run package`，上传副本在 `output/not-brother-<version>.zip`
- 中英日商店名称、简介、详细说明、0.4.7 更新说明、权限理由、审核备注：[store-listing.md](store-listing.md)
- 公开隐私政策和使用条款：[terms/privacy.md](../terms/privacy.md)、[terms/terms.md](../terms/terms.md)
- 主页、反馈、隐私、条款的固定地址写在 `src/domain/project.ts` 和 [store-listing.md](store-listing.md) 的 Store listing URLs
- Side Panel 与档案库页脚的「发送反馈」打开 GitHub Issues
- 贡献说明：[docs/contributing.md](contributing.md)、根目录 `CONTRIBUTING.md`、`.github/ISSUE_TEMPLATE/`
- 商店图标源文件：`public/icons/icon-128.png`（深墨绿底、NB 变形）

把当前 `main` **推到 GitHub 之后**，下面这些链接才会在无痕窗口里打开。提交商店前先自己点一遍：

| Dashboard 字段 | 推送后使用的地址 |
| --- | --- |
| Homepage URL | https://github.com/interjc/chrome-x-not-brother |
| Support URL | https://github.com/interjc/chrome-x-not-brother/issues |
| Privacy policy URL | https://interjc.github.io/chrome-x-not-brother/privacy.html |
| 条款（无独立字段就写在隐私政策或详细说明里） | https://interjc.github.io/chrome-x-not-brother/terms.html |

### 需要截图或设计、放在 `assets/store/` 的

`assets/store/` 里已经有一套可上传的宣传图和 1280×800 截图（从验收画面裁切，使用虚构测试数据）。`output/playwright/` 原图不要直接上传。工具栏 `ON` 和真实 x.com 全页仍需按第 7 节补拍。

| 文件（建议文件名） | 规格 | 必须？ | 怎么做 |
| --- | --- | --- | --- |
| `assets/store/icon-128.png` | 128×128 PNG | 必须 | 可直接复制 `public/icons/icon-128.png`。若 Dashboard 提示图标太满，用预览把字形缩到约 96×96，四周留 16 px |
| `assets/store/screenshot-01-consent-en.png` 等 | **1280×800** PNG，最多 5 张 / 每种语言 | 至少 1 张，建议 5 张 | 见第 5 节 |
| `assets/store/small-promo-440x280.png` | **440×280** PNG | 必须 | 见第 6 节 |
| `assets/store/marquee-1400x560.png` | 1400×560 PNG | 可选 | 见第 6 节 |
| YouTube 演示 | 公开视频 | 通常可选 | 见第 6 节 |

### 必须你本人完成的手工步骤

1. 把含 `terms/` 的提交推到公开的 `main`。
2. 注册 Chrome Web Store 开发者账号并付一次性注册费。
3. 用干净 Chrome 配置做发布验收。
4. 按第 5、6 节准备图片。
5. 在 Dashboard 建条目、上传 ZIP、粘贴文案、提交审核。
6. 审核通过后（建议用延期发布）再人工点 Publish。

## 2. 先做三个决定

**发给谁**

- **Private**：只有你在账号里填写的 Google 邮箱能装。适合自己先过审。
- **Unlisted**：有链接就能装，商店搜不到，仍会完整审核。
- **Public**：可被搜索。

三种可见性的政策和审核标准一样。第一次建议 **Private 或 Unlisted**，确认安装和同意流程正常后再改 Public（改可见性通常还要再审一次）。

**审核通过后是否立刻上线**

提交时**取消** “Publish automatically after review”，改用延期发布（deferred publishing）。通过后你有 **30 天**点 Publish；过期会退回草稿。

**用哪个 Google 账号**

选一个你会长期看邮件的账号，打开两步验证。注册后**不能改绑定邮箱**。扩展会长期挂在这个账号下。

## 3. 推送到 GitHub

商店隐私政策链接指向 `main` 上的 `terms/privacy.md`。如果这些文件只在你电脑里，审核员打开会 404，容易被拒。

在仓库根目录：

```bash
git status
git add terms docs CONTRIBUTING.md .github src public package.json README.md skills
git commit -m "Prepare Chrome Web Store listing, legal pages, and feedback links"
git push origin main
```

推送后必须先打开仓库 **Settings → Pages**（workflow 自己打不开这个开关时会报 `Get Pages site failed`）：

1. 打开 https://github.com/interjc/chrome-x-not-brother/settings/pages
2. Build and deployment → Source 选 **GitHub Actions** 并保存；
3. 到 **Actions** 打开失败的 `Deploy GitHub Pages`，点 **Re-run all jobs**；
4. 等它变绿后，用无痕窗口打开第 1 节的隐私政策地址，必须看到完整 HTML，不能是 404。

Chrome Web Store 不接受 `github.com/.../blob/...` 这种仓库文件链接，必须用上面的 `interjc.github.io` 地址。

## 4. 注册开发者账号

1. 用选定的 Google 账号打开 [Developer Dashboard](https://chrome.google.com/webstore/devconsole)。
2. 第一次会看到注册页：勾选开发者协议和商店政策。
3. 付**一次性**注册费（金额以当天页面为准，不是按年、也不是按扩展收）。
4. 打开左侧 **Account**：
   - **Publisher name**：商店里 “Offered by” 会显示它，可用 `Justin Chen` 或你想对外的名字。
   - **Add email**，去收件箱点验证链接。
   - 打开 “item published / staged” 一类邮件通知。
   - 若第一次走 Private：在 Trusted testers 里填自己的 Gmail，多个地址用逗号分隔。
5. 按页面完成邮箱或身份验证。
6. 若出现 **Trader / Non-trader**（欧盟 DSA）：
   - 所有开发者都要声明。
   - 个人、免费、非商业分发时，多数情况选 **Non-trader**。这是法律自我评估，不要为了少填信息而填错。
   - 若选 Trader，姓名、地址、电话会**公开**出现在 listing 底部。

官方说明：[注册](https://developer.chrome.com/docs/webstore/register)、[完善账号](https://developer.chrome.com/docs/webstore/set-up-account)。

## 5. 打包

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm ci
npm run release
```

上传这个文件，不要手压 `dist/`：

`output/not-brother-0.4.7.zip`

自己再确认一次：

```bash
unzip -l output/not-brother-0.4.7.zip | head
```

列表里第一层就应有 `manifest.json`，不要出现 `dist/manifest.json`。

## 6. 干净 Chrome 里做发布验收

不要用日常浏览配置。

1. 打开 Chrome → 右上角头像 → **添加** → 新建一个只给上架用的配置。
2. 地址栏输入 `chrome://extensions`。
3. 打开右上角 **Developer mode**。
4. **Load unpacked**，选仓库里的 `dist/` 文件夹（不要选 ZIP，也不要选仓库根目录）。
5. 安装后应自动打开引导页。按 [测试指南](testing.md) 至少确认：
   - 没点同意前，X 上没有徽标，工具栏是琥珀色 `!`；
   - 点「同意并开始」后工具栏变 `ON`，刷新 X 才开始标注；
   - 证据不足不出现「未知」；
   - DevTools Network 没有你们的服务器、遥测、X API；
   - 扩展不会自动滚动，也不会点关注 / 取关 / 拉黑 / 静音；
   - Side Panel 和档案库页脚的「发送反馈」打开 Issues。
6. 分别把 Chrome 界面语言改成 English、日本語、简体中文，打开 Side Panel 和档案库看一眼。改 Chrome 语言：`chrome://settings/languages` → 把目标语言移到最前 → 重启 Chrome。

验收用虚构或已授权测试号。不要把真实关注关系写进商店截图。

## 7. 怎么拍 1280×800 商店截图

商店要的是**图片像素** 1280×800，直角、全幅、不要浏览器外框、不要圆角卡片装饰。最多 5 张。英语是默认 listing；日语和简体中文最好各拍一套。

`output/playwright/` 只能当构图参考，不要上传。

### 7.1 做出 1280×800 的画面

**方法 A（推荐，macOS）**

1. 用第 6 节那个干净配置打开目标页面。
2. 按 `Cmd + Shift + 5`，选「截取窗口」或「截取所选部分」。
3. 用预览打开截图：工具 → 调整大小。
4. 取消「缩放图像」里不需要的约束后，把画面裁成 **1280 × 800** 像素。宽度先拉到 1280，再居中裁掉多余高度；高度不够时，在画布上下补与页面相同的背景色，不要硬拉变形。

**方法 B（Chrome 截当前视口）**

1. 打开页面，按 `F12` 或 `Cmd + Option + I`。
2. `Cmd + Shift + P`，输入 `screenshot`。
3. 选 **Capture screenshot**（视口）或 **Capture full size screenshot**。
4. 仍须在预览里裁成 1280×800。扩展页往往比 800 高，裁中间信息区，不要裁掉标题和关键按钮。

**方法 C（先固定窗口再截）**

把 Chrome 窗口拉到接近 1280×800 再截，后期裁切更少。不要把书签栏、其他扩展图标拍进去。

### 7.2 建议拍哪 5 张

每种语言都按这个顺序，文件名改语言后缀（`en` / `ja` / `zh`）：

| 顺序 | 建议文件名 | 拍什么 | 怎么进入这个画面 |
| --- | --- | --- | --- |
| 1 | `screenshot-01-consent-en.png` | 首次同意 / 显著披露 | 新 Load unpacked 后的引导页，或未同意时的 Side Panel |
| 2 | `screenshot-02-x-dock-en.png` | X 页面：关系徽标 + 右下角 dock | 同意后打开 `https://x.com`，让测试号的互关/单向关注出现在可见卡片上 |
| 3 | `screenshot-03-toolbar-on-en.png` | 工具栏酸性黄 `ON` | 把 Not Brother 固定到工具栏后再截；尽量只留工具栏和一截 X，不要一排无关扩展 |
| 4 | `screenshot-04-sidepanel-en.png` | Side Panel 概览 | 点工具栏图标；侧栏窄，可把它放在窗口左侧，右侧留干净的 X，整张图仍裁成 1280×800 |
| 5 | `screenshot-05-fieldbook-dark-en.png` | 暗黑模式档案库 | 系统外观改成深色，打开档案库。地址类似 `chrome-extension://<扩展ID>/dashboard.html` |

扩展 ID 在 `chrome://extensions` 卡片上。暗黑模式：macOS 系统设置 → 外观 → 深色，然后刷新扩展页。

### 7.3 截图里不要出现

- 你自己的真实关注列表、真实来源 URL、可辨认的他人头像（除非是你控制的测试号）
- 「官方 X」「Verified by X」这类暗示
- 浏览器外框、桌面壁纸、刘海、圆角阴影
- Playwright 调试条、DevTools 停靠在页面上

本地化：Chrome 语言改成日语后再拍 `*-ja.png`，改成简体中文后再拍 `*-zh.png`。X 页面上的徽标和 dock 跟随 **X 的语言**，可在 X 设置里改，与 Chrome 语言分开。

## 8. 宣传图（small promo / marquee）

这两种图**不能**按语言各传一份，所以少放字，靠 NB 标志说话。

品牌约束（与 `assets/branding/logo-imagegen-source.png` 一致）：

- 底：`#16221B`
- 字形：暖纸白
- 强调：酸性黄绿小切口
- 不要渐变、不要 3D、不要 X 的鸟/X 标志、不要长句

**440×280 small promo（必须）**

1. 用 Figma、预览或任意画布新建 **440 × 280**。
2. 铺满 `#16221B`。
3. 把 `public/icons/icon-128.png` 或品牌源图放到正中，标志大约占高度的 55–65%。
4. 不要写「不是兄弟」以外的说明文字；最好一个字都没有。
5. 导出 PNG 到 `assets/store/small-promo-440x280.png`。
6. 缩到一半看一眼，字形还要能认出来。

**1400×560 marquee（可选）**

同样构图，画布改成 1400×560，标志不要拉得过扁。没有这张图不影响提交，只是很难出现在商店顶部推荐位。

**YouTube（可选）**

用测试号录 60–90 秒：安装 → 同意页 → 普通浏览出现徽标 → 打开 Side Panel → 打开档案库。不要出声念密码，不要出真实关系数据。连到公开或「不列出」的 YouTube 即可。Dashboard 若把它标成必填，再补。

## 9. 在 Dashboard 里逐步填写

### 9.1 上传包

1. 打开 [Developer Dashboard](https://chrome.google.com/webstore/devconsole)。
2. **Add new item** / **New item**。
3. 选 `output/not-brother-0.4.7.zip` → **Upload**。
4. Manifest 合法后，左侧会出现 Package、Store listing、Privacy、Distribution、Test instructions。

### 9.2 Store listing

文案全部从 [store-listing.md](store-listing.md) 复制，不要现场改成「找出所有拉黑你的人」。

1. 顶部语言先选 **English**（默认）。
2. 名称和 Summary 一般会从 Manifest 带出，应分别是：
   - `Not Brother — X Relationship Observer`
   - `Annotate relationship evidence visible on X and keep a private observation history in this Chrome profile.`
3. **Detailed description**：粘贴 English Detailed description 全文。
4. **Category**：选 **Productivity**。
5. 上传 `icon-128.png`、至少 1 张 1280×800 英语截图、440×280 small promo。
6. **Homepage URL** / **Support URL**：粘贴第 1 节表格。
7. Mature content：关。
8. 顶部语言改成 **Japanese**，粘贴日文详细说明，上传日文截图。
9. 再选 **Chinese (China)**，粘贴中文详细说明，上传中文截图。
10. 三种语言必须讲同一件事。若弹出「本地化不一致」警告，功能边界一致就可以继续。

### 9.3 Privacy practices

**Single purpose**（用英语，方便审核）：

> Annotate relationship evidence already visible while the user browses x.com, and keep the observation history on the user's device for search, review, and export.

**权限理由**：整段复制 [store-listing.md](store-listing.md) 里 Permission justifications 的三块英文。

**Remote code**：选 **No, I am not using remote code.**

**Data usage** 按这张表勾，不要为了「看起来更干净」漏报：

| 类别 | 勾选 |
| --- | --- |
| Personally identifiable information / usernames | Yes |
| Website content | Yes |
| Web history / browsing activity | Yes（来源 URL） |
| Authentication information | No |
| Personal communications | No |
| Location / financial / health | No |
| 出售或用于广告 | No |
| 传给开发者或第三方 | No |
| Limited Use | 勾选遵守 |

**Privacy policy URL**：

`https://interjc.github.io/chrome-x-not-brother/privacy.html`

### 9.4 Distribution

- Visibility：按第 2 节，第一次建议 Private 或 Unlisted。
- Private 时确认 Trusted testers 已填。
- Regions：一般 **All regions**。某国若弹出你还没准备的 trader 信息，按页面提示排除，不要猜。
- 定价：免费。

### 9.5 Test instructions

官方标可选，但建议填。复制 [store-listing.md](store-listing.md) 的 Reviewer notes。不要写任何账号密码。

## 10. 提交审核

提交前再对一遍：

- [ ] `terms/` 已在公开 `main` 上，无痕能打开隐私政策
- [ ] ZIP 是 `npm run package` 打出来的
- [ ] 干净 profile 验收过
- [ ] 三语文案、权限理由、隐私勾选彼此一致
- [ ] 截图 1280×800，无真实关系数据
- [ ] 440×280 promo 已上传
- [ ] 可见性已选好
- [ ] 准备取消自动发布

然后点 **Submit for Review**。在确认框里：

1. **取消**自动发布。
2. 确认提交。

之后不要反复撤回再提。只有包或文案有实质错误才 cancel。预留数天到几周，不要为某一天承诺上线。超过官方页面写的等待阈值，再走 [one-stop support](https://support.google.com/chrome_webstore/contact/one_stop_support)。

## 11. 通过之后

1. 条目变成 staged / ready to publish。
2. 用测试号从商店链接装一次，再走一遍同意 → 徽标 → Side Panel → 档案库。
3. 30 天内点 **Publish**。
4. 若第一发是 Private / Unlisted，稳定后再改 Public 并重新提交。

## 12. 以后更新

按 [发布指南](release.md) 用 `npm run version:bump` 和 `npm run release` 升版本、打包。Dashboard 上传 `output/` 里的新 ZIP，不是增量。权限或收集范围变了，先改 `terms/`、`pages/` 和同意版本。出问题用 Dashboard 回滚，不要静默清空用户 IndexedDB。
