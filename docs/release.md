# 发布指南

## 版本准备

1. 确认功能仍严格限定为标注与本地收集。
2. 同步修改 `package.json` 与 `public/manifest.json` 的 SemVer 版本。
3. 更新 README、用户文档、隐私说明、维护说明和 skill references。
4. 重新核验当前 Chrome Web Store 政策与 X 条款；不要沿用旧研究结论。
5. 确认商店 listing 标明最低 Chrome 116，并更新包含 X 页面观察 dock、工具栏状态和暗黑模式的截图。
6. 确认 `en`、`ja`、`zh_CN` Manifest catalog 完整，三种语言的 listing 说明表达相同功能与隐私边界，并准备对应截图。

`npm run validate:dist` 会同时检查三语 Manifest Summary 不超过 132 个字符、与 `docs/store-listing.md` 完全一致，并确认三种语言都含当前版本的更新说明标题。版本升级时必须同步更新这些文案后才能打包。

## 可重复构建

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm ci
npm run check
npm run test:coverage
npm run build
npm run validate:dist
npm run skills:validate
npm run package
```

产物：`dist/` 可直接 Load unpacked；`artifacts/not-brother-<version>.zip` 是 manifest 位于压缩包根目录的发布包。

## 发布前手工测试

在干净 Chrome 配置执行 [测试指南](testing.md) 的全部步骤。至少覆盖英语、日语、简体中文的 Chrome UI 自动切换，并把 X 设为与 Chrome 不同的语言验证注入 UI；同时验证无网络 API、无自动滚动、无账户操作。

## Chrome Web Store

商店说明必须准确披露：扩展只在 x.com 运行；读取页面中已经显示的用户关系证据；数据只保存在本地；不执行关注、取关、拉黑或静音；“拉黑了我”是机会式发现，不是完整列表。

准备截图、权限说明、单一用途说明和与 [terms/privacy.md](../terms/privacy.md) 一致的隐私政策。Homepage URL 填 GitHub 仓库，Support URL 填 [Issues](https://github.com/interjc/chrome-x-not-brother/issues)，隐私政策 URL 填 GitHub Pages 的 `https://interjc.github.io/chrome-x-not-brother/privacy.html`。商店审核通过不代表 X 条款许可，需单独评估。

使用 [Chrome Web Store 三语文案](store-listing.md) 准备 English、Japanese 与 Chinese (China) listing、版本更新说明、权限理由和 reviewer notes。发布前必须逐句核对当前功能边界，不能把旧版“不执行账户操作”的文案带入包含账户操作的新版本。

第一次上架按 [首次上架准备](deploy.md) 做：里面写清仓库已完成的部分、怎么拍 1280×800 截图、以及 Dashboard 逐步点击。政策和字段原则见 [Chrome Web Store 标准上架指南](chrome-web-store.md)。

## 回滚

保留前一版本 ZIP。回滚前导出 JSON，安装旧版本后确认数据库 schema 兼容。除非用户明确接受数据丢失，不得用清空 IndexedDB 作为常规回滚步骤。
