# 贡献指南

Not Brother 是开源软件。源码、议题和发布说明都在 [interjc/chrome-x-not-brother](https://github.com/interjc/chrome-x-not-brother)。

- 反馈与支持：[GitHub Issues](https://github.com/interjc/chrome-x-not-brother/issues)
- 开发循环：[开发指南](development.md)
- 手工验收：[测试指南](testing.md)
- 代理或自动化改动还必须遵守仓库根目录的 [AGENTS.md](../AGENTS.md)

## 产品边界

这个扩展只有两件事：

1. 给已经出现在 `x.com` 页面上的用户标注可确认的关系；
2. 把观察结果保存在扩展自己的本地数据库里。

不要提交会自动滚动 X、打开或预取资料页、主动调用 X 私有接口或拦截网络，或点击关注、取关、拉黑、静音及其他账号操作控件的代码。读取当前页已经载入、且对应可见作者的 UI store 关系字段是允许的。标准 X 资料链接只能由用户明确点击或键盘激活后打开。

证据不足必须保持内部 `unknown`：不要徽标、不要持久化、不要导入导出、不要计数，也不要从无关时间线卡片推断负面关系。已知关系可以被另一条已知关系替换；`unknown` 不得覆盖已知记录。

## 报告问题

请到 [Issues](https://github.com/interjc/chrome-x-not-brother/issues) 开新议题，先搜索是否已有相同报告。

缺陷报告请尽量写清：

- 扩展版本（档案库页脚或 `manifest.json`）和 Chrome 版本；
- Chrome UI 语言、X 页面语言，以及当时所在的 X 页面类型（首页、评论线程、资料、列表等）；
- 实际结果和预期结果；
- 能否稳定复现。

不要在议题里粘贴账号密码、Cookie、导出备份里的真实关系数据，或其他人的头像与来源 URL。需要截图时，使用虚构或已获授权的测试账号，并遮盖无关个人信息。

功能建议必须仍然落在“标注与本地收集”之内。若建议需要账户操作、全站扫描、X API、远程同步或遥测，请先说明为什么这没有越过产品边界；这类改动不会作为常规补丁接受。

## 开发环境

Node.js 通过 nvm 管理，版本以 `.nvmrc` 为准（当前是 `24.19.0`）。非交互 shell 可能解析到过旧的系统 Node，任何 `npm` 命令前都要先加载 nvm：

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm install
```

不要用系统级 Node 替代 nvm。仓库当前没有 Python 运行依赖。

日常循环：

```bash
npm run dev
```

在 `chrome://extensions` 启用 Developer mode，**Load unpacked** 并选择仓库的 `dist/`。构建更新后，先点扩展卡片的“重新加载”，再刷新已经打开的 X 标签页。

## 改哪里

| 改动 | 位置 |
| --- | --- |
| X 选择器或本地化关系文案 | 只放在 `src/content/x-adapter.ts` 和对应 fixture |
| 扫描调度、复扫、签名去重 | `src/content/` |
| 关系规则与导入导出 | `src/domain/` |
| 运行时中英日文案 | `src/i18n/index.ts` 三个 catalog 一起改 |
| Manifest 名称或简介 | `public/_locales/en`、`ja`、`zh_CN` |
| 存储与设置 | `src/storage/` |
| Side Panel / 档案库 | `src/ui/` |
| 权限 | `public/manifest.json`，并同步校验脚本和隐私文档 |

用户可见字符串必须走 `src/i18n/`，并保持英语、日语、简体中文完整。扩展页默认跟随 Chrome UI 语言，也可由 Side Panel / 档案库的语言选择器覆盖；注入 X 的徽标和 dock 在有手工选择时跟随该选择，`auto` 时跟随页面语言。用 DOM API 和文本内容注入 UI，不要把 HTML 字符串插入 X。运行时代码必须全部打进本地包，不能远程加载可执行代码。

## 提交前检查

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm run check
npm run build
npm run validate:dist
npm run skills:validate
```

维护者打商店更新包时用 `npm run release`，见 [发布指南](release.md)。不要把手压的 `dist/` 文件夹上传到 Chrome Web Store。

选择器、关系规则或 Side Panel 交互变化时，还要补测试并按 [测试指南](testing.md) 做相关手工步骤。行为或工作流变化时，同步更新 `docs/` 和 `skills/x-relationship-observer/references/` 中对应的说明，并保持 [README](../README.md) 文档索引准确。

不要为了方便新增 `tabs`、`scripting`、`cookies`、`webRequest` 或全站访问。内容脚本不得使用页面 origin 的 IndexedDB。

## Pull request

1. 从最新 `main` 开分支，一个 PR 只做一件事。
2. 标题说明用户可感知的结果，而不是只写文件名。
3. 说明如何验证，并列出跑过的命令。
4. 若改了用户可见文案，写明三种语言都已更新。
5. 若改了权限、收集范围或同意流程，先更新 `terms/privacy.md`、必要时代码中的同意版本，以及商店披露草稿，再请求合并。

维护者可能要求调整范围，使改动留在产品边界内。

## 许可

贡献按仓库的 [MIT License](../LICENSE) 授权。
