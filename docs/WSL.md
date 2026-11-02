# 在 WSL2（WSLg）中使用 3PI Desk

本文说明 WSL2 / WSLg 版与常规 Linux 版的区别、安装方式和已知限制。

WSL2 是运行在 Windows 上的 Linux 虚拟机，本身没有桌面环境。**WSLg** 是 Windows 11
（以及安装了商店版 WSL 的 Windows 10 21H2+）自带的图形桥接层：它把 Linux 窗口显示成
Windows 窗口，并处理剪贴板和音频。3PI Desk 是 Electron 桌面应用，因此在 WSL2 中必须依赖
WSLg 才能显示界面。

## 与 Linux 版的关系

| 项目 | Linux 版 | WSL2 版 |
| --- | --- | --- |
| 源码 | 同一份 | 同一份 |
| 可执行文件 | `3pi-desk` | `3pi-desk-wsl` |
| deb 包名 | `claude-desk` | `claude-desk-wsl` |
| 桌面入口 | `3pi-desk.desktop` | `3pi-desk-wsl.desktop` |
| 应用数据 | `~/.config/claude-desk` | 同一个 |
| Claude Code 配置/聊天 | `~/.claude` | 同一个 |

两个 deb 可以装在同一台机器上，但会共享偏好、工作区和聊天记录。这是有意设计的：WSL 的
home 目录本身就和 Windows 的 `C:\Users\<你>` 分开。

WSL 版在运行时检测 `WSL_DISTRO_NAME` / `WSL_INTEROP` 和内核版本，自动关闭系统托盘和全局
快捷键。常规 Linux 版不会进入这些分支。

## 系统要求

- Windows 11，或安装了商店版 WSL 的 Windows 10 21H2+。
- WSL **2**，并启用 WSLg。
- x86_64 或 arm64 的 Linux 发行版；当前发布包以 x64 为主。

在 Windows PowerShell 中检查：

```powershell
wsl --update
wsl --version        # 输出中应包含 WSLg 版本
wsl -l -v            # VERSION 必须是 2
```

在 WSL 中检查：

```bash
echo $DISPLAY          # 例如 :0
echo $WAYLAND_DISPLAY  # 例如 wayland-0
ls /mnt/wslg           # 存在表示 WSLg 正常
```

可以先用一个最小图形程序验证：

```bash
sudo apt update && sudo apt install -y x11-apps
xeyes
```

如果 `xeyes` 不能在 Windows 桌面上弹出窗口，先解决 WSLg，再安装本应用。

## 安装打包版（推荐）

从 Releases 下载 WSL 版的 deb（文件名形如 `3pi-desk-<版本>-wsl-amd64.deb`）：

```bash
sudo apt update
sudo apt install -y ./3pi-desk-*-wsl-*.deb
3pi-desk-wsl
```

deb 会自动安装 Electron 运行所需的库。WSL 版把 `fonts-noto-cjk` 和
`fonts-noto-color-emoji` 作为推荐依赖；如果你的 apt 配置跳过了推荐包，请手动安装：

```bash
sudo apt install -y fonts-noto-cjk fonts-noto-color-emoji
```

AppImage 也可以使用，但 WSL 通常需要先安装 FUSE：

```bash
# Ubuntu 24.04
sudo apt install -y libfuse2t64
# Ubuntu 22.04
sudo apt install -y libfuse2

chmod +x 3pi-desk-*-wsl-*.AppImage
./3pi-desk-*-wsl-*.AppImage
```

如果 AppImage 仍无法启动，可以用解包模式：

```bash
./3pi-desk-*-wsl-*.AppImage --appimage-extract-and-run
```

## 从源码构建

不要把项目放在 `/mnt/c/...`。Windows 挂载盘没有可靠的 Unix 权限和可执行位，构建出的
`claude` 二进制可能无法执行，文件监听也会很慢。请放在 WSL 的 ext4 家目录：

```bash
sudo apt update
sudo apt install -y git curl build-essential \
  libnss3 libgtk-3-0t64 libgbm1 libasound2t64 libxss1 \
  libxkbcommon0 libdrm2 libxcomposite1 libxdamage1 \
  libxrandr2 libxfixes3 libcups2t64

# Node.js 24+（Ubuntu 自带的版本太旧）
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v

mkdir -p ~/apps && cd ~/apps
git clone https://github.com/BA4RNJ/3pi-desk-for-claude-code.git
cd 3pi-desk-for-claude-code
npm ci                 # 不要加 --omit=optional，否则缺少 claude 二进制
npm run package:wsl    # 输出 release-wsl/linux-unpacked/3pi-desk-wsl
./release-wsl/linux-unpacked/3pi-desk-wsl
```

需要 AppImage 和 deb 时：

```bash
npm run dist:wsl       # release-wsl/*.AppImage, release-wsl/*.deb
```

常规 Linux 构建仍使用 `npm run package` / `npm run dist`，输出在 `release/`，互不影响。

### sandbox 报错

如果启动时报 `SUID sandbox helper`：

```bash
sudo chown root:root /opt/3PI\ Desk\ for\ Claude\ Code\ WSL/chrome-sandbox
sudo chmod 4755 /opt/3PI\ Desk\ for\ Claude\ Code\ WSL/chrome-sandbox
```

源码模式对应 `node_modules/electron/dist/chrome-sandbox` 和
`release-wsl/linux-unpacked/chrome-sandbox`。最后手段才是加 `--no-sandbox`，它会降低安全性。

## 首次配置 API

WSL 的 home 与 Windows 的 `C:\Users\<你>` **不是同一个目录**。Windows 上已有的 Claude Code
配置不会自动出现在 WSL 里。

推荐在应用内打开 **设置 → API**，填写 Base URL、Token 和模型，先 **测试连接** 再保存。面板会
写入 WSL 内的 `~/.claude/settings.json`。

也可以只复制 Windows 上的 API 配置：

```bash
mkdir -p ~/.claude
cp "/mnt/c/Users/<Windows用户名>/.claude/settings.json" ~/.claude/settings.json
chmod 600 ~/.claude/settings.json
```

不要直接复制 `~/.claude/projects/`：聊天记录里的路径是 Windows 路径，在 WSL 中无法正确对应。

数据位置：

| 内容 | 路径 |
| --- | --- |
| 面板偏好、工作区、API 档案 | `~/.config/claude-desk/settings.json` |
| 删除聊天前的备份 | `~/.config/claude-desk/session-backups/` |
| Claude Code 配置 | `~/.claude/settings.json` |
| 聊天记录 | `~/.claude/projects/**` |

从 Windows 访问 WSL 文件：`\\wsl.localhost\<发行版名>\home\<用户>\`。

## 已知限制

- **没有系统托盘**：WSLg 只有轻量合成器，没有托盘宿主。WSL 版会跳过托盘创建，关闭窗口即
  退出；设置里的“关闭到托盘”在 WSL 中禁用。
- **没有跨 Windows 的全局快捷键**：快捷键只能到达 WSLg 内部的 X/Wayland 服务，Windows
  前台应用无法触发。WSL 版会跳过注册。
- **通知可能不显示**：WSLg 默认没有 `org.freedesktop.Notifications` 服务。应用在窗口失焦
  时会尝试闪烁 Windows 任务栏。
- **输入法受限**：Windows 输入法不一定能直接输入到 WSLg 窗口。若中文输入异常，在 WSL 内
  安装并配置 fcitx5，或先在 Windows 记事本中写好再粘贴。
- **跨 Windows 拖拽不可靠**：附件请用输入框的添加文件按钮或文件选择器；文件路径通过
  `/mnt/c/...` 访问 Windows 盘。
- **GPU 为软件/virtual GPU**：项目已关闭硬件加速，界面会以软件渲染运行。
- **缩放**：如果窗口过大或过小，可尝试
  `3pi-desk-wsl --force-device-scale-factor=1.25`。
- **Wayland 细节**：WSLg 默认通过 XWayland 显示 X11 窗口；不要强制
  `--ozone-platform=wayland`，目前没有额外收益。

## 代理与网络

WSL2 默认使用 NAT，不继承 Windows 的代理设置。若 Windows 代理监听 `127.0.0.1`，WSL 内
不能直接使用。先取 Windows 主机地址：

```bash
ip route show default | awk '{print $3}'
export HTTPS_PROXY="http://<主机IP>:<端口>"
export HTTP_PROXY="$HTTPS_PROXY"
3pi-desk-wsl
```

Windows 11 22H2+ 也可以在 `C:\Users\<你>\.wslconfig` 中启用镜像网络，让 `127.0.0.1` 可达：

```ini
[wsl2]
networkingMode=mirrored
```

修改后执行 `wsl --shutdown` 再重新进入。代理软件如果使用 TUN/透明代理，需要确认它允许
WSL 虚拟网卡访问。

## 故障排查

| 现象 | 处理 |
| --- | --- |
| `Missing X server or $DISPLAY` | WSLg 未启用。运行 `wsl --update`，确认 Windows 版本和 WSL2 |
| 窗口空白或崩溃 | 确认 `$DISPLAY` 非空；项目已关闭 GPU 加速，仍异常可试 `--ozone-platform=x11` |
| 界面中文显示为方框 | `sudo apt install fonts-noto-cjk fonts-noto-color-emoji` |
| 点击链接没有反应 | 安装 `wslu` 后重试；应用会优先用 `explorer.exe` 交给 Windows 默认浏览器 |
| 打开文件没有反应 | 应用会通过 `wslpath -w` 转成 Windows 路径交给 `explorer.exe` |
| `spawn ... EACCES` / `ENOEXEC` | 项目或二进制位于 `/mnt/c`，或缺少可执行位；移到 WSL ext4 后重新 `npm ci` |
| AppImage 无法启动 | 安装 `libfuse2t64`（24.04）或 `libfuse2`（22.04），或使用 `--appimage-extract-and-run` |
| 关闭窗口后进程仍在 | 这是没有托盘时的旧问题；WSL 版已修复，请使用 `3pi-desk-wsl` |

## 卸载

```bash
sudo apt remove claude-desk-wsl
# 可选：删除面板数据（不会删除 ~/.claude）
rm -rf ~/.config/claude-desk
```

**不要**删除 `~/.claude/`，除非你确定要删除 Claude Code 的配置和全部聊天记录。

## 验证清单

- [ ] `xeyes` 能在 Windows 桌面显示，说明 WSLg 正常。
- [ ] `3pi-desk-wsl` 能启动，设置 → 关于显示内置 Claude Code 版本。
- [ ] 设置 → API 显示 Base URL、模型和掩码 Token，测试连接成功。
- [ ] 发送一条消息能收到流式回复。
- [ ] 中文和 emoji 正常显示。
- [ ] 关闭窗口后进程退出，不残留无窗口进程。
- [ ] 从开始菜单和终端重复启动只有一个窗口。
- [ ] 删除聊天后 `~/.config/claude-desk/session-backups/` 出现备份。
