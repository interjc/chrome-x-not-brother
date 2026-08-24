# Contributing to Not Brother

Not Brother is open source at [interjc/chrome-x-not-brother](https://github.com/interjc/chrome-x-not-brother).

- Feedback and support: [GitHub Issues](https://github.com/interjc/chrome-x-not-brother/issues)
- Full contribution guide (中文): [docs/contributing.md](docs/contributing.md)
- Development setup: [docs/development.md](docs/development.md)

这个扩展默认标注并收集 `x.com` 上已经出现的关系证据；可选时间线过滤默认关闭。不要添加自动滚动、资料遍历、X 私有接口或关注 / 取关 / 拉黑 / 静音等账号操作。

The extension annotates relationship evidence already visible on `x.com` and stores it locally. Optional timeline filters stay off by default. Do not add automatic scrolling, profile traversal, private X APIs, or Follow / Unfollow / Block / Mute actions.

Before a pull request:

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
npm run check
npm run build
npm run validate:dist
npm run skills:validate
```

Keep English, Japanese, and Simplified Chinese catalogs complete when user-visible copy changes. Update `docs/` and `skills/x-relationship-observer/references/` when behavior changes.
