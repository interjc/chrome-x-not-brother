# 不是兄弟 / Not Brother

Not Brother（中文名：不是兄弟；日文名：兄貴じゃない）是一款面向 X 的 Chrome 扩展。你正常浏览 `x.com` 时，它会在已经出现的账号旁边标出关系，并把观察记录保存在当前 Chrome 配置里，方便以后发现互关、取关或拉黑变化。

关系档案只留在本机，不会上传。语言、开关和面板状态等小型偏好可通过 Chrome 账号同步；未登录 Chrome 或关闭同步时仍保存在当前设备。它不会替你关注、取关、拉黑或静音，也不会自动滚动或打开别人的资料。

## 核心功能

- **关系标注**：互关、我单向关注、TA 关注了我、TA 拉黑了我，以及可识别的关系变化。
- **本地档案**：在侧栏和完整档案库里查看、筛选、搜索曾经出现过的账号。
- **设置同步**：通过 Chrome Sync 在已登录且启用同步的 Chrome 配置间同步小型偏好；关系档案和当前 X handle 不同步。
- **可选时间线过滤**：隐藏已静音账号、已确认拉黑你的账号，或命中本地自定义黑名单规则的帖子。全部默认关闭。
- **中英日界面**：跟随浏览器语言，也可在选项里固定为简体中文、英语或日语。

## 安装

### Chrome 网上应用店

打开 [不是兄弟 · Chrome 网上应用店](https://chromewebstore.google.com/detail/dioanbgbpklflgochbljdehpjidckgfd)，点击「添加至 Chrome」。

### 从源码加载

适合开发者，或商店版本尚未更新到你需要的提交时：

1. 安装 [Chrome](https://www.google.com/chrome/) 116 或更高版本，以及 [nvm](https://github.com/nvm-sh/nvm)。
2. 克隆仓库并构建：

```bash
git clone https://github.com/interjc/chrome-x-not-brother.git
cd chrome-x-not-brother
source "$HOME/.nvm/nvm.sh"
nvm use
npm install
npm run build
```

3. 打开 `chrome://extensions`，打开右上角 **开发者模式**。
4. 点击 **加载已解压的扩展程序**，选择仓库里的 `dist/` 目录。

重新构建后，先在扩展卡片上点「重新加载」，再刷新已经打开的 X 标签页。

## 使用

安装后第一次打开侧栏，会先看到数据说明。只有你点「同意并开始」后，扩展才会标注页面并写入本地档案。未同意时，X 页面展开的 dock 和收起后的悬浮球旁都会显示「查看说明并同意」；也可以右键工具栏图标选择同名菜单项。它们只打开完整说明，不会代替你直接同意。之后可随时暂停。

工具栏图标状态：

- 酸性黄 `ON`：正在观察
- 灰色 `!`：已暂停
- 琥珀色 `!`：还没完成首次设置

### 页面上的徽标

正常浏览 X 即可。首页通常能直接读出关系；某条还没有徽标时，可以把鼠标停在作者头像或 ID 上，等 X 自己弹出关系浮窗。证据不足时不会显示「未知」，也不会为此存档。

关系变化会尽量写清楚：对方取关、你已取关、对方拉黑。无法单方判断时显示「关系变化」。

### 侧栏

点击工具栏图标打开侧栏，顶部可以在 **状态** 和 **选项** 之间切换。

- **状态**：观察概览、按关系筛选、最近账号。点击某一行会打开该账号的 X 主页。
- **选项**：界面语言、是否显示页面徽标、时间线过滤。右键工具栏图标选择 **选项**，会直接打开这一页。

X 页面右下角还有观察概览，可收成悬浮球。点「查看详情」同样打开侧栏；尚未同意时，悬浮球旁保留醒目的同意入口。

### 时间线过滤

在侧栏 **选项** 里打开，默认都是关的：

- **彻底隐藏已静音账号**：即使互关，也从首页、搜索、通知和帖子详情/评论区藏掉对方的帖子。对方主页仍可打开，方便取消静音。
- **隐藏拉黑了我的账号**：藏掉扩展已经确认拉黑了你的账号。这不是完整名单，只作用于已经观察过的账号。
- **应用自定义黑名单规则**：按账号 handle、显示名称或帖子正文的文字/安全正则隐藏帖子；每条规则可启停和设置失效时间。

已经在本地名单里的账号会立刻消失；第一次检测到的账号会先收起再隐藏。过滤只改变当前浏览器的显示。

“应用自定义黑名单规则”开关旁有醒目的“编辑规则与查看教程”按钮，可直接打开完整关系档案库的规则区。内置教程逐项解释 handle、显示名称、正文关键词/安全正则、启停、失效时间和 Gist JSON 写法，并附完整示例。规则区可以上传 JSON、从公开 HTTPS JSON 或公开 Gist 地址读取，也可以下载独立的规则 JSON。远程地址只在你点击加载时访问一次，Chrome 会先请求该站点的读取权限；不会后台订阅。导入经 Zod 校验，默认按规则 ID 合并，也可明确选择完全替换。完整格式见 [自定义黑名单规则 v1](docs/filter-rules.md)。

### 关系档案库

侧栏底部可打开完整档案库：搜索、筛选、排序、确认变化、查看历史、导出 JSON/CSV、导入 JSON 备份、删除单条或清空全部本地数据。

换电脑或清空数据前，请先导出 JSON。Chrome 不会在不同配置之间自动同步这份档案。

设置、规则与档案是分开的：语言、观察开关、页面徽标、dock/侧栏状态和三个时间线过滤总开关会写入 `chrome.storage.sync`；自定义规则文档、当前 X 登录 handle 与完整关系档案只保存在本机。Chrome 未登录、关闭同步或暂时离线时，小型设置照常在当前设备生效，之后由 Chrome 在条件满足时恢复同步。

## 隐私

扩展只读取当前 `x.com` 页面上已经显示的账号名称、handle、头像和关系提示。只有你启用自定义内容规则时，才会在本地读取当前帖子正文进行即时匹配；正文不会保存或上传。不读私信、Cookie，也不额外请求 X 接口。公开规则地址只在你明确点击导入后访问。

- [隐私政策](https://interjc.github.io/chrome-x-not-brother/privacy.html)
- [使用条款](https://interjc.github.io/chrome-x-not-brother/terms.html)

## 本地开发

仓库用 nvm 固定 Node `.nvmrc`（当前是 `24.19.0`）：

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm install
npm run dev
```

`npm run dev` 会监视源码并更新 `dist/`。在 `chrome://extensions` 重新加载扩展后，还要刷新已打开的 X 标签页。

常用命令：

```bash
npm run check             # 类型检查 + 单元测试
npm run build             # 生成 dist/
npm run validate:dist     # 校验清单和权限
npm run package           # 打出可加载的 ZIP
```

开发约定、目录说明和发布流程见 [docs/](docs/README.md)。给代理或自动化工具的仓库规则在 [AGENTS.md](AGENTS.md)。

## 参与贡献

欢迎到 [GitHub Issues](https://github.com/interjc/chrome-x-not-brother/issues) 反馈问题或建议。请不要在议题里粘贴密码、Cookie，或含真实关系数据的导出备份。

提交代码前请阅读 [贡献指南](docs/contributing.md)，并在本地跑通：

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm run check
npm run build
npm run validate:dist
npm run skills:validate
```

不要添加自动滚动、遍历资料、调用 X 私有接口，或点击关注 / 取关 / 拉黑 / 静音等账号操作。

## 版权与作者

[MIT License](LICENSE) © 2026 [Justin Chen](https://interjc.net)

- GitHub：[interjc/chrome-x-not-brother](https://github.com/interjc/chrome-x-not-brother)
- X：[@interjc](https://x.com/interjc)
- 个人主页：[interjc.net](https://interjc.net)

不是兄弟是独立扩展，与 X Corp. 没有隶属、认可或赞助关系。
