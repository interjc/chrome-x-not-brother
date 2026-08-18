# Chrome Web Store 素材

规格和上传顺序见 [docs/deploy.md](../../docs/deploy.md)。宣传图用官方 NB 标志按商店尺寸合成；截图由仓库里的验收画面裁成 1280×800。不要用模型编造 X 页面。

| 文件 | 规格 | 用途 |
| --- | --- | --- |
| `icon-128.png` | 128×128 | 商店图标，可直接上传 |
| `small-promo-440x280.png` | 440×280 | 必填 small promo |
| `marquee-1400x560.png` | 1400×560 | 可选 marquee |
| `screenshot-01-consent-en.png` | 1280×800 | 英语默认 listing：首次同意 |
| `screenshot-01-consent-ja.png` | 1280×800 | 日语 listing：首次同意 |
| `screenshot-01-consent-zh.png` | 1280×800 | 中文 listing：首次同意 |
| `screenshot-02-x-dock-zh.png` | 1280×800 | 测试页上的观察 dock（虚构账号） |
| `screenshot-02-x-dock-ja.png` | 1280×800 | 日语 dock |
| `screenshot-04-sidepanel-zh.png` | 1280×800 | 中文 Side Panel 空状态 |
| `screenshot-05-fieldbook-en.png` | 1280×800 | 英语档案库 |
| `screenshot-05-fieldbook-dark-zh.png` | 1280×800 | 中文暗黑档案库 + 同意条 |
| `screenshot-05-fieldbook-data-zh.png` | 1280×800 | 中文档案库（虚构测试数据） |

英语默认 listing 建议上传这 5 张（没有工具栏 `ON` 和真实 x.com 全页时）：

1. `screenshot-01-consent-en.png`
2. `screenshot-05-fieldbook-en.png`
3. `screenshot-05-fieldbook-data-zh.png`
4. `screenshot-02-x-dock-zh.png`
5. `screenshot-05-fieldbook-dark-zh.png`

`screenshot-02` 来自测试夹具，不是真实 x.com。过审后若要更像真实浏览，再按 `docs/deploy.md` 第 7 节补拍。工具栏 `ON` 目前没有现成图，需要你在干净 Chrome 里拍。
