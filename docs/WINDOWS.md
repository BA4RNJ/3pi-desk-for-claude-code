# Windows 构建（Electron）

3PI Desk 现在提供 Windows 原生 Electron 构建，不依赖 WSL/WSLg。它与 Linux/macOS 共用同一套
渲染层和主进程业务代码，并补齐了 Windows 路径、CLI 发现、托盘/通知和 NSIS 安装包。

这是 **Windows 桌面程序**，不是 WinUI 3 原生控件界面；需要真正的原生控件前端时，可复用
`packages/agent-bridge` 另做前端，见 [`MACOS-NATIVE.md`](MACOS-NATIVE.md) 的架构说明。

## 构建

要求：Windows 10/11 x64、Node 24+、Git for Windows（Claude Code 的 Bash 工具需要 Git Bash）。

```powershell
npm ci
npm run package:win   # release/win-unpacked/3pi-desk.exe
npm run dist:win      # release/3pi-desk-<version>-windows-x64.exe
```

安装包未签名，Windows SmartScreen 会提示；选择“更多信息 → 仍要运行”。

### 在 Linux 上交叉构建

Linux 上可以完成代码、测试和 Windows 安装包构建。需要 wine（本仓库验证过 wine 11）：

```bash
# 一次性下载 Windows Electron 运行时（版本与 devDependencies 的 electron 一致）
curl -fL -o .cache/electron-win.zip \
  https://github.com/electron/electron/releases/download/v45.2.1/electron-v45.2.1-win32-x64.zip
unzip -q .cache/electron-win.zip -d .cache/electron-win

npx electron-builder --win nsis --publish never \
  -c.electronDist=.cache/electron-win
```

产物在 `release/`。Linux 本机不能运行 Windows GUI；用 Windows 真机或 CI 的
`verify-windows` job 做最终验证。

## CI

`.github/workflows/ci.yml` 的 `verify-windows` job 在 `windows-latest` 上执行：

- `npm ci`、`npm run typecheck`、`npm run test:ci`、`electron-vite build`
- `electron-builder --win nsis --publish never`
- `node scripts/windows-smoke.mjs`：用 Playwright 启动打包后的 exe，检查 renderer 非空并截图
- 上传安装包和 `windows-smoke.png`

冒烟测试不启动会话、不调用模型、不消耗 API 额度。它不能替代真实 Windows 桌面上的托盘、
通知、文件对话框、IME、SmartScreen 和安装/卸载验证。

## 数据目录

- 应用偏好/备份：`%APPDATA%\claude-desk\`（与 Electron 的 `app.getPath('userData')` 一致）
- Claude 配置/聊天记录：`%USERPROFILE%\.claude\`（可用 `CLAUDE_CONFIG_DIR` 覆盖）
- CLI 下载缓存：`%APPDATA%\claude-desk\claude-cli\<version>\claude.exe`
- 会话删除备份：`%APPDATA%\claude-desk\session-backups\`

原生 bridge（`packages/agent-bridge/native-platform.ts`）在 Windows 上也默认使用
`%APPDATA%\claude-desk`，因此后续原生前端可以和 Electron 版共用偏好与备份。

## CLI 发现

顺序：`CLAUDE_CODE_EXECUTABLE` → 设置中的路径 → 随包/下载的 `claude.exe` → 官方安装器
`%USERPROFILE%\.local\bin\claude.exe` → PATH 中的 `claude.exe`。

Windows 上必须使用 `claude.exe`。npm 全局安装的 `claude.cmd` 是批处理 shim，Agent SDK 直接
spawn 二进制时不支持它；如果本机只有 npm 安装，请在设置 → 常规中下载 CLI，或使用官方
Windows 安装器。

Bash 工具需要 Git for Windows；如果 Git Bash 不在默认位置，可设置
`CLAUDE_CODE_GIT_BASH_PATH` 指向 `bash.exe`。

## 已知限制

- 安装包未签名，首次运行会触发 SmartScreen。
- 当前 Windows 构建运行 Windows 版 Claude Code，工作区使用 Windows 路径。WSL 工作区
  （`\\wsl$\...`）尚未作为一等场景验证。
- `electron-builder.offline.yml` 暂未添加 Windows target；需要离线部署时，先按 Linux 的方式
  扩展配置，并把 `claude-agent-sdk-win32-x64` 打进 `app.asar.unpacked`。
- 未做自动更新、代码签名和 Windows ARM64 CI。`win32-arm64` 的 SDK 包存在，但尚未验证。
- 首次运行下载 CLI 需要网络（约 180 MB 压缩包）。

## 验证清单

- `npm run typecheck`
- `npm run test:ci`
- `npm run package:win` / `npm run dist:win`
- 在 Windows 上安装并启动，确认窗口、托盘、通知、关闭到托盘
- 设置 → 常规：检测/下载 CLI；确认路径以 `claude.exe` 结尾
- 设置 → API：切换供应商、测试连接、保存
- 在临时工作区发送一条消息，确认流式输出和内联权限卡
- 文件面板、Git 面板、会话复制/移动、删除备份
- 在 `%APPDATA%\claude-desk\session-backups\` 确认删除前生成了备份
