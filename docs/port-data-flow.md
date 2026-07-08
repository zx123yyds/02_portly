# Portly 端口数据采集与展示规则

本文档沉淀 Portly 当前的数据来源、补全链路、分类优先级和前端展示规则，方便后续调整端口识别逻辑时有统一依据。

## 目标

Portly 是本机 macOS 菜单栏应用，核心目标是快速看到“当前本机正在监听的端口”，并优先把开发相关服务放在最容易处理的位置。

当前设计遵循三条原则：

- 数据必须来自本机实时系统命令，不使用 mock 数据作为真实展示兜底。
- 先保证端口、PID、命令可用，再尽力补充路径、运行时长、CPU 和内存。
- 开发服务优先展示，系统和普通应用端口折叠到“其他端口”。

## 数据来源

### 主采集源：lsof 监听端口

主进程入口是 `electron/portScanner.ts` 的 `scanListeningPorts()`。

当前主命令：

```bash
lsof -nP -iTCP -sTCP:LISTEN
```

含义：

- `-nP`：不解析主机名和服务名，避免 DNS/服务名解析导致变慢或端口被替换成名称。
- `-iTCP`：只看 TCP 连接。
- `-sTCP:LISTEN`：只看正在监听的 TCP 端口。

解析逻辑位于 `src/lib/ports.ts` 的 `parseLsofOutput()`：

- 跳过表头和不完整行。
- 只保留最后一列为 `(LISTEN)` 的记录。
- 从 `NAME` 字段末尾提取端口号。
- 将 `::1:port` 归一为 `localhost:port`。
- 生成稳定 id：`pid:port:protocol`。
- 同一个 `pid:port:protocol` 只保留一条。

### 进程详情补全：ps

端口初步解析后，`hydrateProcessDetails()` 会按唯一 PID 批量补充进程信息。

当前命令：

```bash
ps -p <pid1,pid2,...> -o pid=,etime=,%mem=,%cpu=,comm=,args=
```

补充字段：

- `uptime`：由 `etime` 格式化为 `Xh Ymin` 或 `Ymin`。
- `mem`：内存百分比。
- `cpu`：CPU 百分比。
- `args`：用于辅助推断项目名。
- `command`：只作为辅助来源，优先级低于 `lsof` 返回的命令名。

### 路径补全：cwd / args

每个 PID 还会尝试读取当前工作目录：

```bash
lsof -a -p <pid> -d cwd -Fn
```

原始 cwd 成功时用于：

- 读取该目录下的 `package.json`。
- 推断 generic 命令对应的项目名。

cwd 不一定总是用户理解里的“项目目录”。Electron/Chromium Helper 类进程经常返回 `/`，这只表示该子进程的当前工作目录，不代表安装路径、数据路径或项目路径。

因此 Portly 会通过 `displayPathFromContext()` 得到最终展示路径。展示路径会区分开发命令和 GUI App：

开发命令优先级：

1. cwd 是有效目录且不是 `/` / `未知` 时，使用 cwd。
2. cwd 不可用时，从 `ps args` 中提取 `/Applications/*.app`。
3. 如果没有 `.app` 路径，从 `ps args` 中读取 `--user-data-dir=...`。
4. 仍不可用时保留原 cwd 或 `未知`。

GUI App / 非通用开发命令优先级：

1. `ps args` 中存在 `/Applications/*.app` 时，使用 `.app` 路径。
2. 否则 cwd 是有效目录且不是 `/` / `未知` 时，使用 cwd。
3. 如果没有有效 cwd，从 `ps args` 中读取 `--user-data-dir=...`。
4. 仍不可用时保留原 cwd 或 `未知`。

最终展示路径用于：

- 展开详情里的“路径”字段。
- 参与项目名推断。
- “终端”按钮打开到对应路径。

失败时返回 `未知`，不会中断整次扫描。

### 项目名补全：package.json / cwd / args

项目名推断在 `inferProjectNameFromContext()`：

优先级如下：

1. 如果工作目录下存在 `package.json` 且有 `name` 字段，使用 `package.json.name`。
2. 如果命令是通用开发命令，并且 cwd 有有效目录名，使用 cwd 最后一段目录名。
3. 如果命令是通用开发命令，并且 args 中能提取出有意义路径，使用路径 basename。
4. 否则使用命令名。
5. 都不可用时显示 `Unknown`。

当前 generic 命令包括：

```text
node, npm, pnpm, yarn, bun, deno, python, python3, ruby, n, electron
```

## 错误和兜底策略

### 主扫描失败

如果主 `lsof -nP -iTCP -sTCP:LISTEN` 失败：

- 返回 `ok: false`。
- `ports` 为空。
- `source` 保持为 `lsof`。
- `error` 显示为 `无法读取监听端口：...`。

前端在 `App.tsx` 中展示“无法读取端口”状态。

### 补全失败

`ps`、cwd、args 路径提取、`package.json` 读取失败都不影响主扫描结果。

补全失败时保留初始字段：

- `cwd: 未知`
- `uptime: 刚刚`
- `mem: 未知`
- `cpu: 未知`
- `name/project/command` 尽量使用已知值

### 自动刷新失败

前端刷新控制在 `src/ui/usePortScan.ts`：

- 手动刷新默认显示 loading，且至少保持 `450ms`，避免按钮闪烁。
- 自动刷新每 `5s` 执行一次。
- 自动刷新使用 `preserveOnError: true`，失败时保留上一次成功数据。
- 自动刷新失败不弹 toast，避免打扰。

## 分类优先级

端口分类位于 `src/lib/ports.ts` 的 `classifyPort()`，结果只有两类：

- `dev`：开发服务。
- `other`：其他监听端口。

分类判断顺序：

1. 系统命令命中系统黑名单时，强制归为 `other`。
2. 端口号命中常见开发端口时，归为 `dev`。
3. 命令名命中开发命令模式时，归为 `dev`。
4. 其他全部归为 `other`。

### 系统命令优先排除

系统命令优先级最高，避免系统服务因为端口号或命令模式误入开发服务。

当前系统模式：

```text
mdns, cups, rapportd, controlcenter, airplay, nfsd
```

### 常见开发端口

当前开发端口集合：

```text
3000, 3001, 4200, 4321, 5000, 5173, 5174, 8000, 8080, 8787, 9000
```

### 开发命令模式

当前开发命令模式：

```text
node, vite, next, webpack, bun, deno, python, ruby, rails, go, air, cargo, php
```

## 初始名称和最终显示名

### lsof 初始名称

`parseLsofOutput()` 会先基于 command 和 port 给出初始 `name/project`：

- `node + 5173`：`Vite`
- `node + 3000`：`Next.js`
- `python*`：`Python`
- `ruby*`：`Ruby`
- `postgres*`：`postgres`
- `redis*`：`redis-server`
- 其他：使用 command

### 补全后的名称

补全阶段会用项目名推断结果覆盖 `name` 和 `project`，所以用户最终看到的通常是项目名，而不是泛泛的 `node`。

例如：

- `node` 在 `/path/to/portly` 下运行，且 `package.json.name = portly`，最终显示 `portly`。
- 非 generic 命令如 `WeChat` 通常保留命令名。

### 展示名组合

行内展示由 `src/ui/PortRow.tsx` 的 `displayName()` 决定：

- 如果 `name === project`，只显示一个名称。
- 如果二者不同，显示 `name - project`。

## 展示优先级

前端展示在 `src/ui/App.tsx`：

1. 扫描 loading 时显示“正在读取监听端口”。
2. 扫描失败时显示“无法读取端口”。
3. 没有开发服务且没有搜索时显示“暂无开发服务运行”。
4. 搜索无匹配时显示“没有匹配的端口”。
5. `dev` 端口默认直接显示在主列表。
6. `other` 端口默认折叠在“另有 N 个端口监听中”。

列表排序来自 `parseLsofOutput()`：

1. `dev` 在前。
2. `other` 在后。
3. 同类按端口号从小到大排序。

前端只按 `kind` 分组，不再二次排序。

## 搜索规则

搜索逻辑位于 `src/lib/filterPorts.ts`：

- 搜索词 trim 后转小写。
- 空搜索返回原列表。
- 匹配字段包括：
  - port
  - name
  - project
  - command
  - cwd / 展示路径
  - pid
  - address

搜索同时作用于 `dev` 和 `other`，并保持原有分组。

## 端口操作的数据依据

### 浏览器

“浏览器”按钮打开：

```text
http://localhost:<port>
```

需要注意：Portly 采集到的是 TCP `LISTEN` 端口，不代表该端口一定是可被浏览器访问的 HTTP 服务。

一个端口至少可能处于以下几种状态：

- 可连接，且返回 HTTP 页面：浏览器打开正常，例如常见 dev server。
- 可连接，但不是 HTTP 服务：浏览器可能显示 `ERR_EMPTY_RESPONSE`、空白页或协议错误。
- 仅绑定本机地址：例如 `127.0.0.1:<port>`，只能本机访问，不能说明它在对外提供网络服务。
- 私有协议或内部 IPC：应用会监听端口，但只接受特定客户端或特定协议请求。

因此，“正在监听”和“浏览器可打开”是两个不同判断：

- `lsof -nP -iTCP:<port> -sTCP:LISTEN` 只能证明有进程在监听端口。
- `nc -vz 127.0.0.1 <port>` 只能证明 TCP 能连通。
- `curl -v http://127.0.0.1:<port>/` 才能初步判断该端口是否像 HTTP 服务。

例如 WeChat 的某些端口会显示为：

```text
WeChat ... TCP 127.0.0.1:14023 (LISTEN)
```

但使用 HTTP 探测：

```bash
curl -v --max-time 2 http://127.0.0.1:14023/
```

可能得到：

```text
Empty reply from server
curl: (52) Empty reply from server
```

这与 Chrome 中的 `ERR_EMPTY_RESPONSE` 一致，含义是“端口能连上，但没有返回 HTTP 响应”，不代表 Portly 的采集错误。

当前交互口径是：只有识别为 `dev` 的端口显示“浏览器”入口；识别为 `other` 的非开发端口不显示“浏览器”或“探测”入口，只保留“终端”和“结束”。这样可以避免让用户误以为所有监听端口都能打开网页，同时保持非开发端口的定位和结束能力。

对于同一应用监听多个 `other` 端口的情况，附加端口 chips 仅作为静态信息展示，不提供点击打开或探测行为。

### 终端

“终端”按钮使用补全得到的展示路径。底层字段目前仍为 `cwd`，但它可能来自原始 cwd、`/Applications/*.app` 或 `--user-data-dir`。

如果路径是 `.app`，终端会打开到它所在的目录，例如 `/Applications`。如果路径不存在、为空或不是目录，会返回错误。

### 结束进程

结束进程位于 `electron/processControl.ts`：

1. 校验 PID 和端口合法。
2. 使用 `lsof -nP -a -p <pid> -iTCP -sTCP:LISTEN` 确认该 PID 仍在监听目标端口。
3. 先发送 `SIGTERM`。
4. 等待默认 `200ms`。
5. 如果仍在监听，再发送 `SIGKILL`。

前端在确认结束后会先临时隐藏该行，再静默刷新端口列表。

## 测试和调试入口

### 测试模式

`PORTLY_TEST_SCAN_MODE` 支持：

- `sample`：返回固定的 `5173 / portly` 示例数据。
- `empty`：返回空列表。
- `error`：模拟读取失败。

### 手动扫描脚本

`scripts/scan-ports.mjs` 可用于快速查看原始监听端口：

```bash
node scripts/scan-ports.mjs
```

### 推荐验证命令

```bash
npm run test
npm run build
npm run verify:electron
```

`npm run verify:browser` 覆盖更完整的 UI 流程，但运行时间更长，适合作为阶段性验收。

### Electron 主进程改动验证

Electron 主进程运行入口是 `dist-electron/electron/main.js`，不是直接运行 `electron/*.ts`。

因此改动 `electron/portScanner.ts`、`electron/main.ts`、`electron/preload.ts` 等文件后，必须确保 TypeScript 已重新编译到 `dist-electron`，否则菜单栏应用可能继续运行旧逻辑。

当前 `npm run dev` 的 `dev:electron` 会先执行：

```bash
rm -rf dist-electron && tsc -p tsconfig.electron.json && cp electron-build-package.json dist-electron/package.json
```

验证真实扫描逻辑时，可以直接读取编译产物：

```bash
node - <<'NODE'
const { scanListeningPorts } = require('./dist-electron/electron/portScanner.js');
scanListeningPorts().then((result) => {
  const target = result.ports.find((port) => port.port === 8443);
  console.log(target);
});
NODE
```

如果 UI 文案已变化但数据逻辑没变化，优先检查是否仍在运行旧的 `dist-electron` 产物，必要时执行：

```bash
node scripts/dev-clean.mjs
npm run dev
```

## 后续调整建议

如果后续要优化识别准确率，优先考虑以下入口：

- 新增或调整开发端口：`src/lib/ports.ts` 的 `DEV_PORTS`。
- 新增或调整开发命令：`DEV_COMMAND_PATTERNS`。
- 新增系统服务排除：`SYSTEM_COMMAND_PATTERNS`。
- 调整项目名推断：`electron/portScanner.ts` 的 `inferProjectNameFromContext()`。
- 调整搜索字段：`src/lib/filterPorts.ts` 的 `searchableText()`。
- 调整展示分组和空状态：`src/ui/App.tsx`。
