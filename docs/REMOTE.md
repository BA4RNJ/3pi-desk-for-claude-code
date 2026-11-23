# 手机 / 远程访问（LAN + Cloudflare Tunnel）

3PI Desk 可以把桌面端完整界面提供给手机浏览器，会话、标签页、权限审批和中断都在同一个
主进程里，因此两端实时同步。

> 远程访问等同于在这台电脑上执行 Claude Code 工具。请使用强密码，公网访问建议使用
> Cloudflare Tunnel，并尽量叠加 Cloudflare Access。

## 1. 局域网访问

1. 电脑端打开 **设置 → 远程访问**。
2. 勾选 **启用远程访问**，填写端口（默认 `3789`）和登录密码，保存。
3. 绑定地址选择 **局域网（0.0.0.0）**。
4. 面板会显示 `http://<局域网 IP>:3789`；手机连接同一 Wi-Fi 后打开该地址。
5. 用面板里设置的用户名和密码登录。

注意：

- 手机和电脑必须在同一网段；访客 Wi-Fi / AP 隔离会导致无法访问。
- 如果打不开，检查电脑防火墙是否放行该端口。
- 远程默认只允许访问当前用户主目录下的项目；需要访问其他磁盘时请调整 `remote.allowedRoots`。
- 关闭远程访问：取消勾选 → **Save remote access settings / 保存远程访问设置**。服务器会立即停止。

## 2. Cloudflare Quick Tunnel（临时公网地址）

适合临时在蜂窝网络下访问，不需要 Cloudflare 账号。

1. 先确认 **启用远程访问** 已勾选并保存（绑定地址可选“仅本机（配合隧道）”）。
2. 在 **设置 → 远程访问 → Cloudflare Tunnel** 选择 **Quick Tunnel（临时地址）**。
3. 点击 **启动隧道 / Start tunnel**。
   - 应用会自动查找 cloudflared；找不到时可以点 **下载 cloudflared**。
   - 应用会启动 `cloudflared tunnel --url http://127.0.0.1:3789`。
4. 面板会显示 `https://<随机>.trycloudflare.com`，点“复制”发给手机。
5. 首次启动后 DNS 生效通常需要 **30–60 秒**；期间打不开是正常的。
6. 手机打开该地址，用同一套账号密码登录。

限制：

- Quick Tunnel 每次启动都会生成新的随机地址。
- 地址是公网的，虽然需要登录，但仍建议只在临时场景使用。
- 应用必须保持运行；退出应用会停止隧道。
- 隧道不会自动重启；进程退出后重新点“启动隧道”即可。

## 3. Cloudflare Named Tunnel（固定域名，推荐长期使用）

需要你自己的 Cloudflare 域名。以下命令在电脑终端执行：

```bash
# 1. 登录 Cloudflare（会打开浏览器）
cloudflared tunnel login

# 2. 创建隧道
cloudflared tunnel create 3pi-desk

# 3. 把域名指向隧道（替换成你的域名）
cloudflared tunnel route dns 3pi-desk desk.example.com

# 4. 创建 ~/.cloudflared/config.yml
```

`~/.cloudflared/config.yml` 示例：

```yaml
tunnel: <创建隧道时输出的 UUID>
credentials-file: /home/<user>/.cloudflared/<UUID>.json
ingress:
  - hostname: desk.example.com
    service: http://127.0.0.1:3789
  - service: http_status:404
```

然后在应用里：

- **设置 → 远程访问 → Cloudflare Tunnel**
- 模式选 **Named Tunnel（固定域名）**
- Tunnel 名称：`3pi-desk`
- 配置文件：`~/.cloudflared/config.yml`
- 公网域名：`desk.example.com`
- 点击 **启动隧道**

应用会运行 `cloudflared tunnel run 3pi-desk`，并把 `https://desk.example.com` 显示在面板里。

### Cloudflare Access（建议）

在 Cloudflare Zero Trust 中为 `desk.example.com` 创建 Access 应用，添加邮箱 OTP 或 SSO
策略。这样必须先通过 Cloudflare 登录，才会到达 3PI Desk 的登录页；应用自身的账号密码
仍然是第二层保护。

## 4. 绑定地址怎么选

| 绑定地址 | 用途 |
|---|---|
| 局域网（0.0.0.0） | 手机同一 Wi-Fi 直接访问；也可以配合隧道 |
| 仅本机（localhost） | 只允许本机/隧道访问，不暴露局域网端口；配合 Cloudflare Tunnel 时推荐 |

## 5. 安全建议

- 远程访问默认关闭；只在需要时开启。
- 使用强密码；不要在多个服务复用。
- 公网长期使用请用 Named Tunnel + Cloudflare Access。
- 不要把 `3789` 端口直接映射到公网；优先使用 Cloudflare Tunnel。
- 手机丢失或密码泄露时：在电脑端修改密码，或关闭远程访问。
- 应用 API Token 不会发送给手机；手机只能看到掩码。

## 6. 故障排查

| 现象 | 检查 |
|---|---|
| 手机打不开局域网地址 | 是否同一 Wi-Fi、AP 隔离、电脑防火墙、绑定地址是否为“局域网” |
| Quick Tunnel 地址打不开 | 刚启动需等 30–60 秒 DNS；确认应用远程服务已启动；确认 cloudflared 进程存在 |
| 提示找不到 cloudflared | 在面板点“下载 cloudflared”，或安装后把路径填到 `CLOUDFLARED_PATH` |
| 隧道进程退出 | 重新点“启动隧道”；查看 `~/.config/claude-desk/diagnostics/app.log` |
| 登录一直失败 | 确认密码；注意在面板点“保存远程访问设置”不会改密码，改密码要单独点“修改密码” |
| 会话列表为空 | 确认当前项目目录下确实有 Claude Code 会话；手机需加载新版前端（可加 `?v=` 参数刷新） |
| 首 token 很慢 | 通常是上游 provider 首包延迟；界面会显示“正在等待模型首 token… Xs”，可切换模型/Effort。思考 token 也计入首 token，开始思考后提示会变成“模型正在思考… Xs” |

## 7. 维护者说明

- 主进程：`src/main/remote-server.ts`（HTTP + WebSocket）、`src/main/desk-hub.ts`
  （共享标签页/广播）、`src/main/remote-auth.ts`（账号密码/会话）、`src/main/tunnel.ts`
  （cloudflared 生命周期）。
- 浏览器适配：`src/renderer/src/lib/web-desk.ts` + `src/shared/desk-channels.ts`。
- 桌面端与手机端共用同一个渲染包；`window.desk` 在 Electron 下由 preload 提供，在浏览器
  下由 WebDesk 提供。
- 远程设置保存在 `<userData>/settings.json` 的 `remote` 字段（0600）。
- cloudflared 下载/缓存位置：`<userData>/cloudflared/`。
- 修改协议或事件时同步更新 `src/shared/remote.ts`、`src/shared/types.ts`、preload 和
  `web-desk.ts`；方法名映射必须保持在 `src/shared/desk-channels.ts` 中。
