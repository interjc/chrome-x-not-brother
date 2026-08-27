# 自定义黑名单规则 v1

本文定义 Not Brother 的 `not-brother-filter-rules` JSON v1。代码中的权威校验器是 `src/domain/filter-rules.ts`；导入文件必须通过 Zod 完整校验，未知字段也会被拒绝。

## 行为边界

- 总开关 `hideByFilterRules` 默认关闭，作为小型偏好保存在 `chrome.storage.sync`；规则文档不参与同步，只保存在当前 Chrome 配置的 `chrome.storage.local`，并按当前登录 X 账号的小写 handle 分命名空间：`notBrother.filterRules.v1.ns.{handle}`。切换 X 账号时，匹配和编辑都只使用该账号自己的规则。旧的未分命名空间文档会在首次识别到 handle 时迁入该账号。
- 用户本地还没有任何规则文档时，档案库黑名单页会载入 [`config/filter-rules-default.json`](../config/filter-rules-default.json) 作为可编辑示例，不会自动打开总开关。导入处的示例地址是该文件在仓库 `main` 上的 Raw URL。规则编写教程默认收起。
- 任一启用且尚未过期的规则命中即隐藏帖子，规则之间是 OR；v1 的唯一动作是 `hide`，不点击 X 的静音、拉黑或其他控件。
- 只处理首页、搜索、通知和帖子详情/评论区中当前已加载的帖子单元格。个人主页、HoverCard、UserCell、关注/粉丝列表保持可见。
- 内容规则只读取当前候选帖子的可见正文用于当场匹配，不保存正文，不写观察历史，不向开发者或规则来源发送正文，也不额外请求 X 接口。
- content script 只在总开关打开且同意版本有效时，向 service worker 请求已通过 Zod 校验的规则快照；它不直接读取或校验完整 local 文档。帖子正文只留在页面内存中，不随快照或匹配结果发送。
- 失效规则保留在编辑器和导出文件中，便于复核或续期，但不参与匹配；可见页的 2 秒兜底复扫会在到期后恢复帖子。

v1 用 X handle 作为公开、稳定且当前页面可确认的账号标识，匹配时去掉可选的 `@` 并转小写。X 内部数字 user id 不属于 v1：扩展不能保证每个当前可见 DOM 候选都能在不新增网络请求的前提下取得它。

## JSON 结构

```json
{
  "format": "not-brother-filter-rules",
  "schemaVersion": 1,
  "name": "My filters",
  "description": "Example rules",
  "rules": [
    {
      "id": "accounts-example",
      "label": "Known accounts",
      "enabled": true,
      "expiresAt": null,
      "type": "user_handles",
      "handles": ["example", "another_user"]
    },
    {
      "id": "name-example",
      "label": "Display-name keyword",
      "enabled": true,
      "expiresAt": "2027-01-01T00:00:00.000Z",
      "type": "display_name",
      "match": {
        "mode": "contains",
        "value": "official",
        "caseSensitive": false
      }
    },
    {
      "id": "content-example",
      "label": "Giveaway posts",
      "enabled": true,
      "expiresAt": null,
      "type": "content",
      "match": {
        "mode": "regex",
        "value": "giveaway\\s+(today|now)",
        "caseSensitive": false
      }
    }
  ]
}
```

### 公共字段

| 字段 | 约束 | 语义 |
| --- | --- | --- |
| `id` | 1–64 字符；字母或数字开头，之后可用字母、数字、`.`、`:`、`_`、`-`；规则集内唯一 | 规则标识；追加导入时若冲突会生成新 id |
| `label` | 1–120 字符 | 供用户识别的规则名称 |
| `enabled` | boolean | 是否参与匹配 |
| `expiresAt` | `null` 或带时区的 ISO 8601 时间 | `null` 表示永久；到期瞬间起不再匹配 |
| `type` | `user_handles`、`display_name`、`content` | 判别联合类型 |

`user_handles` 额外包含 `handles`，至少 1 个、最多 10,000 个合法 X handle，同一规则内规范化后不得重复。

`display_name` 与 `content` 额外包含 `match`：

- `mode` 是 `contains` 或 `regex`；
- `value` 长度 1–256；
- `caseSensitive` 明确控制大小写；
- 所有文字先做 Unicode NFKC 规范化；每个待匹配字段最多取 5,000 个字符；
- 正则使用 JavaScript Unicode 模式。导入时既编译检查，也通过 `safe-regex2` 拒绝可能产生灾难性回溯的表达式。

整个 JSON 的 UTF-8 大小最多 1 MiB，规则最多 500 条。顶层 `name` 为 1–120 字符，`description` 最多 500 字符。

## 编辑、导入和导出

Side Panel、Chrome Options 页与关系档案库中，“应用自定义黑名单规则”开关旁都提供“编辑规则与查看教程”入口。Side Panel 与 Options 会打开 `dashboard.html#filter-rules`；档案库内则原地展开规则区、滚动到目标并把键盘焦点移到折叠标题。该入口不依赖开关是否已经启用，也不新增 Chrome 权限。

关系档案库提供完整表单编辑器，以及默认收起的编写教程。教程说明三种匹配对象、contains 与安全正则、大小写、单条启停、失效时间、OR 语义、导入时的追加/清空覆盖、内容隐私边界，并给出完整 JSON v1 示例。用户不需要手写 JSON 即可使用表单；也可用 `skills/x-not-brother-rules` 让 AI 阅读或改导出的 JSON。保存前对整个草稿运行 Zod 校验；校验失败时不覆盖已保存规则。导出使用浏览器 Blob 下载，不申请 `downloads` 权限。

导入支持：

1. 用户选择的本地 `.json` 文件；
2. 公开 HTTPS JSON URL；
3. 公开 Gist 页面 URL、Gist API URL 或单个 Raw URL。

导入时必须选择 **追加到现有规则** 或 **清空后覆盖**，暂不提供按 id 合并。追加会保留当前规则，把导入规则接到后面；id 冲突时为导入规则生成新 id。清空覆盖用导入文件整份替换当前账号的规则集。含多个 JSON 文件的 Gist 必须改用目标文件的 Raw URL，避免猜测。

远程加载只发生在用户点击“加载地址”后，不保存订阅，也不后台刷新。Manifest 仅声明 `https://*/*` 为 `optional_host_permissions`；每次首次访问某个来源前，由 `chrome.permissions.request()` 在该用户手势内申请相应 host。请求使用 HTTPS、`credentials: omit`、禁止重定向、12 秒超时和流式大小上限。Gist 页面通过公开 GitHub Gist API读取；文件被 API 截断时，只允许转到 GitHub 返回的 `gist.githubusercontent.com` Raw URL。私有或需要认证的资源不支持。

## 版本与兼容

`format` 与 `schemaVersion` 都是必填常量。未来不兼容结构使用新的 schema version，并保留显式迁移；不得在 v1 下悄悄改变字段语义。规则文档独立于关系数据库备份，关系档案 JSON 导入不会覆盖过滤规则，过滤规则导入也不会修改 users/observations。
