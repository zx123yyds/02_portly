# macOS 签名与公证分发方案

本文档记录 Portly 从“本地可运行安装包”升级到“面向普通用户顺滑安装”的 macOS 分发方案。

当前 `npm run dist:mac` 可以生成 `.app`、`.zip` 和 `.dmg`，但默认只做 ad-hoc 签名，未做 Apple Developer ID 签名和公证。因此用户第一次打开时可能看到 Gatekeeper 安全提示。

## 目标

正式分发目标：

- 用户下载 `.dmg` 后拖入 Applications。
- 首次打开不再出现“无法验证开发者”一类的阻断式提示。
- `spctl`、`codesign`、`stapler` 验证均通过。

要达到这个体验，需要完成：

1. Developer ID Application 证书签名。
2. 启用 hardened runtime。
3. 提交 Apple Notary Service 公证。
4. 将公证 ticket staple 到 `.dmg`。

## 当前状态

当前脚本：`scripts/package-mac.mjs`

当前签名方式：

```bash
codesign --force --deep --sign - release/Portly.app
```

这里的 `--sign -` 是 ad-hoc 签名。

ad-hoc 签名的作用：

- 避免 App bundle 完全未签名导致 macOS 直接拒绝启动。
- 适合本机开发、调试、临时安装。

ad-hoc 签名不能做到：

- 证明开发者身份。
- 通过 Apple 公证。
- 消除普通用户首次打开时的 Gatekeeper 安全提示。

当前本机检查命令：

```bash
security find-identity -v -p codesigning
```

如果输出类似下面这样，说明还没有可用于正式分发的证书：

```text
0 valid identities found
```

## 必备条件

### Apple Developer Program

需要加入 Apple Developer Program。

### Developer ID Application 证书

需要在 Apple Developer 后台或 Xcode 中创建并安装：

```text
Developer ID Application: <Name> (<TEAMID>)
```

安装后用下面命令确认：

```bash
security find-identity -v -p codesigning
```

期望看到类似：

```text
1) XXXXX "Developer ID Application: Your Name (TEAMID)"
```

### Notary 凭据

推荐使用 `notarytool store-credentials` 将公证凭据保存到 Keychain。

```bash
xcrun notarytool store-credentials "portly-notary" \
  --apple-id "your-apple-id@example.com" \
  --team-id "TEAMID" \
  --password "app-specific-password"
```

说明：

- `--apple-id`：Apple Developer 账号邮箱。
- `--team-id`：Apple Developer Team ID。
- `--password`：Apple ID 的 App 专用密码，不是登录密码。
- `"portly-notary"`：本机 Keychain profile 名称，后续脚本使用它提交公证。

## 推荐脚本模式

建议保留两种打包模式：

### 本地测试模式

不设置任何签名环境变量时：

- 使用 ad-hoc 签名。
- 生成 `.app`、`.zip`、`.dmg`。
- 适合本机测试和快速迭代。

命令：

```bash
npm run dist:mac
```

### 正式分发模式

设置签名和公证环境变量时：

```bash
export APPLE_SIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_NOTARY_PROFILE="portly-notary"
npm run dist:mac
```

脚本应执行：

1. 构建前端和 Electron 主进程。
2. 拷贝 Electron.app 并注入 Portly 资源。
3. 使用 Developer ID 对 `.app` 签名。
4. 生成 `.dmg`。
5. 可选：对 `.dmg` 签名。
6. 提交 `.dmg` 到 Apple 公证。
7. 公证通过后 staple `.dmg`。
8. 验证 `.app`、`.dmg` 和 staple ticket。

## 正式签名命令

替换当前 ad-hoc 签名：

```bash
codesign --force --deep \
  --options runtime \
  --timestamp \
  --sign "$APPLE_SIGN_IDENTITY" \
  release/Portly.app
```

关键参数：

- `--options runtime`：启用 hardened runtime，公证通常需要。
- `--timestamp`：使用 Apple 时间戳服务，Developer ID 分发需要。
- `--deep`：递归签名内部 framework、helper app 等嵌套代码。

签名后验证：

```bash
codesign --verify --deep --strict --verbose=4 release/Portly.app
spctl --assess --type execute --verbose=4 release/Portly.app
```

## DMG 签名

`.dmg` 可以进一步签名：

```bash
codesign --force \
  --timestamp \
  --sign "$APPLE_SIGN_IDENTITY" \
  release/Portly-0.1.0-arm64.dmg
```

验证：

```bash
codesign --verify --verbose=4 release/Portly-0.1.0-arm64.dmg
```

## 提交 Apple 公证

```bash
xcrun notarytool submit release/Portly-0.1.0-arm64.dmg \
  --keychain-profile "$APPLE_NOTARY_PROFILE" \
  --wait
```

成功时会看到 `status: Accepted`。

如果失败，查看日志：

```bash
xcrun notarytool log <submission-id> \
  --keychain-profile "$APPLE_NOTARY_PROFILE"
```

常见失败原因：

- 仍有嵌套二进制未签名。
- 没有启用 hardened runtime。
- 使用了 ad-hoc 或 Apple Development 证书，而不是 Developer ID Application。
- bundle 内存在不符合签名要求的文件或 symlink 被破坏。

## Staple 公证票据

公证通过后，需要把 ticket staple 到 `.dmg`：

```bash
xcrun stapler staple release/Portly-0.1.0-arm64.dmg
```

验证：

```bash
xcrun stapler validate release/Portly-0.1.0-arm64.dmg
```

为什么需要 staple：

- 没有 staple 时，用户首次打开可能需要联网让 Gatekeeper 查询 Apple 服务器。
- staple 后，ticket 随 `.dmg` 分发，离线或网络不稳定时体验更稳。

## 最终验收命令

正式分发前建议执行：

```bash
codesign --verify --deep --strict --verbose=4 release/Portly.app
spctl --assess --type execute --verbose=4 release/Portly.app

codesign --verify --verbose=4 release/Portly-0.1.0-arm64.dmg
spctl --assess --type open --context context:primary-signature --verbose=4 release/Portly-0.1.0-arm64.dmg

xcrun stapler validate release/Portly-0.1.0-arm64.dmg
```

期望：

- `codesign` 不报错。
- `spctl` 输出 accepted。
- `stapler validate` 成功。

## 对 README 的影响

完成 Developer ID 签名和公证后，可以删除或弱化 README 中的提示：

```text
当前构建未做 Apple Developer ID 签名和公证，因此首次打开可能会出现安全提示。
```

替换为：

```text
正式 Release 包已完成 Developer ID 签名和 Apple 公证。若仍遇到安全提示，请确认下载的是 GitHub Releases 中的正式 DMG。
```

## 官方参考

- Apple: Notarizing macOS software before distribution  
  https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
- Apple: Developer ID  
  https://developer.apple.com/developer-id/
- Apple Developer Support: Developer ID  
  https://developer.apple.com/support/developer-id/

## 后续实现建议

下一步可以把 `scripts/package-mac.mjs` 改成环境变量驱动：

- `APPLE_SIGN_IDENTITY` 存在时使用 Developer ID 签名。
- `APPLE_NOTARY_PROFILE` 存在时提交公证并 staple。
- 二者不存在时继续 ad-hoc 签名，保持本地开发体验。
- 打包结束时输出当前包类型：`local ad-hoc` 或 `notarized release`。

这样本地开发和正式分发不会互相干扰。
