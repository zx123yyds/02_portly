# Portly 安装包体积说明

本文档解释 Portly 的 `.dmg` 为什么仍然有 100MB 级别，以及 `Electron Framework` 在包体积中的角色。

## 当前体积

基于当前 `npm run dist:mac` 生成的 Apple Silicon 构建：

```text
release/Portly-0.1.0-arm64.dmg        109M
release/Portly.app                    227M
Portly.app/Contents/Frameworks        226M
Portly.app/Contents/Resources/app     336K
```

结论：

- Portly 自己的业务代码、React 页面、端口扫描逻辑和资源只有几百 KB。
- 体积主要来自 Electron 自带运行时，而不是项目源码、`node_modules` 或旧 release 被误打包。

## Electron Framework 是什么

`Electron Framework` 位于：

```text
Portly.app/Contents/Frameworks/Electron Framework.framework
```

它是 Electron 应用随包携带的桌面运行时，主要包含：

- Chromium：渲染 HTML、CSS 和 React 界面。
- V8：执行 JavaScript。
- Node.js：支持主进程调用系统命令、进程、文件和 IPC 能力。
- Electron bridge：连接主进程和渲染进程。
- macOS 原生封装、GPU、网络、崩溃处理和国际化资源。

Portly 虽然是一个菜单栏小工具，但只要使用 Electron，就需要携带这套运行时。用户安装后不需要额外安装 Electron，因为运行时已经内置在 `.app` 中。

## 为什么 Menu Bar App 仍然偏大

Portly 的 UI 很小，但 Electron 的成本是固定的：

```text
Portly 业务代码：菜单栏逻辑、React UI、端口扫描
Electron Framework：内置浏览器 + Node 运行时 + 桌面 App 壳
```

因此，一个简单菜单栏 App 和一个复杂 Electron App 都会携带相近规模的 Electron 基础运行时。

常见体积感知：

- Swift / AppKit 原生：通常可以做到几 MB 到十几 MB。
- Tauri：复用系统 WebView，通常明显小于 Electron。
- Electron：自带 Chromium，`.dmg` 80MB 到 150MB+ 都很常见。

## 已做的瘦身

当前打包脚本 `scripts/package-mac.mjs` 已做以下清理：

1. 移除 Electron 默认 `default_app.asar`。
2. 移除默认 `electron.icns`，保留 Portly 自己的 `icon.icns`。
3. 移除编译产物里的 `*.test.js`。
4. Electron locale 只保留：
   - `en.lproj`
   - `en_GB.lproj`
   - `zh_CN.lproj`
   - `zh_TW.lproj`

优化前后对比：

```text
DMG:        125M -> 109M
Portly.app: 273M -> 227M
```

这类清理能减少一部分资源文件，但不会改变 Electron Framework 的核心体积。

## 后续选择

如果目标是继续压缩几 MB，可以继续谨慎评估 Electron 资源文件，但收益有限且可能影响运行时稳定性。

如果目标是把安装包降到十几 MB 或更低，需要考虑架构迁移：

- Tauri：保留 Web 前端体验，使用系统 WebView 和 Rust 后端。
- Swift / AppKit：最贴近 macOS 菜单栏应用形态，包体和系统集成最好，但需要重写 UI 和主进程逻辑。

当前阶段继续使用 Electron 的优势是开发速度快、React 迭代顺滑、现有代码复用度高；代价是安装包天然偏大。
