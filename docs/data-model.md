# 数据模型

数据库名：`not-brother-v1`，Dexie schema version：1。

`chrome.storage.local` 另外保存观察设置、同意版本、观察 dock 的 `dockCollapsed` 展示偏好和仅用于排除本人的 `viewerHandle`；这些字段不属于关系数据库。旧设置没有 `dockCollapsed` 时默认展开，不需要数据库迁移。

从 0.4.0 起，`unknown` 只是 adapter/domain 的内部结果，不是数据库状态。content script 不发送它，service worker 和 repository 也会防御性拒绝；扩展启动和安装时清理旧版本遗留的 unknown users 与 observations。

## users

每个规范化小写 handle 一条当前记录：

| 字段 | 含义 |
| --- | --- |
| `key` | 小写 handle，0.1 的主键 |
| `handle` | 最近观察到的原始大小写 |
| `displayName` / `avatarUrl` | 最近非空展示信息 |
| `profileUrl` | 标准 `https://x.com/<handle>` |
| `currentRelationship` | 最近可信基础关系 |
| `previousRelationship` | 最近一次已知变化前的关系 |
| `hasChanged` | 是否等待用户确认关系变化 |
| `changeDetectedAt` | 最近变化时间 |
| `firstSeenAt` / `lastSeenAt` | 生命周期时间戳 |
| `observationCount` | 收到的观察次数 |
| `lastSourceUrl` / `lastSourceType` | 最近观察来源 |
| `latestEvidence` | 支撑当前状态的证据类型 |

handle 更名会在 0.1 中形成新记录，因为扩展不读取 X 私有 user ID。

## observations

自增 `id` 的历史快照，包含用户身份、关系、证据、来源与时间。相同状态只有在来源变化、关系变化或距离上一次记录超过 15 分钟时才追加历史，避免无限滚动 DOM 重建造成密集重复。

## 合并规则

1. 只有已知 incoming 状态可以建立或更新用户及其历史。明确的双方都已取消关注（`none`）可以覆盖已有可见关系，但不能新建用户。
2. 内部 unknown 在入库前丢弃；domain 的合并函数仍保证它不能覆盖已知当前状态。`none` 不是 unknown：它表示 following 与 followsYou 都已明确为 false。
3. 两个不同的可见已知状态触发 `hasChanged=true`，旧状态进入 `previousRelationship`。`follows_you_only → none` 同样标成待确认的对方取关；其他转入 `none` 不标成待确认变化，也不显示徽标。
4. 用户确认变化只清除 `hasChanged`，不删除历史。
5. 迟到的旧时间戳观察可进入历史，但不能覆盖较新的当前状态。
6. JSON 导入以 `lastSeenAt` 较新的用户摘要为主，保留较大的计数、最早时间和 change 标记；按 `userKey + observedAt` 跳过已有历史，使重复导入同一备份保持幂等。
7. JSON/CSV 导出和 JSON 导入都过滤 unknown，旧备份不能重新引入它。
8. service worker 获得 `viewerHandle` 后删除同 key 的 users 与 observations；所有概览查询、导入和导出也再次排除该 key。

变化事件不新增数据库字段，也不改变导出 schema。展示层在 `hasChanged=true` 时根据 `previousRelationship → currentRelationship` 动态推导：当前已是 `mutual` 一律显示互关；当前 `following_only` 默认显示单向关注，仅当上一状态是 `mutual` 或 `follows_you_only` 时才覆盖为 `unfollowed_you`。`follows_you_only → none` 同样为 `unfollowed_you`，`mutual → follows_you_only` 为 `you_unfollowed`，任意已知非 blocked 状态变为 `blocked_by` 为 `blocked_you`；其他双方同时变化的转换使用通用 `changed`。`none` 可写入 users 以撤掉过期徽标；只有对方取关这一条会显示并进入概览。因此旧档案无需迁移即可获得细分展示，dock 仍按 `hasChanged` 汇总一个变化总数。

blocked-by 可保存 `blocked-notice`、`blocked-interaction-restriction` 或 `blocked-profile-summary-restriction`。后两者分别表示评论区三项互动限制已通过同页正常帖子对照，或已完整加载的作者浮窗缺少所有 following/follower 链接。首页等没有画出关注控件的卡片，可用 `page-user-entity` 表示关系来自当前页已经载入的 UI store 用户实体。

content script 可通过 service worker 的 `users:lookup` 批量查询页面当前可见的小写 handle。查询只返回已知关系并排除 viewer；它不会创建 observation 或改变 `lastSeenAt`，只用于把已有本地知识重新显示在页面 ID 区域。

## 迁移

结构变化必须增加 Dexie version 并编写保留数据的迁移。同步更新数据模型文档、JSON schema、merge/import tests 和维护 skill reference。
