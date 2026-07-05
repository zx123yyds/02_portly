# macOS 未知开发者提示处理方式

本文档面向 Portly 用户，说明在当前构建未完成 Apple Developer ID 签名和公证时，如何临时处理 macOS 的“无法验证开发者”或“来自未知开发者”提示。

这不是正式发布侧方案。正式消除提示需要开发者完成 Developer ID 签名、公证和 staple，见 `docs/macos-signing-notarization.md`。

## 推荐优先级

优先使用影响范围最小、最符合 macOS 正常使用习惯的方式。

## 1. 右键打开

这是最推荐的用户侧方案，影响范围只限当前 App。

操作：

1. 打开 Finder。
2. 进入 `Applications`。
3. 右键点击 `Portly.app`。
4. 选择“打开”。
5. 在弹窗中再次点击“打开”。

适用场景：

- App 未公证，但 bundle 结构完整。
- 用户希望用图形界面完成放行。

## 2. 系统设置中仍要打开

如果右键打开仍被拦截，可进入：

```text
系统设置 > 隐私与安全性
```

在页面底部找到 Portly 的拦截提示，点击“仍要打开”。

适用场景：

- 用户双击或右键打开后，系统已经记录了本次拦截。
- 用户不想使用终端命令。

## 3. 移除 Portly 自身 quarantine 属性

如果前两种方式不生效，可以只移除 Portly 自身的 quarantine 属性：

```bash
xattr -dr com.apple.quarantine /Applications/Portly.app
```

这个命令只作用于 `/Applications/Portly.app`，影响范围可控。

适用场景：

- 用户可以接受使用终端。
- App 是可信来源下载的。
- 图形界面的“打开”或“仍要打开”不可用。

## 不推荐：spctl --master-disable

不建议让普通用户执行：

```bash
sudo spctl --master-disable
```

原因：

- 它会开启“任何来源”。
- 影响整台 Mac 的 Gatekeeper 安全策略。
- 不是针对 Portly 的单应用放行。
- 用户后续可能忘记恢复安全设置。

如果必须临时使用，也应在完成后恢复：

```bash
sudo spctl --master-enable
```

Portly 的用户安装说明不应把 `spctl --master-disable` 作为推荐方案。
