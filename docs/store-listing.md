# Chrome Web Store 三语文案

本文提供 Not Brother 的 Chrome Web Store 可粘贴文案。提交者必须在每次发布前对照当前代码、权限、隐私政策和 Dashboard 字段复核；如果以后增加 X 账户操作、同步、遥测、AI 或远程服务，不得继续复用本文的“不执行账户操作”声明。

各语言的 Summary 必须与 `public/_locales/<locale>/messages.json` 中的 `extensionDescription` 完全一致，并保持在 132 个字符以内；构建校验会检查长度。

## English listing

### Name

Not Brother — X Relationship Observer

### Summary

Annotate relationship evidence visible on X and keep a private observation history in this Chrome profile.

### Detailed description

Not Brother is a local-first relationship observer for X. While you browse x.com normally, it annotates relationship evidence already visible on the page and keeps a private observation history in this Chrome profile.

The extension can identify mutual follows, accounts you follow that do not follow you back, accounts that follow you, opportunistic evidence that an account has blocked you, and changes between previously observed states. Attributable changes are labeled as followed you back, unfollowed you, or blocked you; the compact X-page panel keeps one aggregate change count. Insufficient evidence produces no label and no saved record.

Use the Chrome side panel for a compact overview or open the Relationship Fieldbook to search, filter, sort, review changes, export JSON or CSV, merge a JSON backup, and delete local records. The observer panel on X can minimize to an NB floating button and retains its state locally.

Not Brother only processes account identity and relationship hints rendered on the x.com page you are viewing. It does not auto-scroll, crawl profiles, read direct messages or cookies, call X APIs, click follow, unfollow, block, or mute controls, or send observation data to the developer. X interface changes can affect detection until the extension is updated.

Not Brother is an independent extension and is not affiliated with, endorsed by, or sponsored by X Corp.

Source code is available at https://github.com/interjc/chrome-x-not-brother. Report problems and ask for support on the repository Issues page.

### Version 0.4.7 release notes

- Adds a visible-page 2-second fallback rescan, immediate focus/visibility recovery, and serialized scan scheduling for more reliable live annotations.
- Retries observations after transient extension-message failures while keeping confirmed results deduplicated across polling passes.
- Distinguishes followed-back, unfollowed-you, and newly-blocked change events while keeping one aggregate change count in the X-page overview.
- Makes Side Panel relationship counts filter the user list and lets an explicit user click open the matching X profile.
- Keeps already-open Side Panel and Fieldbook settings synchronized, including signed-in viewer exclusion.
- Avoids treating engagement controls that have not rendered yet as blocked-by evidence.
- Keeps relationship badges on the same line as the X display name without moving handle or date metadata.
- Adds a persistent NB floating button for the X-page observer overview.
- Improves blocked-by detection from fully loaded author hover cards.
- Reads matching hover-card follow controls to identify mutual and one-way relationships in reply threads.
- Keeps known local relationships visible when the current card has no fresh evidence.
- Explains in zero-record states that reply-thread relationship evidence may require hovering an author.
- Adds Side Panel and Fieldbook feedback links that open the public GitHub Issues page.

## 中文商店文案

### 名称

不是兄弟 — X 关系观察器

### 简短说明

标注 X 页面已经显示的关系证据，并在当前 Chrome 配置中保存私密的本地观察历史。

### 详细说明

不是兄弟是一款本地优先的 X 关系观察器。你正常浏览 x.com 时，它会标注页面已经显示的关系证据，并把观察历史私密地保存在当前 Chrome 配置中。

扩展可以识别互相关注、我关注但对方没有关注我、对方关注了我、对方拉黑了我的机会式证据，以及前后观察状态的变化。可以归因的变化会明确显示为“回关了你”“取关了你”或“拉黑了你”，X 页面概览仍只保留一个变化合计数字。证据不足时不会显示标签，也不会保存记录。

你可以通过 Chrome 侧边栏查看简明概览，也可以打开关系档案库进行搜索、筛选、排序、核对变化、导出 JSON 或 CSV、合并 JSON 备份和删除本地记录。X 页面上的观察概览可收起为 NB 悬浮球，并在本机记住状态。

不是兄弟只处理你当前正在查看的 x.com 页面已经渲染的账号身份与关系提示。它不会自动滚动或遍历资料页，不读取私信或 Cookie，不调用 X API，不点击关注、取关、拉黑或静音控件，也不会把观察数据发送给开发者。X 界面改版可能暂时影响识别，直到扩展完成适配。

不是兄弟是独立开发的扩展，与 X Corp. 不存在隶属、认可或赞助关系。

源码位于 https://github.com/interjc/chrome-x-not-brother。问题反馈与支持请使用仓库的 Issues 页面。

### 0.4.7 更新说明

- 新增可见页面 2 秒兜底复扫、焦点/可见性恢复时立即检查和串行扫描调度，提高实时标注健壮性。
- 瞬时扩展消息失败后会重试观察，同时对已确认结果保持轮询去重。
- 关系变化细分为回关、取关和新拉黑事件，X 页面概览仍使用一个变化总数。
- Side Panel 的关系分类数字可筛选用户列表，用户明确点击后可打开对应 X Profile。
- 已打开的 Side Panel 与档案页会即时同步观察设置及当前登录账号排除状态。
- 评论互动控件尚未渲染时不再把“缺失”误当成“全部禁用”。
- 关系徽标与 X 显示名称保持同一行，不移动 `@handle` 与日期元数据。
- X 页面观察概览可收起为保持状态的 NB 悬浮球。
- 改进从完整作者浮窗识别“拉黑了我”的能力。
- 使用匹配作者浮窗的关注控件识别评论区互关和我单向关注。
- 当前卡片没有新证据时，仍可显示已经保存在本地的可信关系。
- 零记录时明确提示：评论区关系证据可能需要悬停作者后才会由 X 显示。
- Side Panel 与档案库页脚增加反馈入口，打开公开的 GitHub Issues 页面。

## 日本語ストア文案

### 名前

兄貴じゃない — X 関係オブザーバー

### 概要

X に表示された関係の証拠へ注釈を付け、この Chrome プロファイルだけに観察履歴を保存します。

### 詳細説明

兄貴じゃないは、ローカル優先の X 関係オブザーバーです。通常どおり x.com を閲覧している間に、ページ上へすでに表示された関係の証拠へ注釈を付け、観察履歴を現在の Chrome プロファイル内だけに保存します。

相互フォロー、自分だけがフォローしているアカウント、自分をフォローしているアカウント、相手からブロックされたことを示す状況的な証拠、以前の観察からの関係変化を識別できます。相手に帰属できる変化は「フォローバック」「フォロー解除」「ブロック」と明示し、X ページの概要では一つの変化合計として表示します。証拠が足りない場合はラベルを表示せず、記録も保存しません。

Chrome のサイドパネルでは概要を確認できます。関係アーカイブでは、検索、絞り込み、並べ替え、変化の確認、JSON または CSV のエクスポート、JSON バックアップの統合、ローカル記録の削除を行えます。X ページの観察概要は NB フローティングボタンに収納でき、その状態をローカルに保持します。

兄貴じゃないが処理するのは、閲覧中の x.com ページに描画済みのアカウント情報と関係のヒントだけです。自動スクロール、プロフィール巡回、DM や Cookie の読み取り、X API の呼び出し、フォロー・フォロー解除・ブロック・ミュート操作、開発者への観察データ送信は行いません。X の画面構造が変わると、拡張機能が更新されるまで識別へ影響する場合があります。

兄貴じゃないは独立した拡張機能であり、X Corp. との提携、承認、スポンサー関係はありません。

ソースコードは https://github.com/interjc/chrome-x-not-brother で公開しています。不具合報告とサポートはリポジトリの Issues ページをご利用ください。

### 0.4.7 更新内容

- 表示中ページの 2 秒フォールバックスキャン、フォーカス・可視性復帰時の即時確認、直列スキャン制御を追加し、リアルタイム注釈の安定性を高めました。
- 拡張機能メッセージの一時的な失敗後は観察を再試行し、確認済みの結果はポーリング間で重複保存しません。
- 変化をフォローバック、フォロー解除、新規ブロックに細分化し、X ページの概要では一つの変化合計を維持します。
- サイドパネルの関係件数でユーザー一覧を絞り込み、明示的に選んだユーザーの X プロフィールを開けるようにしました。
- 開いたままのサイドパネルとアーカイブで設定とログイン中ユーザーの除外を同期します。
- 返信・リポスト・いいねの操作が未描画の場合、すべて無効とは判定しません。
- 関係バッジを X の表示名と同じ行に保ち、`@handle` と日付の配置は変更しません。
- X ページの観察概要を、状態を保つ NB フローティングボタンへ収納できます。
- 完全に読み込まれた作者ホバーカードからのブロック検出を改善しました。
- 一致する作者ホバーカードのフォロー操作表示から、返信スレッドの相互・片方向フォローを識別します。
- 現在のカードに新しい証拠がなくても、ローカルで確認済みの関係を表示します。
- 記録がゼロの場合、返信作者へのホバーが必要なことを明確に案内します。
- サイドパネルとアーカイブのフッターから公開 GitHub Issues へフィードバックできるようにしました。

## Store listing URLs

这些字段三种语言共用。

### Homepage URL

https://github.com/interjc/chrome-x-not-brother

### Support URL

https://github.com/interjc/chrome-x-not-brother/issues

### Privacy policy URL

https://interjc.github.io/chrome-x-not-brother/privacy.html

### Terms of use URL

Chrome Web Store 没有单独的条款字段时，把该地址写在隐私政策或详细说明中即可。

https://interjc.github.io/chrome-x-not-brother/terms.html

## Permission justifications

Dashboard 的权限说明建议使用英语，便于审核团队处理。保持以下内容与 Manifest 和隐私政策一致。

### Host access: `https://x.com/*`

Not Brother runs only while the user actively browses x.com. It reads account names, handles, avatar URLs, relationship indicators, and the current source URL already rendered on that page so it can display relationship annotations and create a user-visible local observation history. It does not crawl pages, call X APIs, or run on other sites.

### `storage`

The extension uses `chrome.storage.local` to save the user's consent version, observer on/off state, page-badge preference, observer-panel minimized preference, and signed-in X handle used only to exclude the viewer from observations. Relationship records remain in the extension origin's local IndexedDB. No setting or observation is sent to the developer.

### `sidePanel`

The extension uses Chrome's side panel to show the prominent first-run data disclosure, observation controls, local relationship counts, recent observations, and a link to the full local archive.

## Privacy practices worksheet

Dashboard 字段可能调整，提交时以实际界面为准。当前代码应按以下方向如实申报：

| Dashboard 类别 | 当前答案 | 说明 |
| --- | --- | --- |
| Personally identifiable information | Yes | X handle、显示名称和头像 URL 可能识别个人。 |
| Website content | Yes | 读取 x.com 已显示的关系提示和账号区域。 |
| Web history / browsing activity | Yes | 保存提供观察出处的当前 x.com 来源 URL。 |
| Authentication information | No | 不读取密码、会话 Cookie 或 token。 |
| Personal communications | No | 不读取私信或帖子正文。 |
| Location, financial, health information | No | 功能不读取这些类别。 |
| Data sale or advertising | No | 不出售数据，也不用于广告、信用或画像。 |
| Data transfer | No developer/third-party transfer | 观察数据留在扩展本地存储；头像视图可能直接请求已有 X CDN URL。 |

## Reviewer notes

可把下面的英语步骤粘贴到审核备注，并按提交版本调整：

1. Install the extension. Its local onboarding page opens automatically, and observation remains disabled.
2. Review the prominent disclosure and click “Agree and start local observation.”
3. Open x.com while signed in and browse normally. Relationship badges appear only where X renders sufficient evidence.
4. Hover an author to let X display its standard hover card. The extension may use the matching card's visible follow indicators to annotate that author.
5. Use the NB panel in the lower-right corner to open the side panel, or minimize it to a floating button and restore it.
6. Open the Relationship Fieldbook from the side panel to review, export, delete, or clear local observations.
7. Pause the observer to remove badges and stop new collection.

The extension requires no reviewer credentials and contains no hidden test account. Results depend on relationship evidence available to the reviewer's own X account. No extension control performs an X account action.

Source and support: https://github.com/interjc/chrome-x-not-brother
Issues: https://github.com/interjc/chrome-x-not-brother/issues

## Submission-time consistency check

- Confirm all three descriptions advertise the same features and limitations.
- Confirm the current version and release notes match `public/manifest.json`.
- Confirm the permission justifications include every field stored in `chrome.storage.local`.
- Confirm the public privacy policy URL is the GitHub Pages page `https://interjc.github.io/chrome-x-not-brother/privacy.html` and identifies the developer, contact method, and effective date.
- Confirm Homepage URL is the GitHub repository and Support URL is the Issues page.
- Remove every statement about “no account actions” before submission if the product later gains any X action shortcut, then update consent and privacy review first.
