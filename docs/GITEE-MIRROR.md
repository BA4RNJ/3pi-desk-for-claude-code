# Gitee 源码镜像

> **状态：已暂停（2026-11-03）。** Gitee 镜像暂不启用，README 不再提供入口。
> 本文保留作为将来重新启用时的配置参考；请勿把它当作当前可用的镜像地址。

GitHub 是主仓库，包含 Releases 安装包、Issues、Actions 和 Dependabot。Gitee 作为中国大陆可访问的
**源码镜像**，同步 `main` 分支和 Git tags；安装包仍以 GitHub Releases 为准。

当前镜像：https://gitee.com/BA4RNJ/3pi-desk-for-claude-code

## 最简单：网页导入（推荐，不需要命令行）

1. 登录 [Gitee](https://gitee.com/)。
2. 打开 **https://gitee.com/projects/import**。  
   如果这个地址打不开，点右上角 **＋ → 新建仓库 → 导入 GitHub 仓库**。
3. 源仓库地址填：

   ```text
   https://github.com/BA4RNJ/3pi-desk-for-claude-code
   ```

4. 仓库名 / 路径填 `3pi-desk-for-claude-code`，所有者选你自己。
5. 可见性选 **公开**，不要勾选“使用 README 初始化”。
6. 点击 **导入**，等待 Gitee 拉取完成。
7. 导入后如果需要更新，在 Gitee 仓库页找 **强制同步** / **同步** 按钮；如果仓库菜单里有
   **管理 → 仓库镜像管理 → 添加镜像**，选择 **拉取（Pull）**，源地址填上面的 GitHub 地址，
   开启自动同步即可。

完成后 Gitee 地址应为：

```text
https://gitee.com/BA4RNJ/3pi-desk-for-claude-code
```

> 如果你的 Gitee 用户名不是 `BA4RNJ`，把地址里的用户名换掉，并告诉维护者更新 README。

如果只做网页导入，可以忽略下面的 SSH / GitHub Actions 步骤；已配置的自动镜像工作流在未设置
secret 时会自动跳过，不会报错。

## 可选：GitHub Actions 自动同步（需要 SSH key）

### 1. 在 Gitee 创建空仓库

在 Gitee 创建：

```text
BA4RNJ/3pi-desk-for-claude-code
```

选择 **公开**，不要勾选“使用 README 初始化”，保持空仓库。

### 2. 生成一个只用于镜像的 SSH key

在本地执行（不要复用个人主力 key）：

```bash
ssh-keygen -t ed25519 -C "github-actions-gitee-mirror" -f ~/.ssh/gitee_mirror -N ""
cat ~/.ssh/gitee_mirror.pub
```

把 `gitee_mirror.pub` 的内容添加到：

```text
Gitee 仓库 → 管理 → 部署公钥管理 → 添加部署公钥
```

勾选 **启用写权限**（否则只能读，无法 push）。

### 3. 把私钥加到 GitHub Actions Secret

打开 GitHub 仓库：

```text
Settings → Secrets and variables → Actions → New repository secret
```

- Name: `GITEE_SSH_PRIVATE_KEY`
- Secret: 粘贴 `~/.ssh/gitee_mirror` 的**完整私钥内容**

不要把私钥提交到仓库，也不要发到聊天/Issue 里。

### 4. 首次同步

在 GitHub 仓库的 **Actions → Mirror to Gitee → Run workflow** 手动运行一次。

未配置 secret 时工作流会打印提示并跳过，不会失败。

首次同步后，到 Gitee 仓库设置里把默认分支设为 `main`（如果 Gitee 没有自动设置）。

如果 Gitee 用户名或仓库路径不是 `BA4RNJ/3pi-desk-for-claude-code`，在 GitHub 仓库添加一个
Actions repository variable：

```text
Settings → Secrets and variables → Actions → Variables → New repository variable
Name: GITEE_REPO
Value: git@gitee.com:<your-gitee-name>/3pi-desk-for-claude-code.git
```

同时更新 README 里的 Gitee 链接。

## 验证

```bash
git ls-remote git@gitee.com:BA4RNJ/3pi-desk-for-claude-code.git
```

应该能看到 `refs/heads/main` 和 `refs/tags/v0.4.3` 等。

## 同步范围

| 内容 | 是否同步 |
| --- | --- |
| `main` 分支 | 是 |
| Git tags（`v*`、`wsl-v*`） | 是 |
| 其他功能分支 | 否 |
| Releases / AppImage / deb / dmg | 否，安装包只在 GitHub Releases |
| Issues / PR / Actions / Dependabot | 否，只在 GitHub |
| Stars / Watchers | 否，各平台独立 |

## 手动同步（不使用 Actions）

如果不想配置 secret，也可以在 Gitee 使用 **新建仓库 → 导入 GitHub 仓库**，或手动：

```bash
git remote add gitee git@gitee.com:BA4RNJ/3pi-desk-for-claude-code.git
git push gitee main:main
git push gitee --tags
```

## 排错

- **Permission denied (publickey)**：检查 Gitee 部署公钥是否勾选写权限，以及 secret 是否是私钥。
- **non-fast-forward**：Gitee 仓库不是空的，或曾手动改过；删除 Gitee 仓库后重建，或手动 force-push。
- **工作流跳过**：`GITEE_SSH_PRIVATE_KEY` 未设置；按第 3 步添加。
- **tag 冲突**：Gitee 上已有同名 tag 且指向不同 commit；确认后手动处理，不要盲目覆盖。
- **同步延迟**：工作流在 push/tag 时触发，另有每天 03:17 的定时兜底；也可以手动 Run workflow。
