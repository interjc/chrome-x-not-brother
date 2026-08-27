# Chrome Web Store 三语文案

本文提供 Not Brother 的 Chrome Web Store 可粘贴文案。提交者必须在每次发布前对照当前代码、权限、隐私政策和 Dashboard 字段复核；如果以后增加 X 账户操作、关系档案同步、遥测、AI 或远程服务，不得继续复用本文的“不执行账户操作”或“观察档案仅本地”声明。

各语言的 Summary 必须与 `public/_locales/<locale>/messages.json` 中的 `extensionDescription` 完全一致，并保持在 132 个字符以内；构建校验会检查长度。

## English listing

### Name

Not Brother — X Relationship Observer

### Summary

Annotate relationship evidence visible on X and keep a private observation history in this Chrome profile.

### Detailed description

Not Brother is a local-first relationship observer for X. While you browse x.com normally, it annotates relationship evidence already visible on the page and keeps a private observation history in this Chrome profile.

The extension can identify mutual follows, accounts you follow that do not follow you back, accounts that follow you, opportunistic evidence that an account has blocked you, and changes between previously observed states. Mutual stays labeled mutual. One-way following stays labeled one-way unless history shows they unfollowed you. Newly blocked states get a specific label; if neither account follows the other, no badge is shown. The compact X-page panel keeps one aggregate change count. Insufficient evidence produces no label and no saved record.

Use the Chrome side panel for a compact overview or open the Relationship Fieldbook to search, filter, sort, review changes, export JSON or CSV, merge a JSON backup, and delete local records. The observer panel on X can minimize to an NB floating button. Small preferences such as language, controls, and panel state can follow the user's Chrome Sync account; when signed out or sync is disabled, they remain on the current device. Relationship observations and the current X handle never sync.

Optional custom blacklist rules can hide posts by exact X handle, display-name text, or post-content text/regular expression, with per-rule enablement and expiration. Rules are edited locally and can be imported from a local JSON file or, after an explicit site-permission prompt, fetched once from a public HTTPS JSON file or public Gist. The full rule document stays local and is separate from the relationship archive.

Not Brother processes account identity and relationship hints rendered on the x.com page you are viewing. When you enable a custom content rule, it also matches the current visible post text locally without storing or transmitting that text. It does not auto-scroll, crawl profiles, read direct messages or cookies, call X APIs, click follow, unfollow, block, or mute controls, or send observation data to the developer. X interface changes can affect detection until the extension is updated.

Not Brother is an independent extension and is not affiliated with, endorsed by, or sponsored by X Corp.

Source code is available at https://github.com/interjc/chrome-x-not-brother. Report problems and ask for support on the repository Issues page.

### Next release notes

- Syncs small preferences through the user's enabled Chrome Sync account while keeping the relationship archive and current X handle local. Existing local preferences migrate without overwriting settings already present in Chrome Sync.
- Adds local Zod-validated blacklist rules for handles, display names, and post content, with expiration, JSON file import/export, and one-time public HTTPS/Gist import behind optional per-site permission.
- Makes first-run consent easier to find with a prominent entry beside the minimized NB button and an action-icon context-menu shortcut; both open the full disclosure before consent.

### Version 0.5.4 release notes

- Tightens "They unfollowed" so it only appears when history shows they used to follow you and you still follow them. Who to follow suggestions are no longer recorded as unfollows.

### Version 0.5.3 release notes

- Also hides muted and blocked-you posts inside post threads and reply conversations, not only Home, search, and notifications.

### Version 0.5.2 release notes

- Hides muted or blocked-by posts as soon as they are detected. Accounts already in the local list disappear immediately; newly detected accounts collapse with a short animation.

### Version 0.5.1 release notes

- Splits the Side Panel into Status (relationship overview and recent accounts) and Options (language, badges, timeline filters).
- Right-click the toolbar icon and choose Options to open the Side Panel directly on the Options tab.

### Version 0.5.0 release notes

- Adds a Chrome Options page (right-click the toolbar icon → Options) for optional timeline filters. Both filters stay off until you turn them on.
- Optionally hide muted accounts on Home, search, and notifications even if you follow each other. Profile and post pages stay visible so you can unmute.
- Optionally hide posts from accounts the extension already knows blocked you, on Home, search, and notifications. This is not a complete block list.
- The same filters appear in the Side Panel and Relationship Fieldbook. They only change what this browser shows; they do not mute, block, or notify anyone.

### Version 0.4.10 release notes

- In post details, keeps X's display name and @handle on one line and puts the relationship badge on the next line, with 1–2px between the left accent and the name.
- Shows Side Panel and Fieldbook avatars from the account handle so each photo matches that user.
- Opens the matching X profile from a Fieldbook avatar, display name, or @handle click. The Side Panel row still opens the same profile. 

### Version 0.4.9 release notes

- Adds a language switcher in the Side Panel and Fieldbook. It defaults to the browser language; choosing English, Japanese, or Simplified Chinese also updates relationship badges and the observer dock on X.
- Avoids labeling photo-viewer conversation cards as blocked-you while the right-hand list is still scrolling.
- Places relationship badges immediately before the visible @handle and evens out the spacing around the tag.

### Version 0.4.8 release notes

- Identifies Home timeline authors from status permalinks, avatars, and cleaned handle text so known local records can annotate cards without a hover card.
- Reads follow relationship fields X already loaded into the current page UI store, tweet components, and completed GraphQL responses, so Home and reply authors can be labeled without hovering.
- Still does not send extra X requests, auto-scroll, or open hover cards. Hover remains only a fallback when those already-loaded fields are missing.

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
- Explains in zero-record states that Home and reply-thread relationship evidence may require hovering an author.
- Adds Side Panel and Fieldbook feedback links that open the public GitHub Issues page.

## 中文商店文案

### 名称

不是兄弟 — X 关系观察器

### 简短说明

标注 X 页面已经显示的关系证据，并在当前 Chrome 配置中保存私密的本地观察历史。

### 详细说明

不是兄弟是一款本地优先的 X 关系观察器。你正常浏览 x.com 时，它会标注页面已经显示的关系证据，并把观察历史私密地保存在当前 Chrome 配置中。

扩展可以识别互相关注、我关注但对方没有关注我、对方关注了我、对方拉黑了我的机会式证据，以及前后观察状态的变化。已经互关就显示“互关”。我单向关注默认显示“单向关注”；只有跟历史比对确认对方取关，或对方拉黑，才用更具体的文案。双方都已取消关注时不显示徽标。X 页面概览仍只保留一个变化合计数字。证据不足时不会显示标签，也不会保存记录。

你可以通过 Chrome 侧边栏查看简明概览，也可以打开关系档案库进行搜索、筛选、排序、核对变化、导出 JSON 或 CSV、合并 JSON 备份和删除本地记录。X 页面上的观察概览可收起为 NB 悬浮球。语言、开关和面板状态等小型偏好可跟随用户启用的 Chrome Sync；未登录或关闭同步时仍保存在当前设备。关系观察档案和当前 X handle 永不同步。

可选自定义黑名单规则可按 X handle 精确列表、显示名称文字或帖子内容文字/正则隐藏帖子，并支持逐条启停和到期时间。规则在本地编辑，可从本地 JSON 导入；在用户明确同意目标站点权限后，也可从公开 HTTPS JSON 或公开 Gist 读取一次。完整规则文档只留在本机，与关系档案分开。

不是兄弟处理你当前正在查看的 x.com 页面已经渲染的账号身份与关系提示。只有你启用自定义内容规则时，才会在本地即时匹配当前可见帖子正文，且不保存或传输正文。它不会自动滚动或遍历资料页，不读取私信或 Cookie，不调用 X API，不点击关注、取关、拉黑或静音控件，也不会把观察数据发送给开发者。X 界面改版可能暂时影响识别，直到扩展完成适配。

不是兄弟是独立开发的扩展，与 X Corp. 不存在隶属、认可或赞助关系。

源码位于 https://github.com/interjc/chrome-x-not-brother。问题反馈与支持请使用仓库的 Issues 页面。

### 下一版本更新说明

- 小型偏好可通过用户启用的 Chrome Sync 同步，关系档案和当前 X handle 仍只保存在本机。旧 local 偏好迁移时不会覆盖 Chrome Sync 已有设置。
- 未同意时，收起后的 NB 悬浮球旁会显示醒目入口，工具栏图标右键菜单也能打开完整隐私说明；入口不会直接代替用户同意。

### 0.5.4 更新说明

- 收紧「对方取关」：只有历史确认对方曾经关注你、且你现在仍关注对方时才标记。不再把「跟随谁」建议卡记成取关。

### 0.5.3 更新说明

- 静音和「拉黑了你」的隐藏也作用于帖子详情和评论区，不再只覆盖首页、搜索和通知。

### 0.5.2 更新说明

- 一检测到静音或拉黑了你的帖子就隐藏。本地名单里已有的账号立刻消失；第一次检测到的账号会先收起再隐藏。

### 0.5.1 更新说明

- 侧栏分为「状态」（关系概览和最近账号）和「选项」（界面语言、徽标、时间线过滤）。
- 右键工具栏图标选择「选项」，会直接打开侧栏的选项标签。

### 0.5.0 更新说明

- 新增 Chrome 选项页（右键工具栏图标 → 选项），提供可选的时间线过滤。两项默认关闭，只有你打开后才生效。
- 可选彻底隐藏已静音账号：即使互关，也从首页时间线、搜索和通知中隐藏其帖子。个人主页和帖子详情仍可打开，方便取消静音。
- 可选隐藏扩展已经确认拉黑了你的账号的帖子（首页、搜索、通知）。这不是完整拉黑名单。
- Side Panel 和关系档案库也提供同样的开关。只改变当前浏览器的显示，不会替你静音、拉黑或通知任何人。

### 0.4.10 更新说明

- 帖子详情把 X 原有的显示名和 @handle 放在一行，关系标签单独在下一行；左边线与名字只留 1–2px。
- 侧栏和档案库按 handle 显示对应账号头像，避免串用其他账号的图片。
- 档案库点击头像、显示名或 @handle 会打开该账号 X 主页；侧栏整行同样打开资料。 

### 0.4.9 更新说明

- Side Panel 和关系档案库可手工切换界面语言，默认跟随浏览器；选中英语、日语或简体中文后，X 页面上的关系徽标和观察 dock 也会一起切换。
- 打开图片查看器并滑动右侧列表时，不再把尚未稳定的会话卡片误标成“拉黑了你”。
- 关系徽标统一放在可见 @handle 之前，并调整标签左右空隙。

### 0.4.8 更新说明

- 首页时间线可从 status 链接、头像和去掉格式字符的 handle 识别作者，本地已确认关系无需悬停即可回标。
- 读取 X 已为当前页载入的 UI store、帖子组件和已完成 GraphQL 响应中的关注关系字段，使首页和评论区作者通常不必悬停即可标注。
- 仍不会额外请求 X 接口、自动滚动或打开浮窗；只有上述已载入字段缺失时，悬停才作为补充路径。


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
- 零记录时明确提示：首页时间线和评论区的关系证据可能需要悬停作者后才会由 X 显示。
- Side Panel 与档案库页脚增加反馈入口，打开公开的 GitHub Issues 页面。

## 日本語ストア文案

### 名前

兄貴じゃない — X 関係オブザーバー

### 概要

X に表示された関係の証拠へ注釈を付け、この Chrome プロファイルだけに観察履歴を保存します。

### 詳細説明

兄貴じゃないは、ローカル優先の X 関係オブザーバーです。通常どおり x.com を閲覧している間に、ページ上へすでに表示された関係の証拠へ注釈を付け、観察履歴を現在の Chrome プロファイル内だけに保存します。

相互フォロー、自分だけがフォローしているアカウント、自分をフォローしているアカウント、相手からブロックされたことを示す状況的な証拠、以前の観察からの関係変化を識別できます。相互フォローはそのまま「相互」と表示します。片側のフォロー解除やブロックは具体的なラベルになり、双方ともフォローしていない場合はバッジを出しません。X ページの概要では一つの変化合計として表示します。証拠が足りない場合はラベルを表示せず、記録も保存しません。

Chrome のサイドパネルでは概要を確認できます。関係アーカイブでは、検索、絞り込み、並べ替え、変化の確認、JSON または CSV のエクスポート、JSON バックアップの統合、ローカル記録の削除を行えます。X ページの観察概要は NB フローティングボタンに収納できます。言語、スイッチ、パネル状態などの小さな設定は、有効な Chrome Sync で同期できます。未ログインまたは同期が無効な場合も現在の端末に保存されます。関係アーカイブと現在の X ハンドルは同期しません。

任意のカスタムブラックリストルールで、X ハンドルの完全一致、表示名、投稿内容の文字列／正規表現により投稿を隠せます。ルールごとに有効化と期限を設定できます。ローカル JSON から読み込めるほか、対象サイト権限を明示的に許可した後、公開 HTTPS JSON または公開 Gist を一度だけ取得できます。完全なルール文書はローカルだけに保存され、関係アーカイブとは別です。

兄貴じゃないは、閲覧中の x.com ページに描画済みのアカウント情報と関係のヒントを処理します。カスタム内容ルールを有効にした場合だけ、表示中の投稿本文をローカル照合し、保存や送信はしません。自動スクロール、プロフィール巡回、DM や Cookie の読み取り、X API の呼び出し、フォロー・フォロー解除・ブロック・ミュート操作、開発者への観察データ送信は行いません。X の画面構造が変わると、拡張機能が更新されるまで識別へ影響する場合があります。

兄貴じゃないは独立した拡張機能であり、X Corp. との提携、承認、スポンサー関係はありません。

ソースコードは https://github.com/interjc/chrome-x-not-brother で公開しています。不具合報告とサポートはリポジトリの Issues ページをご利用ください。

### 次回リリースの更新内容

- 小さな設定をユーザーが有効にした Chrome Sync で同期し、関係アーカイブと現在の X ハンドルはローカルに保ちます。旧 local 設定の移行時も、Chrome Sync に既存の設定があれば上書きしません。
- 未同意の場合、収納した NB ボタンの横に目立つ入口を表示し、ツールバーアイコンの右クリックメニューからも完全なプライバシー説明を開けます。入口だけで同意が確定することはありません。

### 0.5.4 更新内容

- 「相手が解除」の判定を厳しくしました。相手が以前あなたをフォローしていて、現在もあなたがフォローしている場合のみ表示します。「おすすめユーザー」カードを解除として記録しなくなりました。

### 0.5.3 更新内容

- ミュートおよび「ブロックされた」投稿の非表示を、投稿詳細とスレッドにも適用します。ホーム・検索・通知だけではありません。

### 0.5.2 更新内容

- ミュートまたはブロックされた投稿を検出次第非表示にします。ローカル一覧にあるアカウントはすぐに消え、初めて検出したアカウントは短いアニメーションで収納されます。

### 0.5.1 更新内容

- サイドパネルを「ステータス」（関係の概要と最近のアカウント）と「オプション」（言語、バッジ、タイムラインフィルター）に分割しました。
- ツールバーアイコンを右クリックして「オプション」を選ぶと、サイドパネルのオプションタブが直接開きます。

### 0.5.0 更新内容

- Chrome のオプションページ（ツールバーアイコンを右クリック → オプション）を追加し、任意のタイムラインフィルターを用意しました。どちらも初期状態ではオフです。
- ミュートしたアカウントを、相互フォローでもホーム・検索・通知から完全に隠せます。プロフィールと投稿詳細は表示されるので、ミュート解除できます。
- 拡張機能がすでに「ブロックされた」と確認したアカウントの投稿を、ホーム・検索・通知から隠せます。全員のリストではありません。
- 同じスイッチはサイドパネルと関係アーカイブにもあります。このブラウザーの表示だけが変わり、ミュート・ブロック・通知は行いません。

### 0.4.10 更新内容

- 投稿詳細では X 本来の表示名と @handle を 1 行にまとめ、関係バッジは次の行に置きます。左のアクセントと名前の間隔は 1–2px です。
- サイドパネルと関係アーカイブのアバターをハンドルから表示し、別アカウントの画像を使いません。
- アーカイブでアバター・表示名・@handle をクリックするとその X プロフィールを開きます。サイドパネルの行も同じです。 

### 0.4.9 更新内容

- サイドパネルと関係アーカイブで表示言語を切り替えられます。初期値はブラウザー言語で、英語・日本語・簡体字中国語を選ぶと X 上の関係バッジと観察ドックも切り替わります。
- 画像ビューア右側のリストをスクロール中に、未確定の会話カードを「ブロックされた」と誤表示しなくなりました。
- 関係バッジを見える @handle の直前に揃え、左右の余白を調整しました。

### 0.4.8 更新内容

- ホームタイムラインの作者を status リンク、アバター、整形済みハンドルから識別し、ローカル確認済みの関係をホバーなしで再表示できます。
- 現在のページの UI ストア、ツイートコンポーネント、およびページが完了済みの GraphQL 応答に既に載っているフォロー関係を読み取り、ホームや返信作者をホバーなしで注釈できます。
- 追加の X リクエスト、自動スクロール、ホバーカードの自動表示は行いません。これらの読み込み済みフィールドがない場合だけ、ホバーを補足手段として使います。


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
- 記録がゼロの場合、ホームや返信スレッドで作者へホバーが必要なことを明確に案内します。
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

The extension uses `chrome.storage.sync` to save small preferences: consent version, observer on/off state, page-badge preference, observer-panel minimized state, UI language, side-panel tab, and optional timeline-filter master switches. Chrome may sync them through the user's enabled Chrome Sync account; when signed out, sync is disabled, or offline, they remain available on the current device. The signed-in X handle and full custom-rule document stay in `chrome.storage.local`; relationship records remain in the extension origin's local IndexedDB. No setting, rule, or observation is sent to the developer.

### `contextMenus`

The extension adds one item to its own toolbar action menu so users who have not completed the current disclosure can find “Review privacy notice and agree.” Selecting it opens the full extension disclosure and does not inspect webpage context menus or record consent automatically. The item is hidden after consent.

### `sidePanel`

The extension uses Chrome's side panel to show the prominent first-run data disclosure, observation controls, local relationship counts, recent observations, and a link to the full local archive.

### Optional host access: `https://*/*`

This is not granted at install. It lets a user explicitly import a rule snapshot from a public HTTPS JSON URL or public Gist. After the user clicks Load, Chrome requests access only to the required source. The extension makes no background subscription, sends no X page or local-rule data to that source, omits credentials, and does not use the permission for remote code. Denial leaves all other features working.

## Privacy practices worksheet

Dashboard 字段可能调整，提交时以实际界面为准。当前代码应按以下方向如实申报：

| Dashboard 类别 | 当前答案 | 说明 |
| --- | --- | --- |
| Personally identifiable information | Yes | X handle、显示名称和头像 URL 可能识别个人。 |
| Website content | Yes | 读取 x.com 已显示的关系提示和账号区域；启用内容规则时在本地即时匹配可见帖子正文但不保存。 |
| Web history / browsing activity | Yes | 保存提供观察出处的当前 x.com 来源 URL。 |
| Authentication information | No | 不读取密码、会话 Cookie 或 token。 |
| Personal communications | No | 不读取私信；公开帖子正文属于上述 Website content，仅在用户启用规则时本地匹配且不保存。 |
| Location, financial, health information | No | 功能不读取这些类别。 |
| Data sale or advertising | No | 不出售数据，也不用于广告、信用或画像。 |
| Data transfer | Chrome preference sync and user-requested public rule fetches only; no developer transfer | 小型偏好可由 Chrome Sync 在用户浏览器间同步；关系观察、完整规则和 `viewerHandle` 留在本地。侧栏/档案库展示头像时浏览器可能请求 unavatar.io/x/{handle}，失败后再请求已保存的 X CDN URL。用户主动按 URL/Gist 导入时，浏览器只向公开来源请求规则文件，不发送 X 或本地数据。 |

## Reviewer notes

可把下面的英语步骤粘贴到审核备注，并按提交版本调整：

1. Install the extension. Its local onboarding page opens automatically, and observation remains disabled.
2. Open the disclosure from the onboarding page, the prominent X-page dock/floating entry, or the toolbar icon's “Review privacy notice and agree” context-menu item; then click “Agree and start local observation.” Opening an entry alone does not consent.
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
- Confirm the permission justifications distinguish small preferences in `chrome.storage.sync`, local-only `viewerHandle`, and IndexedDB relationship records.
- Confirm the public privacy policy URL is the GitHub Pages page `https://interjc.github.io/chrome-x-not-brother/privacy.html` and identifies the developer, contact method, and effective date.
- Confirm Homepage URL is the GitHub repository and Support URL is the Issues page.
- Remove every statement about “no account actions” before submission if the product later gains any X action shortcut, then update consent and privacy review first.
