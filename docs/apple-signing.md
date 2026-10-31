# Apple 签名与公证密钥配置

`.github/workflows/release.yml` 的 `safari-app` job 会用你的 Developer ID 证书给 Safari App 签名，并用 App Store Connect API Key 提交 Apple 公证。本文说明如何生成这些材料并存进 GitHub。方案背景见 [Safari 支持方案](safari.md)。

只需配置一次。配置之前，Release 里仍然会有 Chrome ZIP 和 Safari 临时加载用的文件夹 ZIP，只是没有签名 App。

## 需要准备的东西

| 材料 | 用途 | 在哪里拿 |
| --- | --- | --- |
| Developer ID Application 证书（`.p12`）和导出密码 | 给 App 与扩展签名 | Apple Developer 网站 + Mac 钥匙串 |
| Team ID | 签名时指定团队 | Apple Developer → Membership |
| App Store Connect API Key（`.p8`）、Key ID、Issuer ID | `notarytool` 提交公证 | App Store Connect → Integrations |

前提：已加入 Apple Developer Program，并且你是账号的 **Account Holder**（只有 Account Holder 能创建 Developer ID 证书）。下面的证书步骤需要一台 Mac；没有 Mac 时见第 1 步末尾的 OpenSSL 做法。

## 1. 创建 Developer ID Application 证书

1. 在 Mac 上打开「钥匙串访问」→ 菜单「钥匙串访问」→「证书助理」→「从证书颁发机构请求证书…」。
   - 用户电子邮件：你的 Apple 账号邮箱；常用名称：例如 `Not Brother Developer ID`；CA 电子邮件留空。
   - 选择「存储到磁盘」，得到 `CertificateSigningRequest.certSigningRequest`。
2. 打开 [Certificates, Identifiers & Profiles → Certificates](https://developer.apple.com/account/resources/certificates/list)，点 **+**。
3. 选择 **Developer ID Application**，Profile Type 选 **G2 Sub-CA**，上传上一步的 CSR，下载 `developerID_application.cer`。
4. 双击 `.cer`，把它安装到「登录」钥匙串。
5. 在钥匙串访问的「我的证书」中找到 `Developer ID Application: <你的名字> (<TEAMID>)`，展开确认下面有私钥。右键 →「导出…」→ 格式选「个人信息交换 (.p12)」，设置一个强密码。这个密码就是 `MACOS_CERT_PASSWORD`。

注意：Developer ID 证书的数量有上限，有效期 5 年。不要反复创建；`.p12` 文件和密码要妥善保存。

**没有 Mac 时**（任意装有 OpenSSL 的机器）：

```bash
openssl req -new -newkey rsa:2048 -nodes -keyout developer-id.key -out developer-id.csr -subj "/emailAddress=you@example.com/CN=Not Brother Developer ID"
```

用 `developer-id.csr` 完成第 2–3 步，然后把下载的 `.cer` 和私钥合成 `.p12`。显式指定旧式加密算法，macOS 的 `security import` 才能读取：

```bash
openssl x509 -inform DER -in developerID_application.cer -out developer-id.pem
```

```bash
openssl pkcs12 -export -inkey developer-id.key -in developer-id.pem -out DeveloperID.p12 -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1
```

## 2. 找到 Team ID

打开 [Apple Developer → Account → Membership details](https://developer.apple.com/account#MembershipDetailsCard)，复制 10 位的 **Team ID**。证书名称括号里的那串字符也是它。

## 3. 创建 App Store Connect API Key

1. 打开 [App Store Connect → Users and Access → Integrations → App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api)。第一次使用时需要先点 **Request Access** 并同意条款。
2. 在 **Team Keys** 标签页点 **+**（或 Generate API Key）。
   - Name：例如 `GitHub Actions notarization`；
   - Access：**Developer**（公证只需要这个角色）。
3. 点 **Download** 下载 `AuthKey_<KEYID>.p8`。**这个文件只能下载一次**，丢了只能撤销后重建。
4. 在同一页记下：
   - **Key ID**：表格里这把 key 的 ID；
   - **Issuer ID**：表格上方的 UUID。

## 4. 存进 GitHub

打开仓库的 **Settings → Secrets and variables → Actions**。

在 **Secrets** 标签页依次点 **New repository secret**：

| 名称 | 值 |
| --- | --- |
| `MACOS_CERT_P12_BASE64` | `.p12` 文件的 base64（见下） |
| `MACOS_CERT_PASSWORD` | 第 1 步设置的导出密码 |
| `APPLE_TEAM_ID` | 第 2 步的 Team ID |
| `ASC_KEY_ID` | 第 3 步的 Key ID |
| `ASC_ISSUER_ID` | 第 3 步的 Issuer ID |
| `ASC_KEY_P8_BASE64` | `.p8` 文件的 base64（见下） |

在 Mac 上把文件转成 base64 并复制到剪贴板：

```bash
base64 -i DeveloperID.p12 | pbcopy
```

```bash
base64 -i AuthKey_XXXXXXXXXX.p8 | pbcopy
```

如果装了 GitHub CLI，也可以不经剪贴板直接写入：

```bash
base64 -i DeveloperID.p12 | gh secret set MACOS_CERT_P12_BASE64 -R interjc/chrome-x-not-brother
```

```bash
base64 -i AuthKey_XXXXXXXXXX.p8 | gh secret set ASC_KEY_P8_BASE64 -R interjc/chrome-x-not-brother
```

然后切到 **Variables** 标签页，点 **New repository variable**：

| 名称 | 值 | 说明 |
| --- | --- | --- |
| `SAFARI_SIGNING` | `true` | 打开签名 job。改成其他值即可暂停 |
| `SAFARI_BUNDLE_ID` | 可选，默认 `io.github.interjc.notbrother` | App 的 Bundle ID，**首次发布后不要再改**，否则用户会看到两个不同的 App |

本方案在打包时直接用 Developer ID 手动签名，不需要在开发者网站上注册 App ID，也不需要描述文件。

## 5. 验证

1. 打开仓库的 **Actions → Release → Run workflow**。
   - 当前版本还没有 Release 时，保持 `safari_only` 不勾选：会创建 Release，并在之后附上签名 App。
   - 当前版本已有 Release 时，勾选 `safari_only`：只重新生成签名 App，并覆盖 Release 里的同名附件。
2. 等 `safari-app` job 变绿（公证通常要几分钟），在 Release 页面下载 `Not-Brother-Safari-<version>.zip`。
3. 在 Mac 上解压，确认 Gatekeeper 认可这个 App：

```bash
spctl --assess --type execute --verbose=2 "Not Brother.app"
```

输出里应包含 `accepted` 和 `source=Notarized Developer ID`。之后按 [README.en.md 的 Safari 一节](../README.en.md#safari) 安装测试。

## 6. 常见失败

| 现象 | 原因与处理 |
| --- | --- |
| `find-identity` 一步找不到 `Developer ID Application` | `.p12` 里没有私钥（导出时选的是证书而不是「我的证书」中的身份），或 base64 粘贴不完整。重新导出 |
| `security import` 报 MAC 校验或密码错误 | 密码不对；或者 `.p12` 由 OpenSSL 3 默认算法生成，按第 1 步的参数重新生成 |
| 公证状态为 `Invalid` | job 会打印 `notarytool log`。常见原因是缺少 hardened runtime 或安全时间戳，workflow 已经设置了这两项；把日志发 Issue 或交给维护者处理 |
| 公证报 401 / 鉴权失败 | Key ID、Issuer ID、`.p8` 三者不匹配，或者 key 已被撤销 |
| `xcodebuild` 报签名设置冲突 | Apple 打包器生成的工程模板变了。看日志里的目标名和设置项，调整 workflow 中的 `xcodebuild archive` 参数 |

## 7. 轮换与泄露处理

- **API Key** 随时可以在 App Store Connect 撤销并重建。重建后更新 `ASC_KEY_ID` 和 `ASC_KEY_P8_BASE64`（Issuer ID 不变）。
- **证书**快到 5 年有效期时，重新做第 1 步并更新 `MACOS_CERT_P12_BASE64` 和 `MACOS_CERT_PASSWORD`。
- `.p12` 或密码**泄露**时，到开发者网站撤销这张证书。撤销可能导致已分发的 App 无法再被打开，所以只在确实泄露时撤销；撤销后重新签发并发布新版本。
- 不要把 `.p12`、`.p8` 或它们的 base64 提交进仓库，也不要贴进 Issue；写入 GitHub 后可以删除本地的 base64 中间文件。
