# Apple 签名与公证密钥配置手册

`.github/workflows/release.yml` 中的 `safari-app` job 做两件事：先用你的 **Developer ID Application 证书**给 Safari App 签名，再用 **App Store Connect API Key** 把 App 提交给 Apple 公证。本手册逐项说明这些材料怎么生成、生成后得到什么文件、要交给 GitHub 的是哪个值。方案背景见 [Safari 支持方案](safari.md)。

整个流程只需做一次。没配置之前，Release 里照样有 Chrome ZIP 和 Safari 临时加载用的文件夹 ZIP，只是没有签名 App。

## 0. 总览：要生成的东西和它们的去向

| # | 材料 | 怎么来 | 文件或形态 | 交给 GitHub 的形式 | 用完是否保留 |
| --- | --- | --- | --- | --- | --- |
| 1 | 证书签名请求（CSR） | 在 Mac 的「钥匙串访问」里生成（第 2.1 节） | `CertificateSigningRequest.certSigningRequest` | 不交给 GitHub，只上传给 Apple | 可以删除 |
| 2 | 私钥 | 生成 CSR 时自动创建，存放在这台 Mac 的登录钥匙串里 | 钥匙串里名为 CSR 常用名称的密钥 | 包含在第 4 项里 | **必须保留**，丢了证书就作废 |
| 3 | Developer ID Application 证书 | 在 Apple Developer 网站用 CSR 签发（第 2.2 节） | `developerID_application.cer` | 包含在第 4 项里 | 可以删除；钥匙串里已有一份 |
| 4 | 证书加私钥的打包文件 | 从钥匙串导出（第 2.3 节） | `DeveloperID.p12` | Secret `MACOS_CERT_P12_BASE64`（base64 文本） | **离线妥善保存** |
| 5 | `.p12` 导出密码 | 导出时你自己设定 | 一段文字 | Secret `MACOS_CERT_PASSWORD` | 存进密码管理器 |
| 6 | Team ID | Apple Developer 网站会员信息页（第 3 节） | 10 位字母数字 | Secret `APPLE_TEAM_ID` | 不是机密，随时可查 |
| 7 | API 私钥 | App Store Connect 生成（第 4 节） | `AuthKey_<KeyID>.p8` | Secret `ASC_KEY_P8_BASE64`（base64 文本） | **离线妥善保存**，只能下载一次 |
| 8 | Key ID | 同上，显示在 Key 列表里 | 10 位字母数字 | Secret `ASC_KEY_ID` | 随时可查 |
| 9 | Issuer ID | 同上，显示在 Key 列表上方 | UUID | Secret `ASC_ISSUER_ID` | 随时可查 |
| 10 | 开关 | 你自己填 | `true` | Variable `SAFARI_SIGNING` | — |
| 11 | Bundle ID（可选） | 你自己定 | 例如 `io.github.interjc.notbrother` | Variable `SAFARI_BUNDLE_ID` | 首次发布后不要再改 |

**不需要**的东西（Apple 后台里看起来相似，别弄混）：

- Developer ID **Installer** 证书：用于给 `.pkg` 安装包签名，本项目发布的是 `.app` 的 zip。
- Apple Distribution、Mac App Distribution 证书：用于上架 App Store。
- App ID 注册和描述文件（Provisioning Profile）：本项目直接用 Developer ID 手动签名，扩展模板不需要受限 entitlements。
- App 专用密码（app-specific password）：公证使用 API Key，不用 Apple 账号密码。

## 1. 前提条件

- 已加入 **Apple Developer Program**，会员状态有效。
- 你是这个开发者账号的 **Account Holder**。只有 Account Holder 能创建 Developer ID 证书，也只有 Account Holder 能首次开通 App Store Connect API。个人账号里你自己就是 Account Holder。
- 一台 Mac。第 2 节默认在 Mac 上完成；没有 Mac 时用第 2.5 节的 OpenSSL 做法。
- **全程使用同一台 Mac**：生成 CSR 时，私钥只存在这台 Mac 的钥匙串里。换一台 Mac 下载 `.cer`，是导不出 `.p12` 的。

## 2. Developer ID Application 证书（得到 `.p12` 和密码）

下面两种做法任选其一。**做法 A（Xcode）**最省事；没装 Xcode 就用**做法 B（钥匙串访问 + 网页）**。两种做法最后都要执行第 2.3 节的导出。

### 2.0 做法 A：用 Xcode 一键创建

1. 打开 Xcode → 菜单 **Xcode → Settings…**（旧版叫 Preferences）→ **Accounts** 标签页。
2. 左下角 **+** → **Apple Account**，登录你的开发者账号。已经登录过就跳过这一步。
3. 在左侧选中账号，右侧选中你的团队（个人账号显示为 “<你的名字> (Personal Team)” 以外的那一项，角色为 Account Holder 或 Admin），点 **Manage Certificates…**。
4. 左下角 **+** → 选 **Developer ID Application**。
5. 列表里出现 “Developer ID Application” 一行即表示成功。Xcode 会自动生成私钥和 CSR、向 Apple 申请证书，并装进登录钥匙串。

然后直接跳到第 2.3 节导出。

### 2.1 做法 B 第一步：生成证书签名请求（CSR）

CSR 是一个文本文件，里面有你的公钥和姓名信息。生成 CSR 的同时，钥匙串会生成一把对应的**私钥**，并留在这台 Mac 上。

1. 打开「钥匙串访问」（Keychain Access）。按 `⌘ 空格` 打开 Spotlight，输入「钥匙串访问」或 “Keychain Access”。较新的 macOS 不再把它放在「应用程序 → 实用工具」，但 Spotlight 能找到；也可以直接打开 `/System/Library/CoreServices/Applications/Keychain Access.app`。
2. 菜单栏 **钥匙串访问 → 证书助理 → 从证书颁发机构请求证书…**（Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority…）。
3. 填写对话框：

| 字段 | 填什么 |
| --- | --- |
| 用户电子邮件地址 | 你的 Apple 开发者账号邮箱 |
| 常用名称 | 方便你认出这把私钥的名字，例如 `Not Brother Developer ID` |
| CA 电子邮件地址 | **留空** |
| 请求是 | 选 **存储到磁盘**（Saved to disk） |

4. 点「继续」，保存到桌面，得到 `CertificateSigningRequest.certSigningRequest`。
5. （可选）确认私钥已经生成：在钥匙串访问左侧选「登录」→ 顶部选「密钥」，能看到一对以你填的常用名称命名的公钥和私钥。

### 2.2 做法 B 第二步：在 Apple Developer 网站签发证书

1. 打开 [Certificates, Identifiers & Profiles → Certificates](https://developer.apple.com/account/resources/certificates/list)，用开发者账号登录。
2. 点标题旁的蓝色 **+**。
3. 在 **Software** 分组里选 **Developer ID Application**（说明是 “This certificate is used to code sign your app for distribution outside of the Mac App Store”），点 **Continue**。
4. **Profile Type** 选 **G2 Sub-CA (Xcode 11.4.1 or later)**，点 **Continue**。
5. **Choose File** 选第 2.1 节的 `.certSigningRequest`，点 **Continue**。
6. 页面显示证书详情后点 **Download**，得到 `developerID_application.cer`。
7. 在 Finder 中双击这个 `.cer`。如果弹出“添加证书”对话框，钥匙串选 **登录**（login），点「添加」。

证书有效期 5 年。Apple 对每个账号能创建的 Developer ID 证书数量有限制，不要反复创建。

### 2.3 导出 `.p12`（两种做法都要做）

`.p12` 是把**证书和私钥打包在一起**并用密码加密的文件。CI 签名时同时需要这两者，所以要导出 `.p12`，单独一个 `.cer` 不够。

1. 打开钥匙串访问，左侧选 **登录**，顶部标签选 **我的证书**（My Certificates）。只有带私钥的证书才会出现在这里。**先清空右上角的搜索框**。
2. 找到 `Developer ID Application: <你的名字> (<10 位 Team ID>)`。证书名称由 Apple 生成，**不是**你在 CSR 里填的常用名称，所以搜 CSR 的名字（例如 “Not Brother”）找不到它。

> **容易混淆**：在 **密钥**（Keys）标签页里，能看到以 CSR 常用名称命名的一对 “public key / private key”，例如 “Not Brother Developer ID”。它们只是第 2.1 节生成的密钥，**不是证书**。从这里导出得到的 `.p12` 只有私钥，CI 会报 `is incomplete … no certificate`。如果「我的证书」里没有 `Developer ID Application: …`，说明证书还没装进钥匙串：到 [Certificates](https://developer.apple.com/account/resources/certificates/list) 点开这张证书，**Download**，双击 `.cer` 装进「登录」钥匙串，它就会出现在「我的证书」里，下面挂着那把私钥。
3. 点左侧的小三角展开，**下面必须挂着一把私钥**。没有私钥说明你不在生成 CSR 的那台 Mac 上，或者选错了条目。
4. 右键点**证书那一行**（菜单里显示“导出 “Developer ID Application: …”…”）。**不要**右键展开后的私钥那一行：那样导出的 `.p12` 里只有私钥，没有证书。
5. 文件格式选 **个人信息交换 (.p12)**，文件名填 `DeveloperID.p12`，保存。
6. 系统要求设置导出密码：设一个强密码，输入两次。**这个密码就是 Secret `MACOS_CERT_PASSWORD` 的值**，请立刻存进密码管理器。
7. 系统可能再弹一次框，要求输入 **Mac 登录密码**，用来授权钥匙串导出私钥。这个密码和上一步设的密码不是同一个。

### 2.4 自检 `.p12`

在「终端」里进入 `.p12` 所在目录，执行下面的命令。它会列出系统里能用来签名的身份：

```bash
security find-identity -v -p codesigning
```

输出里应有一行 `"Developer ID Application: <你的名字> (<TEAMID>)"`。括号里的 10 位字符就是 Team ID，第 3 节会用到。

**上传前务必确认 `.p12` 里同时有私钥和证书。**签名两者缺一不可，而钥匙串很容易只导出其中一个。执行下面两条命令，每次都输入第 2.3 节设置的导出密码。

数私钥，结果应为 `1`：

```bash
openssl pkcs12 -in DeveloperID.p12 -nocerts -nodes | grep -c "BEGIN.*PRIVATE KEY"
```

数证书，结果应为 `1` 或更多：

```bash
openssl pkcs12 -in DeveloperID.p12 -nokeys | grep -c "BEGIN CERTIFICATE"
```

报 `mac verify failure` 说明密码不对。两个数里有一个是 `0`，就对照下表处理：

| 结果 | 原因 | 处理 |
| --- | --- | --- |
| 私钥 `1`，证书 `0` | 导出的是**私钥那一行**：展开证书后，右键了下面的私钥 | 重新导出，右键**证书那一行**；或者按下面的“用 `.cer` 补上证书”处理 |
| 私钥 `0`，证书 `1` | 在「证书」（Certificates）分类里导出的，或者这台 Mac 上根本没有私钥 | 去「我的证书」里导出。「我的证书」里找不到这张证书，或证书下面没有私钥，说明 CSR 是在另一台 Mac 上生成的，或者证书是在别的机器上用 Xcode 创建的：去那台机器导出；找不到那台机器，就按第 2 节重新创建一张证书。旧证书如果从未用来签名分发过，可以在开发者网站撤销，腾出名额 |

**用 `.cer` 补上证书**（适用于“私钥 `1`、证书 `0`”）。不想重新导出时，可以用现有的私钥文件和证书合成一个完整的 `.p12`：

1. 在 [Certificates](https://developer.apple.com/account/resources/certificates/list) 中点开这张 Developer ID Application 证书，点 **Download**，得到 `developerID_application.cer`。随时可以重新下载。
2. 把证书转成 PEM：

```bash
openssl x509 -inform DER -in developerID_application.cer -out developer-id.pem
```

3. 取出私钥（这是未加密的私钥文件，第 5 步会删掉）：

```bash
openssl pkcs12 -in DeveloperID.p12 -nocerts -nodes -out developer-id.key
```

4. 合成新的 `.p12`，并设置导出密码：

```bash
openssl pkcs12 -export -inkey developer-id.key -in developer-id.pem -out DeveloperID-full.p12 -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1
```

5. 删除未加密的私钥文件：

```bash
rm developer-id.key
```

6. 对 `DeveloperID-full.p12` 重新执行上面两条自检命令，然后用它更新 Secret（第 5、6 节）。如果第 4 步设的密码和原来不同，也要更新 `MACOS_CERT_PASSWORD`。

### 2.5 没有 Mac 时：用 OpenSSL 生成

在任意装有 OpenSSL 的电脑上执行。私钥保存在 `developer-id.key` 文件里，请当作机密保管。

生成私钥和 CSR（把邮箱换成你的开发者账号邮箱）：

```bash
openssl req -new -newkey rsa:2048 -nodes -keyout developer-id.key -out developer-id.csr -subj "/emailAddress=you@example.com/CN=Not Brother Developer ID"
```

用 `developer-id.csr` 完成第 2.2 节第 1–6 步，得到 `developerID_application.cer`，然后把它转成 PEM：

```bash
openssl x509 -inform DER -in developerID_application.cer -out developer-id.pem
```

合成 `.p12`。命令会让你设置导出密码，这就是 `MACOS_CERT_PASSWORD`。这里显式指定旧式加密算法，macOS 的 `security import` 才能读取：

```bash
openssl pkcs12 -export -inkey developer-id.key -in developer-id.pem -out DeveloperID.p12 -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1
```

## 3. Team ID

Team ID 是你开发者团队的 10 位标识，签名时用来指定团队。它不是机密。下面任一方式都能拿到：

- 打开 [Apple Developer → Account](https://developer.apple.com/account)，往下找到 **Membership details**，复制 **Team ID** 一栏；
- 第 2.4 节 `security find-identity` 输出中，证书名称括号里的 10 位字符；
- Xcode → Settings → Accounts，选中团队后可以看到。

填入 Secret `APPLE_TEAM_ID`。

## 4. App Store Connect API Key（得到 `.p8`、Key ID、Issuer ID）

`notarytool` 用这把 Key 以你的名义提交公证，不需要 Apple 账号密码和两步验证码。

### 4.1 首次开通 API 访问（只做一次，需要 Account Holder）

1. 打开 [App Store Connect](https://appstoreconnect.apple.com/)，用开发者账号登录。
2. 点顶部的 **用户和访问**（Users and Access）。
3. 点 **集成**（Integrations）标签页，左侧选 **App Store Connect API**。
4. 如果看到 **Request Access**（请求访问）按钮，点它，阅读并勾选同意条款，提交。通常立即生效，刷新页面后就能看到 Key 列表。

### 4.2 生成 Team Key

1. 在同一页面选 **团队密钥**（Team Keys）标签。注意不是 Individual Keys。
2. 点 **生成 API 密钥**（Generate API Key）。如果已有其他 Key，就点列表标题旁的 **+**。
3. 填写：

| 字段 | 填什么 |
| --- | --- |
| 名称（Name） | 便于识别用途，例如 `GitHub Actions notarization` |
| 访问（Access） | **Developer**。公证只需要这个角色；不要给 Admin，权限越小，泄露时的影响越小 |

4. 点 **生成**（Generate）。

### 4.3 下载 `.p8` 并记下两个 ID

1. 新 Key 出现在列表里，行末有 **下载 API 密钥**（Download API Key）链接。点它，确认提示，得到 `AuthKey_XXXXXXXXXX.p8`，文件名中的 `XXXXXXXXXX` 就是 Key ID。
   - **`.p8` 只能下载一次**。下载后链接会消失，丢了只能撤销这把 Key 再重建。
   - 用文本编辑器打开，内容应以 `-----BEGIN PRIVATE KEY-----` 开头。
2. **Key ID**：列表中这把 Key 的 “密钥 ID / Key ID” 列，10 位字符。填入 `ASC_KEY_ID`。
3. **Issuer ID**：列表上方的 “Issuer ID”，格式像 `57246542-96fe-1a63-e053-0824d011072a`，旁边有「复制」按钮。整个团队共用一个 Issuer ID。填入 `ASC_ISSUER_ID`。

## 5. 转成 base64

GitHub Secrets 只能保存文本，所以两个二进制或多行文件要先转成单行 base64 文本，workflow 运行时再还原。macOS 自带的 `base64` 默认输出一整行，不会折行。

在 `.p12` 所在目录执行，结果复制到剪贴板，用于 `MACOS_CERT_P12_BASE64`：

```bash
base64 -i DeveloperID.p12 | pbcopy
```

`.p8` 同理，用于 `ASC_KEY_P8_BASE64`（文件名换成你的）：

```bash
base64 -i AuthKey_XXXXXXXXXX.p8 | pbcopy
```

想确认 base64 没有被截断，可以解码后和原文件比较。没有输出就表示完全一致：

```bash
base64 -i DeveloperID.p12 | base64 -D | cmp - DeveloperID.p12
```

## 6. 存进 GitHub

### 6.1 Secrets

1. 打开仓库页面 → **Settings** → 左侧 **Secrets and variables** → **Actions**。
2. 在 **Secrets** 标签页的 **Repository secrets** 区域，点 **New repository secret**。
3. **Name** 填下表中的名称（大小写必须一致），**Secret** 粘贴对应的值，点 **Add secret**。六个都按这个方法添加：

| Name | Secret 的值 | 来自 |
| --- | --- | --- |
| `MACOS_CERT_P12_BASE64` | `DeveloperID.p12` 的 base64 | 第 5 节 |
| `MACOS_CERT_PASSWORD` | 导出 `.p12` 时设的密码 | 第 2.3 节第 6 步 |
| `APPLE_TEAM_ID` | 10 位 Team ID | 第 3 节 |
| `ASC_KEY_ID` | 10 位 Key ID | 第 4.3 节 |
| `ASC_ISSUER_ID` | Issuer ID（UUID） | 第 4.3 节 |
| `ASC_KEY_P8_BASE64` | `AuthKey_….p8` 的 base64 | 第 5 节 |

粘贴时注意不要带上前后空格或换行。Secret 保存后无法查看，只能覆盖；不确定是否填对，就重新粘贴一次。

装了 GitHub CLI 的话，也可以不经剪贴板直接写入：

```bash
base64 -i DeveloperID.p12 | gh secret set MACOS_CERT_P12_BASE64 -R interjc/chrome-x-not-brother
```

```bash
base64 -i AuthKey_XXXXXXXXXX.p8 | gh secret set ASC_KEY_P8_BASE64 -R interjc/chrome-x-not-brother
```

### 6.2 Variables

同一页面切到 **Variables** 标签页，点 **New repository variable**：

| Name | Value | 说明 |
| --- | --- | --- |
| `SAFARI_SIGNING` | `true` | 打开签名 job。改成其他值即可暂停，Release 仍会正常生成 |
| `SAFARI_BUNDLE_ID` | 可选，默认 `io.github.interjc.notbrother` | App 的唯一标识，使用反向域名格式。**首次发布后不要再改**，否则用户那边会出现两个不同的 App，数据也不会跟着迁移 |

Variables 是明文，只放不敏感的值。

### 6.3 清理本地文件

- `DeveloperID.p12` 和 `AuthKey_….p8`：放进加密的离线位置，例如密码管理器的附件，或加密磁盘映像。之后证书续期、换 CI 时还会用到。
- `.certSigningRequest`、`.cer`、`.pem`、base64 中间文件：可以删除。
- 这些文件和它们的 base64 **不要**提交进仓库，也不要贴进 Issue 或聊天。

## 7. 验证

1. 打开仓库的 **Actions → Release → Run workflow**，分支选 `main`。
   - 当前版本还没有 Release 时，保持 `safari_only` 不勾选：会创建 Release，并在之后附上签名 App。
   - 当前版本已经有 Release 时，勾选 `safari_only`：只重新生成签名 App，并覆盖 Release 里的同名附件。
2. 等 `safari-app` job 变绿（公证通常需要几分钟），在 Release 页面下载 `Not-Brother-Safari-<version>.zip`。
3. 在 Mac 上解压，确认 Gatekeeper 认可这个 App：

```bash
spctl --assess --type execute --verbose=2 "Not Brother.app"
```

输出里应包含 `accepted` 和 `source=Notarized Developer ID`。之后按 [README.en.md 的 Safari 一节](../README.en.md#safari) 安装测试。

## 8. 常见失败

| 失败的步骤和现象 | 原因与处理 |
| --- | --- |
| “Import the Developer ID certificate” 报错 `MACOS_CERT_P12_BASE64 is incomplete`，日志显示 `Secret .p12 holds 1 private key(s) and 0 certificate(s)`（结构里只有 `Shrouded Keybag`，没有 `Certificate bag`） | 导出的是私钥那一行，`.p12` 里没有证书。按第 2.4 节的表格处理：重新导出证书那一行，或者用 `.cer` 补上证书 |
| 同一步报 `is incomplete`，日志显示 `0 private key(s)` | `.p12` 里只有证书。先比对日志里的 `Secret .p12 sha256` 和本地 `shasum -a 256 DeveloperID.p12`：不一致，说明 Secret 里存的是另一个文件，用第 6.1 节的 `gh secret set` 从正确的文件重新写入；一致，就按第 2.4 节处理 |
| 旧版 workflow 报 `security: SecItemCopyMatching: The specified item could not be found in the keychain.` | 没有得到完整的签名身份：`.p12` 缺私钥或缺证书，或者私钥的加密格式 macOS 读不了。（旧版日志里的 `1 certificate imported.` 是 Apple 中间证书的导入结果，不能说明 `.p12` 的内容。）现在的 workflow 会逐项检查并报出具体原因；格式问题会先用 OpenSSL 重新打包成 3DES/SHA1，自动修正 |
| “Import the Developer ID certificate” 报错 `Could not read MACOS_CERT_P12_BASE64`，或 `security import` 报 MAC 校验失败或密码错误 | `MACOS_CERT_PASSWORD` 与导出密码不一致；或者 `.p12` 是用 OpenSSL 3 默认算法生成的，按第 2.5 节的参数重新生成 |
| 同一步报 `No valid Developer ID Application identity`，但日志显示 `1 identity imported.` | 证书不是 Developer ID Application（例如误建成 Apple Development 或 Developer ID Installer），或者证书已被撤销或过期。到开发者网站核对证书类型和状态 |
| `security import` 报格式错误 | base64 粘贴不完整或混入了空格、换行。按第 5 节的 `cmp` 自检后重新粘贴 |
| “Archive with Developer ID signing” 报找不到签名身份或团队不匹配 | `APPLE_TEAM_ID` 和证书括号里的 Team ID 不一致 |
| “Archive” 报 `Embedded binary's bundle identifier is not prefixed with the parent app's bundle identifier` | 打包器为 App 和扩展生成了不一致的 Bundle ID。当前 workflow 在 “Generate the Safari app project” 一步会统一成 `SAFARI_BUNDLE_ID` 和 `SAFARI_BUNDLE_ID.Extension`；如果仍然出现，看这一步日志里的 “Packager bundle IDs” 和 “Pinned bundle IDs” |
| “Archive” 报其他签名设置冲突 | Apple 打包器生成的工程模板变了。看日志里的目标名和设置项，调整 workflow 中 `xcodebuild archive` 的参数 |
| “Notarize and staple” 报 401 或鉴权失败 | `ASC_KEY_ID`、`ASC_ISSUER_ID`、`.p8` 三者不是同一把 Key，或者这把 Key 已被撤销 |
| 公证状态为 `Invalid` | job 会打印 `notarytool log`。常见原因是缺少 hardened runtime 或安全时间戳，workflow 已经设置了这两项；把日志发 Issue 或交给维护者处理 |

修好之后，用第 7 节的方式勾选 `safari_only` 重跑。

## 9. 续期、轮换与泄露处理

| 情况 | 做法 |
| --- | --- |
| 证书将满 5 年 | 重做第 2 节，生成新的 `.p12`，更新 `MACOS_CERT_P12_BASE64` 和 `MACOS_CERT_PASSWORD`。旧版本 App 带有时间戳签名，证书过期后仍能打开 |
| `.p12` 丢了，但原来那台 Mac 的钥匙串里还有证书和私钥 | 重做第 2.3 节导出即可 |
| 私钥彻底丢失 | 只能重做第 2 节创建新证书 |
| `.p12` 或密码泄露 | 在 [Certificates](https://developer.apple.com/account/resources/certificates/list) 中撤销（Revoke）这张证书，然后重新签发并发布新版本。撤销可能导致已分发的 App 无法再打开，所以只在确实泄露时撤销 |
| `.p8` 丢失或泄露 | 在 App Store Connect 的 Team Keys 中撤销（Revoke）这把 Key，按第 4.2–4.3 节新建，更新 `ASC_KEY_ID` 和 `ASC_KEY_P8_BASE64`（Issuer ID 不变） |
| 暂时不想发签名 App | 把 Variable `SAFARI_SIGNING` 改成 `false` |
