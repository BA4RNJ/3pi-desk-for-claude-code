export type Language = 'en' | 'zh'

const DICTIONARY: Record<string, string> = {
  "克劳德工作台": "for Claude Code",
  "新建对话": "New chat",
  "新对话": "New chat",
  "工作目录": "Workspace",
  "最近会话": "Recent chats",
  "搜索结果": "Search results",
  "搜索所有会话…": "Search all chats…",
  "搜索可用插件…": "Search available plugins…",
  "这个目录还没有会话": "No chats in this workspace yet",
  "没有匹配的会话": "No matching chats",
  "刷新会话列表": "Refresh chats",
  "刷新会话": "Refresh chats",
  "未命名会话": "Untitled chat",
  "会话操作": "Chat actions",
  "置顶会话": "Pin chat",
  "取消置顶": "Unpin",
  "设置标签": "Set tag",
  "设置会话标签": "Set chat tag",
  "标签：": "Tab: ",
  "重命名会话": "Rename chat",
  "重命名": "Rename",
  "删除会话": "Delete chat",
  "导出 Markdown": "Export Markdown",
  "导出当前对话": "Export chat",
  "创建分支": "Create branch",
  "分支": "Branch",
  "复制": "Copy",
  "复制回复": "Copy reply",
  "复制代码": "Copy code",
  "已复制": "Copied",
  "编辑": "Edit",
  "编辑消息": "Edit message",
  "编辑并重发": "Edit and resend",
  "重发": "Resend",
  "重新生成": "Regenerate",
  "重新生成这条回复": "Regenerate this reply",
  "从这里创建分支": "Branch from here",
  "从这条回复创建分支": "Branch from this reply",
  "恢复文件": "Restore files",
  "恢复文件到此消息": "Restore files to this message",
  "撤回": "Withdraw",
  "撤回消息": "Withdraw message",
  "撤回这条消息": "Withdraw this message",
  "撤回并在输入框编辑": "Withdraw and edit in the composer",
  "消息已撤回": "Message withdrawn",
  "回退会话失败：": "Could not roll back the conversation: ",
  "撤回后，这条消息及其后的回复会从当前对话中移除。仅回退对话，不会自动撤销文件修改。旧对话记录仍保留在本机，但不再显示在会话列表中。": "After withdrawal, this message and the replies after it are removed from the current conversation. Only the conversation is rolled back; file changes are not undone automatically. The old transcript is kept on this machine but hidden from the session list.",
  "文件已恢复": "Files restored",
  "已恢复": "Restored",
  "回滚失败": "Restore failed",
  "关闭": "Close",
  "关闭标签": "Close tab",
  "新建标签": "New tab",
  "取消": "Cancel",
  "保存": "Save",
  "保存标签": "Save tag",
  "删除": "Delete",
  "确认": "Confirm",
  "确认删除": "Confirm delete",
  "刷新": "Refresh",
  "刷新市场": "Refresh marketplace",
  "刷新插件市场": "Refresh plugin marketplace",
  "刷新扩展": "Refresh extensions",
  "刷新后台会话": "Refresh background sessions",
  "刷新文件树": "Refresh file tree",
  "设置": "Settings",
  "关于": "About",
  "关于与更新": "About & updates",
  "版本信息与更新检查。": "Version information and update checks.",
  "应用版本": "App version",
  "内置 Claude Code": "Bundled Claude Code",
  "最新 SDK": "Latest SDK",
  "检查失败": "Check failed",
  "已是最新": "Up to date",
  "有新版本": "Update available",
  "检查更新": "Check for updates",
  "复制更新命令": "Copy update command",
  "Claude Code 的本地图形界面，使用 Claude Agent SDK 运行。": "A local GUI for Claude Code powered by the Claude Agent SDK.",
  "当前是本地构建，未配置发布源，因此应用不会自动下载安装包。更新 SDK 后重新打包即可；Claude Code CLI 使用本机安装或按需下载。": "This is a local build without a release feed, so it cannot auto-update. Update the SDK and rebuild; the Claude Code CLI is installed locally or downloaded on demand.",
  "常规": "General",
  "外观": "Appearance",
  "外观、集成与会话预算。": "Appearance, integrations, and session budget.",
  "Claude Code CLI": "Claude Code CLI",
  "状态": "Status",
  "路径": "Path",
  "版本": "Version",
  "检测中…": "Detecting…",
  "环境变量": "Environment variable",
  "手动指定": "Manual selection",
  "应用内置": "Bundled",
  "已下载": "Downloaded",
  "系统安装": "System install",
  "未找到": "Not found",
  "应用不再内置 CLI：优先使用本机已安装的 claude，其次使用已下载的版本。没有找到时可以下载官方 CLI（约 146 MB），或手动选择可执行文件。": "The app no longer bundles the CLI. It uses your installed claude first, then a previously downloaded copy. If neither exists, download the official CLI (~146 MB) or choose an executable manually.",
  "下载 CLI": "Download CLI",
  "选择已有安装": "Use existing install",
  "重新检测": "Detect again",
  "恢复自动检测": "Use auto-detection",
  "正在下载…": "Downloading…",
  "正在解压…": "Extracting…",
  "未找到 Claude Code CLI": "Claude Code CLI not found",
  "聊天需要 Claude Code CLI。可以下载官方 CLI（约 146 MB），或选择本机已安装的 claude。": "Chat needs the Claude Code CLI. Download the official CLI (~146 MB) or choose your installed claude.",
  "浅色": "Light",
  "深色": "Dark",
  "跟随系统": "System",
  "浅色主题": "Light theme",
  "深色主题": "Dark theme",
  "字号": "Font size",
  "小": "Small",
  "标准": "Standard",
  "大": "Large",
  "特大": "Extra large",
  "强调色": "Accent color",
  "紧凑模式": "Compact mode",
  "减少间距，一屏显示更多内容。": "Reduce spacing to fit more on screen.",
  "集成（新会话生效）": "Integrations (new chats)",
  "连接 IDE": "Connect IDE",
  "向 Claude Code 传入 --ide，需要已安装对应 IDE 扩展。": "Passes --ide to Claude Code; requires the matching IDE extension.",
  "Chrome 集成": "Chrome integration",
  "向 Claude Code 传入 --chrome，需要 Claude in Chrome 扩展。": "Passes --chrome to Claude Code; requires the Claude in Chrome extension.",
  "关闭窗口时最小化到托盘": "Minimize to tray on close",
  "关闭窗口后应用继续在托盘运行。": "Keep the app running in the tray after closing the window.",
  "WSL 不提供系统托盘；在 WSL 中关闭窗口会直接退出。": "WSL has no system tray; closing the window quits the app.",
  "全局快捷键": "Global shortcut",
  "Ctrl/Cmd + Shift + Space 显示窗口（Wayland 下可能不可用）。": "Ctrl/Cmd + Shift + Space shows the window (may not work on Wayland).",
  "WSL 不支持跨 Windows 的全局快捷键。": "Global shortcuts cannot reach Windows from WSL.",
  "会话预算上限": "Session budget",
  "传给 Claude Code 的 maxBudgetUsd。当前已设：": "maxBudgetUsd passed to Claude Code. Current:",
  "不限制": "Unlimited",
  "后台与云端": "Background & cloud",
  "后台任务": "Background tasks",
  "在顶部「任务」菜单查看": "View in the Tasks menu",
  "云端会话": "Cloud sessions",
  "需要 Anthropic 账号，OpenCode Go 下不可用": "Requires an Anthropic account; unavailable on OpenCode Go",
  "当前工作目录": "Current workspace",
  "目录": "Directory",
  "模型": "Model",
  "保存偏好": "Save preferences",
  "偏好已保存，集成开关对新会话生效": "Preferences saved. Integrations apply to new chats.",
  "API 配置": "API",
  "API Token": "API token",
  "Base URL": "Base URL",
  "默认模型": "Default model",
  "配置档案": "Profiles",
  "还没有保存的配置档案。": "No saved profiles yet.",
  "配置名称，例如 OpenCode Go": "Profile name, e.g. OpenCode Go",
  "保存当前为档案": "Save current as profile",
  "配置档案已保存": "Profile saved",
  "应用": "Apply",
  "删除配置": "Delete profile",
  "恢复 OpenCode Go 默认": "Reset to OpenCode Go defaults",
  "测试连接": "Test connection",
  "测试中…": "Testing…",
  "保存 API 配置": "Save API settings",
  "连接成功，可用模型": "Connected. Available models:",
  "连接失败：": "Connection failed: ",
  "修改后只影响新启动的会话；当前会话继续使用启动时的配置。": "Changes apply to new chats; the current chat keeps its startup configuration.",
  "权限": "Permissions",
  "管理附加目录、工具白名单/黑名单，以及 Claude Code 的 allow / ask / deny 规则。": "Manage extra directories, tool allow/deny lists, and Claude Code allow/ask/deny rules.",
  "附加目录（--add-dir）": "Extra directories (--add-dir)",
  "还没有附加目录。": "No extra directories.",
  "添加目录": "Add directory",
  "移除目录": "Remove directory",
  "工具白名单（allowedTools，新会话生效）": "Tool allowlist (allowedTools, new chats)",
  "裸工具名会跳过该工具的确认；带参数的规则更安全。": "Bare tool names skip confirmation for that tool; scoped rules are safer.",
  "工具黑名单（disallowedTools，新会话生效）": "Tool blocklist (disallowedTools, new chats)",
  "allow 规则（每行一条）": "Allow rules (one per line)",
  "ask 规则（每行一条）": "Ask rules (one per line)",
  "deny 规则（每行一条）": "Deny rules (one per line)",
  "保存权限设置": "Save permissions",
  "权限设置已保存，新会话生效": "Permissions saved. Applies to new chats.",
  "规则写入 ~/.claude/settings.json 的 permissions 字段。": "Rules are written to permissions in ~/.claude/settings.json.",
  "扩展": "Extensions",
  "扩展管理": "Extensions",
  "管理 MCP、插件、技能、Hooks 与 Agents。这里修改的是 Claude Code 的本地配置。": "Manage MCP, plugins, skills, hooks, and agents. Edits Claude Code's local configuration.",
  "MCP": "MCP",
  "MCP 配置": "MCP configuration",
  "保存配置": "Save configuration",
  "保存后对新会话生效；当前会话可切换已有服务器。": "Applies to new chats; existing servers can be toggled in the current chat.",
  "还没有配置 MCP 服务器。": "No MCP servers configured.",
  "用户": "User",
  "项目": "Project",
  "本地": "Local",
  "插件": "Plugins",
  "插件市场": "Plugin marketplace",
  "添加市场：owner/repo 或 Git URL": "Add marketplace: owner/repo or Git URL",
  "添加市场": "Add marketplace",
  "更新全部": "Update all",
  "更新": "Update",
  "未安装插件。可以从下方官方市场直接安装。": "No plugins installed. Install one from the official marketplace below.",
  "插件变更后需新会话生效。": "Plugin changes apply to new chats.",
  "安装": "Install",
  "已安装": "Installed",
  "安装中…": "Installing…",
  "卸载": "Uninstall",
  "已停用": "Disabled",
  "启用": "Enable",
  "停用": "Disable",
  "正在执行插件操作…": "Working on plugin…",
  "技能": "Skills",
  "新建技能": "New skill",
  "去插件市场": "Browse plugins",
  "技能没有独立市场；安装带技能的插件后会自动出现。": "Skills have no separate marketplace; they appear after installing plugins that bundle them.",
  "还没有技能。把技能放到 ~/.claude/skills 或 .claude/skills。": "No skills yet. Add skills under ~/.claude/skills or .claude/skills.",
  "保存到 ~/.claude/skills，下一会话生效。": "Saved to ~/.claude/skills; applies to the next chat.",
  "Hooks": "Hooks",
  "用户设置": "User settings",
  "项目设置": "Project settings",
  "打开用户设置": "Open user settings",
  "打开项目设置": "Open project settings",
  "还没有配置 Hooks。": "No hooks configured.",
  "Hooks JSON": "Hooks JSON",
  "写入 settings.json 的 hooks 字段，新会话生效。": "Writes the hooks field in settings.json; applies to new chats.",
  "保存 Hooks": "Save hooks",
  "Agents": "Agents",
  "新建 Agent": "New agent",
  "保存到 ~/.claude/agents，下一会话生效。": "Saved to ~/.claude/agents; applies to the next chat.",
  "后台": "Background",
  "后台会话": "Background sessions",
  "用 Claude Code CLI 在后台运行会话，不占用当前标签。": "Run sessions in the background with the Claude Code CLI without using a tab.",
  "启动后台会话": "Start background session",
  "信任此目录（写入 Claude Code 信任列表）": "Trust this directory (adds to Claude Code's trusted list)",
  "只信任目录": "Trust directory",
  "后台/交互会话": "Background/interactive sessions",
  "没有运行中的后台会话。": "No running background sessions.",
  "日志": "Logs",
  "停止": "Stop",
  "（暂无日志）": "(No logs yet)",
  "后台会话由 Claude Code CLI 管理，关闭面板后继续运行。云端会话需要 Anthropic 账号，当前 OpenCode Go 配置下不可用。": "Background sessions are managed by the Claude Code CLI and keep running after this panel closes. Cloud sessions require an Anthropic account and are unavailable on OpenCode Go.",
  "用量": "Usage",
  "用量与限额": "Usage & limits",
  "本会话估算费用": "Estimated session cost",
  "按模型单价与高峰倍率估算": "Estimated from model pricing and peak multipliers",
  "部分模型未匹配价格，仅供参考": "Some models have no pricing match; estimate only",
  "Token 用量": "Token usage",
  "缓存读": "cache read",
  "上下文": "Context",
  "% 已使用": "% used",
  "当前模型": "Current model",
  "单价": "Pricing",
  "上下文窗口": "Context window",
  "最大输出": "Max output",
  "思考强度": "Effort",
  "未设置": "Not set",
  "在 OpenCode Console 查看用量与限额": "View usage & limits in OpenCode Console",
  "OpenCode Go 的月度限额、账单和实际扣费以 Console 为准；这里显示的是本地按 token 与模型单价计算的估算值。": "OpenCode Go monthly limits, billing, and actual charges are authoritative in the Console. This page estimates local usage from tokens and model prices.",
  "。额度会随计划变化，以 Console 为准。": ". Limits vary by plan; the Console is authoritative.",
  "Go 计划参考额度约 $100/月（Go Plus $200、Teams $105）": "Go plan reference allowance: about $100/month (Go Plus $200, Teams $105)",
  "Go 计划参考额度约 $15/月（Go Plus $60、Teams $20）": "Go plan reference allowance: about $15/month (Go Plus $60, Teams $20)",
  "查看用量与限额": "View usage & limits",
  "欢迎使用": "Welcome",
  "下午好": "Good afternoon",
  "早上好": "Good morning",
  "晚上好": "Good evening",
  "夜深了": "Working late",
  "，今天想一起构建什么？": ", what shall we build today?",
  "在本地项目中与 Claude 协作。所有命令与文件修改都会先征求你的同意。": "Work with Claude in your local project. Every command and file edit asks for your approval first.",
  "介绍一下这个项目的结构和用途": "Explain this project structure and purpose",
  "帮我找出代码里的一个潜在问题并修复": "Find and fix a potential issue in the code",
  "为当前项目补充必要的测试": "Add essential tests to this project",
  "给 Claude 发消息…  输入 / 查看命令 · @ 引用文件": "Message Claude…  Type / for commands · @ to reference files",
  "Enter 发送 · Shift+Enter 换行": "Enter to send · Shift+Enter for a new line",
  "Claude 可能会出错，请检查重要操作与代码改动。": "Claude can make mistakes. Review important operations and code changes.",
  "添加图片、PDF 或文件": "Add image, PDF, or file",
  "添加图片、PDF 或文本文件": "Add image, PDF, or text file",
  "文件过大": "File is too large",
  "无法读取文件": "Could not read the file",
  "文件内容为空": "File is empty",
  "不支持的文件类型": "Unsupported file type",
  "简洁模式": "Compact mode",
  "详细模式": "Detailed mode",
  "切换简洁/详细模式": "Switch compact/detailed mode",
  "只看我的消息": "My messages only",
  "只显示我发送的消息": "Show only messages I sent",
  "全部": "All",
  "消息范围": "Message scope",
  "只显示用户消息": "Show only user messages",
  "显示全部消息": "Show all messages",
  "切换用户 / 全部消息": "Toggle user / all messages",
  "点击任意消息跳转到完整对话": "Click a message to jump to the full conversation",
  "还没有发送过消息": "No messages sent yet",
  "（附件消息）": "(attachment message)",
  "个附件": " attachment(s)",
  "发送消息": "Send message",
  "停止生成": "Stop generating",
  "移除附件": "Remove attachment",
  "松开以添加图片或文件": "Drop to add images or files",
  "正在连接 Claude": "Connecting to Claude",
  "初始化本地会话与项目上下文…": "Initializing local session and project context…",
  "正在载入会话…": "Loading chat…",
  "正在准备 3PI Desk…": "Preparing 3PI Desk…",
  "按停止按钮可中断": "Press stop to interrupt.",
  "工作中": "Working",
  "需要你的确认": "Confirmation required",
  "需要确认：": "Confirmation required: ",
  "执行终端命令": "Run terminal command",
  "编辑文件": "Edit file",
  "写入文件": "Write file",
  "读取文件": "Read file",
  "查找文件": "Find files",
  "搜索内容": "Search content",
  "网页搜索": "Web search",
  "获取网页": "Fetch web page",
  "访问网页": "Open web page",
  "更新任务清单": "Update todo list",
  "启动子代理": "Start subagent",
  "任务清单": "Todo list",
  "任务": "Tasks",
  "子代理": "Subagent",
  "终端命令": "Terminal command",
  "完成": "Done",
  "失败": "Failed",
  "执行中": "Running",
  "等待确认": "Waiting for approval",
  "允许一次": "Allow once",
  "本会话允许": "Allow for this chat",
  "拒绝": "Deny",
  "拒绝并关闭": "Deny and close",
  "继续规划": "Keep planning",
  "批准并执行": "Approve and run",
  "计划已准备好，等待你的批准": "Plan ready for approval",
  "计划已准备好": "Plan ready",
  "展开完整计划": "Show full plan",
  "收起计划": "Collapse plan",
  "发送回答": "Send answers",
  "跳过": "Skip",
  "其他答案（可选）": "Other answer (optional)",
  "可多选": "Select all that apply",
  "Claude 需要你的选择": "Claude needs your input",
  "Claude 需要你的回答": "Claude needs your answer",
  "需要你的回答": "needs your answer",
  "等待回答": "Waiting for answer",
  "回答下面的问题后 Claude 会继续。": "Answer the questions to continue.",
  "这个提问没有可显示的问题数据。": "This question has no displayable options.",
  "把 Claude 在该消息之后修改的文件恢复到当时的状态。": "Restore files changed by Claude after this message.",
  "只恢复 Claude Code 记录的文件编辑；Bash 命令、git 操作、依赖安装等外部副作用不会被撤销。": "Only file edits recorded by Claude Code are restored. Bash, git, dependency installs, and other external side effects are not undone.",
  "正在检查文件检查点…": "Checking file checkpoints…",
  "正在读取文件…": "Reading file…",
  "保存文件": "Save file",
  "在系统中打开": "Open in system",
  "文件": "Files",
  "文件面板": "File panel",
  "文件预览": "File preview",
  "目录为空，或没有可显示的文件。": "The directory is empty or has no displayable files.",
  "点击文件预览；支持文本编辑与图片查看。": "Click a file to preview; text editing and image viewing are supported.",
  "这是二进制文件，无法在面板中预览。": "This is a binary file and cannot be previewed.",
  "关闭文件面板": "Close file panel",
  "打开文件": "Open file",
  "会话记录会从本机删除，无法恢复。": "The chat will be removed from this machine and cannot be recovered.",
  "确定删除「": "Delete “",
  "」吗？": "”?",
  "删除失败：": "Delete failed: ",
  "导出失败：": "Export failed: ",
  "已导出到": "Exported to",
  "设置标签失败：": "Failed to set tag: ",
  "重命名失败：": "Rename failed: ",
  "创建分支失败：": "Failed to create branch: ",
  "恢复会话失败：": "Failed to resume chat: ",
  "切换模型失败：": "Failed to switch model: ",
  "切换权限模式失败：": "Failed to switch permission mode: ",
  "切换思考强度失败：": "Failed to switch effort: ",
  "发送失败：": "Send failed: ",
  "停止失败：": "Stop failed: ",
  "无法启动会话：": "Could not start chat: ",
  "权限响应失败：": "Permission response failed: ",
  "编辑重发失败：": "Edit/resend failed: ",
  "重新生成失败：": "Regenerate failed: ",
  "初始化失败：": "Initialization failed: ",
  "这条消息没有可用的会话位置": "This message has no usable session position",
  "用户拒绝了此操作": "The user denied this action",
  "权限被拒绝": "Permission denied",
  "请求失败（HTTP": "Request failed (HTTP",
  "本轮执行出错": "This turn failed",
  "已取消": "Cancelled",
  "等待中": "Pending",
  "已停止": "Stopped",
  "已连接": "Connected",
  "连接失败": "Connection failed",
  "需要登录": "Sign-in required",
  "未知错误": "Unknown error",
  "未知路径": "Unknown path",
  "未知": "Unknown",
  "价格未知": "Pricing unknown",
  "正在思考…": "Thinking…",
  "思考过程": "Thinking",
  "正在恢复…": "Restoring…",
  "正在连接…": "Connecting…",
  "正在工作": "is working",
  "默认": "Default",
  "低": "Low",
  "中": "Medium",
  "高": "High",
  "极高": "Extra high",
  "最大": "Max",
  "每次询问": "Ask every time",
  "自动接受编辑": "Auto-accept edits",
  "计划模式": "Plan mode",
  "跳过所有确认": "Skip all confirmations",
  "危险：所有工具直接执行": "Danger: run every tool without confirmation",
  "执行工具前请求确认": "Ask before running a tool",
  "文件修改无需确认": "File edits need no confirmation",
  "只分析，不执行修改": "Analyze only; do not modify",
  "由模型自动决定": "Decided by the model",
  "打开": "Open",
  "新建": "New",
  "详情": "Details",
  "收起": "Collapse",
  "参数": "Arguments",
  "工具": "Tool",
  "名称": "Name",
  "使用": "Use",
  "调用": "Call",
  "原因：": "Reason: ",
  "个工具": " tools",
  "个文件": " files",
  "个请求": " requests",
  "项任务": " tasks",
  "次安装": " installs",
  "分钟前": " min ago",
  "小时前": " hr ago",
  "天前": " d ago",
  "刚刚": "just now",
  "还有": "and",
  "个链接文件被跳过": " linked files skipped",
  "当前会话": "Current chat",
  "当前标签": "Current tab",
  "新建工作区": "New workspace",
  "工作区": "Workspace",
  "添加上下文": "Add context",
  "上下文已自动压缩，对话将继续": "Context compacted automatically; the chat will continue",
  "多项选择": "Multi-select",
  "发送": "Send",
  "继续": "Continue",
  "编辑扩展": "Edit extension",
  "打开设置": "Open settings",
  "已保存": "Saved",
  "恢复": "Restore",
  "主题": "Theme",
  "系统": "System",
  "语言": "Language",
  "English": "English",
  "中文": "中文"
}

Object.assign(DICTIONARY, {
  '强度': 'Effort',
  '会话已删除，备份已保存': 'Chat deleted; backup saved',
  '打开备份目录': 'Open backup folder',
  '备份目录': 'Backup folder',
  '删除前会在本机保留一份备份。': 'A local backup will be kept before deletion.',
  '工作区': 'Workspaces',
  '添加工作区': 'Add workspace',
  '还没有工作区。添加一个项目文件夹开始。': 'No workspaces yet. Add a project folder to start.',
  '当前': 'Current',
  '正在读取…': 'Loading…',
  '个会话': ' chats',
  '最近': 'Last ',
  '从常用工作区移除': 'Remove from recent workspaces',
  '打开': 'Open',
  '对话归属于工作区。打开一个工作区即可查看它的会话，切换工作区不会影响其他标签中的对话。':
    'Chats belong to workspaces. Open a workspace to see its chats; switching workspaces does not affect chats in other tabs.',
  '会话由 Claude Code 持久化在本机。应用不会自动删除会话；从界面删除会话会先确认，并保留一份本地备份。':
    'Chats are persisted locally by Claude Code. The app never deletes chats automatically; deleting a chat requires confirmation and keeps a local backup.',
  '更多': 'More',
  '打开工作区': 'Open workspace',
  '打开项目文件夹': 'Open project folder',
  '添加': 'Add',
  '移除': 'Remove',
  '搜索工作区…': 'Search workspaces…',
  '工作区窗口': 'Workspaces',
  '当前工作区': 'Current workspace',
  '历史工作区': 'Recent workspaces',
  '语言': 'Language',
  '不限制。': 'Unlimited.',
  '个': '',
  '次': ' times',
  '天前': ' days ago'
})

Object.assign(DICTIONARY, {
  'AI 编程工作台': 'AI coding workspace',
  'AI 编程工作台 · v': 'AI coding workspace · v',
  '供应商': 'Provider',
  '自定义供应商': 'Custom provider',
  '多模型网关，兼容 Anthropic Messages API':
    'Multi-model gateway with Anthropic Messages API compatibility',
  'Anthropic 官方 API': 'Official Anthropic API',
  'GLM 系列，Anthropic 兼容端点': 'GLM models on an Anthropic-compatible endpoint',
  'Kimi 系列，Anthropic 兼容端点': 'Kimi models on an Anthropic-compatible endpoint',
  'DeepSeek 官方 Anthropic 兼容端点': 'Official DeepSeek Anthropic-compatible endpoint',
  'MiniMax 系列，Anthropic 兼容端点': 'MiniMax models on an Anthropic-compatible endpoint',
  '本地模型，需要 Ollama 提供 Anthropic 兼容接口':
    "Local models; requires Ollama's Anthropic-compatible endpoint",
  '任何兼容 Anthropic Messages API 的服务':
    'Any service compatible with the Anthropic Messages API',
  '选择供应商，填写密钥与模型。配置写入 ~/.claude/settings.json，密钥只保存在本机。':
    'Choose a provider, then enter a key and model. Settings are written to ~/.claude/settings.json; keys stay on this machine.',
  '需要兼容 Anthropic Messages API；自定义供应商请填写其 Anthropic 兼容地址。':
    'The endpoint must be compatible with the Anthropic Messages API; for custom providers, enter their Anthropic-compatible base URL.',
  '配置名称，例如 我的供应商': 'Profile name, e.g. My provider',
  '切换供应商后请填写新供应商的密钥。':
    'After switching providers, enter the new provider key.',
  '认证方式': 'Authentication',
  'Bearer 使用 Authorization 头；x-api-key 使用 X-Api-Key 头。':
    'Bearer sends an Authorization header; x-api-key sends an X-Api-Key header.',
  '只有 API 密钥也可以：填好密钥后点“测试并获取模型”，应用会读取模型列表或自动尝试常见模型。':
    'An API key is enough: after entering it, choose “Test & fetch models”. The app reads the provider model list or tries common models automatically.',
  '不知道模型？先点“测试并获取模型”。':
    'Do not know the model? Run “Test & fetch models” first.',
  '自定义供应商如果没有模型列表，需要填写供应商文档中的模型 ID。':
    'If a custom provider has no model list, enter a model ID from its documentation.',
  '测试并获取模型': 'Test & fetch models',
  '请先选择或填写模型': 'Select or enter a model first.',
  '选择此模型': 'Use this model',
  '已自动选择模型': 'Automatically selected model',
  '连接成功，已自动检测到模型': 'Connected; detected model',
  'Ollama 等本地服务没有密钥时，可填写任意占位值。':
    'For local services such as Ollama, enter any placeholder value if there is no key.',
  '模型列表': 'Models',
  '还没有可用模型。': 'No models available yet.',
  '点击“测试连接”尝试读取供应商模型列表；不支持列表的供应商会改用当前模型验证。':
    "Test connection tries to read the provider's model list; providers without one are verified with the current model.",
  '自定义模型': 'Custom models',
  '模型 ID（必填）': 'Model ID (required)',
  '显示名称（可选）': 'Display name (optional)',
  '上下文窗口（可选）': 'Context window (optional)',
  '添加模型': 'Add model',
  '模型已添加': 'Model added',
  '模型已移除': 'Model removed',
  '删除模型': 'Delete model',
  '供应商列表里没有的模型可以手动添加；上下文窗口留空时由供应商或引擎决定。':
    'Add models manually when the provider does not list them; leave the context window empty to let the provider or engine decide.',
  '恢复默认供应商': 'Reset to default provider',
  '连接成功（供应商未提供模型列表，已用当前模型验证）':
    'Connected (the provider has no model list; verified with the current model)',
  '在供应商控制台查看用量与限额': 'View usage & limits in the provider console',
  '实际限额、账单和扣费以供应商控制台为准；这里显示的是本地按 token 与模型单价计算的估算值。':
    'Actual limits, billing, and charges are authoritative in the provider console. This page estimates usage from tokens and model prices.',
  'AI 可能会出错，请检查重要操作与代码改动。':
    'AI can make mistakes. Review important operations and code changes.',
  '输入消息…  输入 / 查看命令 · @ 引用文件':
    'Message…  Type / for commands · @ to reference files',
  '正在连接模型': 'Connecting to model',
  '需要你的选择': 'Your input is needed',
  '回答下面的问题后将继续。': 'Answer the questions to continue.',
  '把助手在该消息之后修改的文件恢复到当时的状态。':
    'Restore files changed by the assistant after this message.',
  '只恢复会话记录的文件编辑；Bash 命令、git 操作、依赖安装等外部副作用不会被撤销。':
    'Only file edits recorded by the session are restored. Bash, git, dependency installs, and other external side effects are not undone.',
  '会话由本地引擎持久化在本机。应用不会自动删除会话；从界面删除会话会先确认，并保留一份本地备份。':
    'Chats are persisted locally by the engine. The app never deletes chats automatically; deleting a chat requires confirmation and keeps a local backup.',
  '给后台任务的消息…': 'Message for the background task…',
  '信任此目录（写入引擎信任列表）':
    "Trust this directory (adds to the engine's trusted list)",
  '后台会话由本地引擎管理，关闭面板后继续运行。云端会话需要 Anthropic 账号，当前供应商下通常不可用。':
    'Background sessions are managed by the local engine and keep running after this panel closes. Cloud sessions require an Anthropic account and are usually unavailable with third-party providers.',
  '向引擎传入 --ide，需要已安装对应 IDE 扩展。':
    'Passes --ide to the engine; requires the matching IDE extension.',
  '向引擎传入 --chrome，需要对应的 Chrome 扩展。':
    'Passes --chrome to the engine; requires the matching Chrome extension.',
  '传给引擎的 maxBudgetUsd。当前已设：': 'maxBudgetUsd passed to the engine. Current:',
  '需要 Anthropic 账号；第三方供应商通常不可用':
    'Requires an Anthropic account; usually unavailable with third-party providers',
  '管理附加目录、工具白名单/黑名单，以及引擎的 allow / ask / deny 规则。':
    "Manage extra directories, tool allow/deny lists, and the engine's allow/ask/deny rules.",
  '管理 MCP、插件、技能、Hooks 与 Agents。这里修改的是引擎的本地配置。':
    "Manage MCP, plugins, skills, hooks, and agents. These are the engine's local configuration.",
  '用本地引擎在后台运行会话，不占用当前标签。':
    'Run sessions with the local engine in the background without using a tab.',
  '本地 AI 编程图形界面，基于 Agent SDK 运行。':
    'A local AI coding GUI powered by the Agent SDK.',
  '内置引擎': 'Bundled engine',
  '当前是本地构建，未配置发布源，因此应用不会自动下载安装包。更新 SDK 后重新打包即可；Claude Code CLI 使用本机安装或按需下载。':
    'This is a local build without a release feed, so it cannot auto-update. Update the SDK and rebuild; the Claude Code CLI is installed locally or downloaded on demand.',
  '检查引擎安装状态': 'Check engine installation',
  'AI 会话': 'AI chat',
  '已完成规划，批准后将开始执行。': 'Planning is complete; execution starts after approval.',
  '已完成规划，批准后将开始执行': 'Planning is complete; execution starts after approval',
  // Workspace search
  '搜索工作区': 'Search workspace',
  '搜索文件内容…': 'Search file contents…',
  '搜索文件名…': 'Search file names…',
  '内容': 'Content',
  '文件名': 'File name',
  '输入关键词开始搜索。': 'Type a keyword to search.',
  '正在搜索…': 'Searching…',
  '没有匹配结果。': 'No matches.',
  '快捷键：Ctrl/Cmd + Shift + F 打开内容搜索，Ctrl/Cmd + P 打开文件名搜索。':
    'Shortcuts: Ctrl/Cmd + Shift + F for content search, Ctrl/Cmd + P for file name search.',
  '搜索工作区（Ctrl/Cmd + Shift + F）': 'Search workspace (Ctrl/Cmd + Shift + F)',
  // Command palette
  '命令面板': 'Command palette',
  '输入命令…': 'Type a command…',
  '没有匹配的命令。': 'No matching commands.',
  '斜杠命令': 'Slash commands',
  '部分交互式命令（如打开终端面板或选择器）在无头环境中不可用。':
    'Some interactive commands (terminal panels or pickers) are unavailable in the headless environment.',
  '压缩当前上下文': 'Compact the current context',
  '清空当前会话上下文': 'Clear the current chat context',
  '查看当前会话状态': 'Show the current chat status',
  '查看上下文占用明细': 'Show context usage details',
  '查看本次会话用量与费用': 'Show usage and cost for this chat',
  '为项目生成 CLAUDE.md': 'Generate CLAUDE.md for the project',
  '审查当前改动或 PR': 'Review current changes or a PR',
  '回退文件或对话': 'Rewind files or the conversation',
  '查看或切换模型': 'View or switch models',
  '查看 MCP 服务器状态': 'Show MCP server status',
  '查看子代理': 'Show subagents',
  '查看可用技能': 'Show available skills',
  '查看已配置 Hooks': 'Show configured hooks',
  '查看帮助': 'Show help',
  '搜索文件内容': 'Search file contents',
  '搜索文件名': 'Search file names',
  '关闭文件面板': 'Close file panel',
  '打开文件面板': 'Open file panel',
  '打开设置': 'Open settings',
  '打开扩展设置': 'Open extension settings',
  '导出当前对话为 Markdown': 'Export current chat as Markdown',
  '打开会话备份目录': 'Open chat backup folder',
  '刷新模型列表': 'Refresh model list',
  '切换到中文': 'Switch to Chinese',
  // Sidebar and composer
  '加载更多会话': 'Load more chats',
  '正在加载…': 'Loading…',
  '加载更多搜索结果': 'Load more search results',
  '运行中 · 发送将排队': 'Running · sending will queue',
  '排队发送': 'Queue message',
  '停止这个任务': 'Stop this task',
  '停止': 'Stop',
  // Extensions / MCP
  '登录': 'Sign in',
  '登录中…': 'Signing in…',
  '重连': 'Reconnect',
  '重新连接此 MCP 服务器': 'Reconnect this MCP server',
  '来源：': 'Source: ',
  '没有可用的工具信息。': 'No tool information available.',
  '运行 claude mcp login': 'Run claude mcp login',
  '联网搜索（内置）': 'Web search (built-in)',
  '如果浏览器没有自动打开，请复制上方链接手动访问。':
    'If the browser did not open, copy the link above and open it manually.',
  '取消登录': 'Cancel sign-in',
  '已取消登录': 'Sign-in cancelled',
  '登录完成': 'Sign-in complete',
  '登录未完成': 'Sign-in did not complete',
  // Permission diffs
  '改动预览': 'Change preview',
  '允许后将按上方内容写入': 'Approved changes will be written as shown above',
  '改动过大，仅显示前 200 KB。': 'The change is too large; only the first 200 KB is shown.',
  '执行前需要你的许可。': 'This action needs your permission before it runs.',
  '联网搜索': 'Web search',
  // Web search settings
  '联网搜索（新会话生效）': 'Web search (applies to new chats)',
  '启用内置联网搜索': 'Enable built-in web search',
  '通过应用内置的 MCP 工具搜索网页；第三方 Anthropic 兼容接口也能使用。':
    'Search the web through the app built-in MCP tool; works with third-party Anthropic-compatible endpoints.',
  '搜索服务': 'Search provider',
  '实例地址': 'Instance URL',
  '接口地址（可选）': 'API endpoint (optional)',
  '留空使用官方地址': 'Leave empty to use the official endpoint',
  '可选，部分实例需要': 'Optional; required by some instances',
  '每次结果数': 'Results per search',
  '清除已保存的 Key': 'Clear saved key',
  '测试搜索': 'Test search',
  '测试中…': 'Testing…',
  '保存搜索设置': 'Save search settings',
  '联网搜索设置已保存，新会话生效': 'Web search settings saved; applies to new chats',
  '已清除搜索 API Key': 'Search API key cleared',
  '搜索测试失败': 'Search test failed',
  '当前配置不完整，新会话不会启用内置搜索；请填写实例地址或 API Key。':
    'This configuration is incomplete; built-in search will not start in new chats. Enter an instance URL or API key.',
  '无需密钥，适合直接开始；可能受频率限制。':
    'No API key required; may be rate limited.',
  '无需密钥；在 DuckDuckGo 受限的网络中可用。':
    'No API key required; works on networks where DuckDuckGo is blocked.',
  '无需密钥；适合中文网络和中文结果。':
    'No API key required; suited to Chinese networks and Chinese results.',
  '填写自建或可用的 SearXNG 地址，需开启 JSON 输出。':
    'Enter a SearXNG instance URL with JSON output enabled.',
  '需要 Tavily API Key，结果质量稳定。': 'Requires a Tavily API key.',
  '需要 Brave Search API Key。': 'Requires a Brave Search API key.',
  // Diagnostics and backups
  '诊断与备份': 'Diagnostics & backups',
  '导出诊断日志': 'Export diagnostics',
  '刷新备份': 'Refresh backups',
  '还没有会话备份。删除会话时应用会先写入备份。':
    'No chat backups yet. The app writes a backup before deleting a chat.',
  '备份仅包含 Claude Code 的会话记录，不会自动恢复或覆盖现有会话。诊断日志会自动脱敏常见的密钥格式。':
    'Backups contain only Claude Code transcripts and never restore or overwrite chats automatically. Diagnostics redact common secret formats.',
  '导出': 'Export',
  '导出中…': 'Exporting…',
  '预览': 'Preview',
  // Project directory / project home
  '项目': 'Projects',
  '项目目录': 'Project directory',
  '项目主页': 'Project home',
  '返回项目主页': 'Back to project home',
  '打开项目目录': 'Open project directory',
  '搜索项目文件内容': 'Search project file contents',
  '选择一个项目查看它的会话，或者添加新的项目文件夹。':
    'Choose a project to see its chats, or add a new project folder.',
  '添加项目': 'Add project',
  '搜索项目…': 'Search projects…',
  '没有匹配的项目。': 'No matching projects.',
  '还没有项目。添加一个项目文件夹开始。': 'No projects yet. Add a project folder to begin.',
  '从常用项目移除': 'Remove from recent projects',
  '会话由本地引擎保存，应用不会自动删除会话。':
    'Chats are saved by the local engine; the app never deletes them automatically.',
  '正在读取…': 'Loading…',
  '返回项目目录': 'Back to projects',
  '新对话': 'New chat',
  '搜索文件': 'Search files',
  '在系统中打开项目文件夹': 'Open project folder in the system',
  '刷新会话': 'Refresh chats',
  '搜索这个项目的会话…': 'Search chats in this project…',
  '没有匹配的会话。': 'No matching chats.',
  '这个项目还没有会话，开始一个新对话吧。':
    'This project has no chats yet. Start a new chat.',
  '未命名会话': 'Untitled chat',
  '复制/迁移': 'Copy/Move',
  '复制或迁移到其他项目': 'Copy or move to another project',
  '项目文件夹不存在': 'Project folder not found',
  '文件夹可能已被重命名或移动。重新定位后会复制旧会话到新位置，原记录仍保留在本机。':
    'The folder may have been renamed or moved. Relocating copies the old chats to the new location; the originals stay on this machine.',
  '重新定位文件夹': 'Relocate folder',
  '正在迁移…': 'Relocating…',
  '该项目还有运行中的任务，请先停止后再重新定位。':
    'This project still has a running task. Stop it before relocating.',
  // Copy / move dialog
  '复制 / 迁移会话': 'Copy / move chat',
  '「复制」会生成一个独立的新会话；「迁移」会在目标项目生成新会话，并把原会话从列表中隐藏（原记录仍保留在本机）。':
    '"Copy" creates an independent new chat; "Move" creates it in the target project and hides the original from the list (the original transcript stays on this machine).',
  '当前会话': 'Current chat',
  '目标项目': 'Target project',
  '选择其他文件夹': 'Choose another folder',
  '迁移中…': 'Moving…',
  '迁移到目标项目': 'Move to target project',
  '复制中…': 'Copying…',
  '复制为独立会话': 'Copy as independent chat',
  // Palette / accent
  '配色风格': 'Colour palette',
  '卡其暖色': 'Warm khaki',
  'Claude Code 风格': 'Claude Code style',
  '黑白': 'Monochrome',
  '中性灰阶': 'Neutral greys',
  '蓝白': 'Blue & white',
  '冷色工作台': 'Cool workspace',
  '绿白': 'Green & white',
  '柔和护眼': 'Soft on the eyes',
  '自定义强调色': 'Custom accent colour',
  '自定义': 'Custom',
  'AI 工作时长': 'AI work time',
  '实时输出速率': 'Live output rate',
  '需要你的确认': 'needs your approval',
  '联网搜索已开启（新会话生效）': 'Web search is on (applies to new chats)',
  '联网搜索已关闭（新会话生效）': 'Web search is off (applies to new chats)',
  // Subscriptions / accounts
  '订阅 / 账号': 'Subscriptions / accounts',
  'API 配置 / 订阅': 'API configuration / subscriptions',
  '模型': 'Model',
  '管理订阅和 API 配置。默认显示列表，点击“添加新配置”再展开编辑表单。':
    'Manage subscriptions and API configurations. The list is shown by default; click “Add configuration” to open the form.',
  '当前配置': 'Current configuration',
  '添加新配置': 'Add configuration',
  '编辑当前配置': 'Edit current configuration',
  '已保存的配置': 'Saved configurations',
  '还没有保存的配置。点击“添加新配置”开始。':
    'No saved configurations yet. Click “Add configuration” to start.',
  '编辑配置': 'Edit configuration',
  'Token 留空表示保留原 Token。': 'Leave Token empty to keep the existing token.',
  '填写供应商和 Token，保存后会设为当前配置。':
    'Choose a provider and enter a token; saving makes it the current configuration.',
  '配置名称': 'Configuration name',
  '问点什么，或描述要在这个项目中完成的任务…':
    'Ask something, or describe a task for this project…',
  '例如 Claude-Pro、公司账号': 'e.g. Claude-Pro or Work account',
  '新配置需要填写该供应商的 Token。': 'A new configuration needs a token for this provider.',
  '不知道模型？先点“测试并获取模型”，或直接填写供应商文档中的模型 ID。':
    'Not sure which model? Test and fetch models, or enter the model ID from the provider docs.',
  '保存配置': 'Save configuration',
  '保存后会设为当前配置；空闲会话会立即切换并保留上下文，运行中的会话继续原进程，新会话生效。':
    'Saving makes it the current configuration. An idle chat switches immediately with its context preserved; a running chat keeps its process and new chats use the new configuration.',
  '配置已保存并设为当前；新会话生效':
    'Configuration saved and set as current; applies to new chats.',
  '配置保存失败': 'Could not save the configuration',
  '未配置 Token': 'No token configured',
  '删除配置': 'Delete configuration',
  '同一个供应商可以保存多个订阅或 plan，每个档案使用自己的 token。也可以在模型下拉菜单中直接切换。切换会重启当前活动会话；其他新开会话使用新账号。':
    'Save multiple subscriptions or plans for the same provider, each with its own token. You can also switch from the model dropdown. Switching restarts the active chat; other new chats use the new account.',
  '还没有保存的订阅。': 'No saved subscriptions yet.',
  '当前': 'Current',
  '切换': 'Switch',
  '删除订阅': 'Delete subscription',
  '订阅名称，例如 GPT-Plus 或 Claude-Pro':
    'Subscription name, e.g. GPT-Plus or Claude-Pro',
  '保存为新订阅': 'Save as new subscription',
  '订阅已保存': 'Subscription saved',
  '更新当前订阅': 'Update current subscription',
  '当前订阅已更新': 'Current subscription updated',
  '还没有保存订阅': 'No saved subscriptions',
  '去设置里添加多个 token / plan': 'Add multiple tokens / plans in Settings',
  '管理订阅…': 'Manage subscriptions…',
  '请先停止当前任务再切换订阅': 'Stop the current task before switching subscriptions.',
  '切换订阅后重启会话失败：': 'The subscription switched, but restarting the chat failed: ',
  '新消息将使用新账号': 'New messages will use the new account.'
})

const PUNCTUATION: Record<string, string> = {
  '。': '.',
  '，': ', ',
  '：': ': ',
  '；': '; ',
  '！': '!',
  '？': '?',
  '（': ' (',
  '）': ') '
}

const PHRASE_RULES: Array<[RegExp, string]> = [
  [/^刚刚$/, 'just now'],
  [/^(\d+)\s*分钟前$/, '$1 min ago'],
  [/^(\d+)\s*小时前$/, '$1 hr ago'],
  [/^(\d+)\s*天前$/, '$1 d ago'],
  [/^(\d+)\s*次安装$/, '$1 installs'],
  [/^(\d+)\s*个工具$/, '$1 tools'],
  [/^(\d+)\s*个文件$/, '$1 files'],
  [/^(\d+)\s*个请求$/, '$1 requests'],
  [/^(\d+)\s*项任务$/, '$1 tasks'],
  [/^标签：(.+)$/, 'Tab: $1'],
  [/^Claude 需要你的回答：(.+)$/, 'Claude needs your answer: $1'],
  [/^还有\s*(\d+)\s*个请求$/, 'and $1 pending requests'],
  [/^已恢复\s*(\d+)\s*个文件$/, 'Restored $1 files'],
  [/^已恢复$/, 'Restored'],
  [/^(\d+)\/(\d+)$/, '$1/$2'],
  [/^(\d+)% 已使用$/, '$1% used'],
  [/^·\s*(\d[\d,]*)\s*次安装$/, '· $1 installs'],
  [/^运行中 · (\d+) 条排队$/, 'Running · $1 queued'],
  [/^已切换到订阅「(.+)」$/, 'Switched to subscription "$1"'],
  [/^已切换到配置「(.+)」$/, 'Switched to configuration "$1"'],
  [/^已切换到订阅「(.+)」，新消息将使用新账号$/, 'Switched to subscription "$1"; new messages use the new account.'],
  [/^(\d+) 条消息排队$/, '$1 messages queued'],
  [/^(\d+)\+? 个会话$/, '$1 chats'],
  [/^(\d+) 个会话 · 最近 (.+)$/, '$1 chats · last $2'],
  [/^连接成功，返回 (\d+) 条结果$/, 'Connected; $1 results'],
  [/^已导出到 (.+)$/, 'Exported to $1'],
  [/^诊断日志已导出到 (.+)$/, 'Diagnostics exported to $1'],
  [/^切换主题（当前：(.+)）$/, 'Switch theme (current: $1)'],
  [
    /^正在等待模型首 token… (\d+)s（上游响应慢时可继续等待或按停止）$/,
    "Waiting for the model's first token… $1s (the upstream may be slow; keep waiting or press Stop)"
  ],
  [/^模型正在思考… (\d+)s$/, 'Model is thinking… $1s'],
  [
    /^像管理文件夹一样多层收纳项目（共 (\d+) 个项目路径已完整保留）。可拖拽项目到文件夹或逐级点开。$/,
    'Organize projects in multi-level folders ($1 project paths preserved). Drag items into folders or click through.'
  ],
  [
    /^(\d+) 个子文件夹 · (\d+) 个直属项目$/,
    '$1 subfolders · $2 direct projects'
  ],
  [/^(\d+) 个项目$/, '$1 projects'],
  [/^(\d+) 个项目 · (\d+) 个子文件夹$/, '$1 projects · $2 subfolders'],
  [/^·\s*(\d+) 个子文件夹$/, '· $1 subfolders'],
  [/^位于：(.+)$/, 'In: $1'],
  [/^上级：(.+)$/, 'Parent: $1'],
  [/^提问目录 \((\d+)\)$/, 'Prompts ($1)'],
  [/^(\d+) 轮对话$/, '$1 turns'],
  [/^(\d{4}-\d{2}-\d{2})（(\d+) 轮）$/, '$1 ($2 turns)'],
  [/^局域网: (.+)$/, 'LAN: $1'],
  [/^公网隧道: (.+)$/, 'Public tunnel: $1'],
  [/^· 最新 (.+)$/, '· Latest $1']
]

const SKIP_SELECTOR = [
  '[data-i18n-skip]',
  '.markdown',
  '.user-bubble',
  '.user-message-wrap',
  '.tool-body',
  '.tool-output',
  '.tool-terminal',
  '.tool-args',
  '.tool-summary',
  '.tool-path',
  '.tool-file-head',
  '.diff-view',
  '.thinking-text',
  '.config-editor',
  '.file-text-editor',
  '.file-panel-path',
  '.file-tree',
  'pre',
  'code',
  'textarea',
  'input',
  'select',
  '.session-summary',
  '.about-command',
  '.background-logs',
  '.user-text',
  '.question-preview',
  '.rewind-files',
  '.code-block'
].join(',')

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const

let currentLanguage: Language = 'en'
let observer: MutationObserver | null = null
const originals = new Map<Node, string>()
const lastTranslated = new WeakMap<Node, string>()
const attributeOriginals = new Map<Element, Map<string, string>>()
const attributeTranslated = new WeakMap<Element, Map<string, string>>()

Object.assign(DICTIONARY, {
  // Remote access panel
  '远程访问': 'Remote access',
  '局域网访问': 'LAN access',
  '启用远程访问': 'Enable remote access',
  '端口': 'Port',
  '绑定地址': 'Bind address',
  '局域网（0.0.0.0）': 'LAN (0.0.0.0)',
  '仅本机（配合隧道）': 'Localhost only (for tunnels)',
  '账号': 'Username',
  '密码': 'Password',
  '已设置；输入新密码后点“修改密码”': 'Set; enter a new password and click "Change password"',
  '设置登录密码': 'Set login password',
  '修改密码': 'Change password',
  '保存远程访问设置': 'Save remote access settings',
  '局域网地址': 'LAN addresses',
  '服务器尚未启动或没有检测到局域网 IPv4 地址。':
    'The server is not running or no LAN IPv4 address was detected.',
  '启用远程访问后这里会显示手机可访问的地址。':
    'Once enabled, phone-accessible addresses appear here.',
  '手机与电脑需在同一 Wi-Fi；如果打不开，请检查电脑防火墙是否放行该端口。':
    'The phone and computer must be on the same Wi-Fi; if it does not load, check the computer firewall for this port.',
  '模式': 'Mode',
  'Quick Tunnel（临时地址）': 'Quick Tunnel (temporary URL)',
  'Named Tunnel（固定域名）': 'Named Tunnel (stable hostname)',
  'Tunnel 名称': 'Tunnel name',
  '配置文件': 'Config file',
  '公网域名': 'Public hostname',
  '状态': 'Status',
  '运行中': 'Running',
  '未运行': 'Not running',
  '停止隧道': 'Stop tunnel',
  '启动隧道': 'Start tunnel',
  '下载 cloudflared': 'Download cloudflared',
  '刷新状态': 'Refresh status',
  '未安装 cloudflared 时请先安装：': 'If cloudflared is not installed, install it first:',
  '仅本机模式：局域网不可直接访问；请使用 Cloudflare Tunnel 或改为局域网绑定。':
    'Localhost-only mode: the LAN cannot reach this server. Use Cloudflare Tunnel or switch the bind address to LAN.',
  '请先启用远程访问并保存，再启动隧道。':
    'Enable and save remote access before starting the tunnel.',
  '已连接设备': 'Connected devices',
  '暂无已连接设备。': 'No connected devices.',
  '令牌与密码只保存在这台电脑的应用数据目录（0600）。手机端不会收到 API Token。关闭远程访问后所有浏览器连接会立即断开。':
    'Tokens and passwords are stored only in the app data directory on this computer (0600). The phone never receives the API token. Disabling remote access disconnects all browser clients immediately.',
  '你正在通过浏览器访问。端口、绑定地址、密码和隧道启停只能在电脑端修改。':
    'You are accessing from a browser. Port, bind address, password, and tunnel controls can only be changed on the desktop.',
  '如果使用 Cloudflare Access，请先在同一浏览器完成 Access 登录，再打开隧道地址；登录重定向可能丢失 URL 中的临时信息。':
    'If using Cloudflare Access, complete the Access login in the same browser before opening the tunnel URL; the login redirect may drop temporary URL information.',
  '登录密码已更新。下次登录请使用新密码。':
    'Login password updated. Use the new password next time.',
  '请输入新密码后再保存。': 'Enter a new password before saving.',
  '远程访问设置已保存（密码未修改）。':
    'Remote access settings saved (password unchanged).',
  'Cloudflare Tunnel 已启动。': 'Cloudflare Tunnel started.',
  '已发送启动请求，正在等待 cloudflared 输出公网地址。':
    'Start requested; waiting for cloudflared to report a public URL.',
  'Cloudflare Tunnel 已停止。': 'Cloudflare Tunnel stopped.',
  '已复制。': 'Copied.',
  '正在下载 cloudflared…': 'Downloading cloudflared…',
  'cloudflared 已下载。': 'cloudflared downloaded.',
  '远程访问等同于在这台电脑上执行 Claude Code 工具。请使用强密码；公网访问建议使用 Cloudflare Tunnel，并启用 Cloudflare Access。':
    'Remote access is equivalent to running Claude Code tools on this computer. Use a strong password; for public access use Cloudflare Tunnel and enable Cloudflare Access.',
  '在同一局域网用手机浏览器操控这台电脑上的 3PI Desk，或通过 Cloudflare Tunnel 从公网访问。应用必须保持运行。':
    'Control 3PI Desk on this computer from a phone browser on the same LAN, or over the internet through Cloudflare Tunnel. The app must stay running.',
  'Remote access': 'Remote access',
  // Project home folders
  '新建文件夹': 'New folder',
  '新建子文件夹': 'New subfolder',
  '自定义文件夹': 'Customize folder',
  '自定义外观': 'Customize',
  '移动位置': 'Move',
  '删除文件夹': 'Delete folder',
  '删除文件夹（保留内部所有项目）': 'Delete folder (keeps all projects inside)',
  '全部项目': 'All projects',
  '文件夹路径': 'Folder path',
  '搜索所有文件夹与项目路径…': 'Search all folders and project paths…',
  '清除搜索': 'Clear search',
  '没有匹配的文件夹或项目。': 'No matching folders or projects.',
  '这个文件夹还是空的。可以新建子文件夹，或把项目移进来。':
    'This folder is empty. Create a subfolder or move projects here.',
  '还没有项目。添加一个项目文件夹或新建收纳文件夹开始。':
    'No projects yet. Add a project folder or create an organizing folder to start.',
  '添加项目到此位置': 'Add project here',
  '编辑名称、图标和颜色': 'Edit name, icon, and color',
  '移动到其他文件夹': 'Move to another folder',
  '收纳到文件夹': 'Move to folder',
  '收纳项目到文件夹': 'Move project to folder',
  '移动文件夹位置': 'Move folder',
  '移动到文件夹': 'Move to folder',
  '选择目标位置：': 'Select destination: ',
  '根目录（全部项目）': 'Root (All projects)',
  '位置：根目录（全部项目）': 'Location: Root (All projects)',
  '当前位置': 'Current',
  '未命名文件夹': 'Untitled folder',
  '文件夹名称': 'Folder name',
  '例如：前端项目、核心服务、实验': 'e.g. Frontend, Core Services, Experiments',
  '所在位置（支持多层嵌套）': 'Parent folder (supports multi-level nesting)',
  '像 ChatGPT 项目夹一样自定义名称、图标和颜色，并可放入任意上级文件夹实现多层收纳。':
    'Customize the name, icon, and color like ChatGPT project folders, and nest inside any parent folder.',
  '颜色': 'Color',
  '图标': 'Icon',
  '自定义': 'Custom',
  '自定义颜色': 'Custom color',
  '支持多层文件夹嵌套与拖拽归类；删除收纳文件夹时，内部项目会自动回到上一级，绝不会丢失路径。':
    'Supports multi-level folder nesting and drag-and-drop; deleting a folder moves its projects up one level and never loses any path.',
  '确定要删除文件夹「': 'Delete folder "',
  '」吗？该文件夹内的所有子文件夹和项目路径都会自动移回上一级目录，不会删除任何项目或会话。':
    '"? All subfolders and project paths inside will move up to the parent folder; no projects or chats will be deleted.',
  '文件夹': 'Folder',
  '代码': 'Code',
  '终端': 'Terminal',
  '工作': 'Work',
  '文档': 'Docs',
  '系统': 'System',
  '数据': 'Data',
  '架构': 'Layers',
  '发布': 'Release',
  '精选': 'Featured',
  '偏好': 'Favorites',
  '娱乐': 'Games',
  '工具': 'Tools',
  '安全': 'Security',
  '珊瑚橘': 'Coral',
  '琥珀黄': 'Amber',
  '森林绿': 'Forest green',
  '青碧色': 'Teal',
  '海蔚蓝': 'Ocean blue',
  '靛青色': 'Indigo',
  '紫罗兰': 'Purple',
  '玫红色': 'Pink',
  '朱砂红': 'Red',
  '岩石灰': 'Slate',
  // In-chat search, timeline, failover, git, rewind diff, qr, usage history
  '搜索对话': 'Search chat',
  '会话内搜索': 'Search in chat',
  '会话内搜索（Ctrl/Cmd + F）': 'Search in chat (Ctrl/Cmd + F)',
  '在当前对话中搜索（Enter 下一个）…': 'Search in this chat (Enter for next)…',
  '上一个匹配': 'Previous match',
  '下一个匹配': 'Next match',
  '关闭搜索': 'Close search',
  '提问目录导航': 'Prompt timeline',
  '本会话提问目录': 'Prompts in this chat',
  '选择备用配置档案': 'Select backup profile',
  '切换配置并重试': 'Switch profile & retry',
  '直接重试': 'Retry now',
  'Git 变更': 'Git changes',
  '当前目录不是 Git 仓库。': 'This directory is not a Git repository.',
  '工作区很干净，没有未提交的修改。': 'Working tree is clean; no uncommitted changes.',
  '审查未提交改动': 'Review changes',
  '生成提交信息': 'Generate commit message',
  '点击变更文件可直接查看 Git Diff 对比。': 'Click a changed file to view its Git diff.',
  '无法读取该文件。': 'Could not read this file.',
  '点击下方文件名可预览恢复前后的代码差异：':
    'Click a file name below to preview the diff before restoring:',
  '手机扫码免密直连': 'Scan QR code to connect',
  '远程访问二维码': 'Remote access QR code',
  '使用手机相机扫描上方二维码，将自动携带':
    'Scan the QR code above with your phone camera to connect with a',
  '5 分钟有效的一次性配对码': '5-minute one-time pairing token',
  '直接登录，无需在手机上手动输入长密码。':
    'automatically, without typing your password on the phone.',
  '刷新配对码': 'Refresh pairing code',
  '复制免密链接': 'Copy pairing link',
  '扫码配对码已过期或无效，请在电脑端刷新二维码。':
    'The QR pairing code expired or is invalid. Refresh the QR code on the desktop.',
  '本会话 Token 用量': 'Chat token usage',
  '当前没有打开的会话；下方显示本机累计历史用量。':
    'No active chat; cumulative local usage history is shown below.',
  '本机累计用量看板（近 7 天）': 'Local usage analytics (last 7 days)',
  '清空统计': 'Clear history',
  '今日估算费用 / Token': 'Today estimated cost / tokens',
  '近 7 天累计费用 / Token': 'Last 7 days cost / tokens',
  '暂无历史统计。每完成一轮对话后会自动按天、按模型、按项目累加到本地。':
    'No history yet. Completed turns are automatically tallied by day, model, and project.',
  '模型排行（近 7 天）': 'Top models (last 7 days)',
  '项目排行（近 7 天）': 'Top projects (last 7 days)',
  '费用 · Token': 'Cost · Tokens',
  '查看 GitHub 发布页': 'View GitHub releases'
})

const phraseEntries = Object.entries(DICTIONARY)
  .filter(([key]) => key.length > 1)
  .sort((a, b) => b[0].length - a[0].length)

function isTechnical(text: string): boolean {
  return (
    text.includes('/home/') ||
    text.includes('~/.claude') ||
    text.includes('~/.config') ||
    text.includes('deepseek-') ||
    text.includes('oc_sk_') ||
    text.includes('https://') ||
    text.includes('http://') ||
    text.includes('.json') ||
    text.includes('.jsonl') ||
    text.includes(' --') ||
    /^\/[^\s]+$/.test(text)
  )
}

export function translateText(input: string): string {
  if (currentLanguage === 'zh') return input
  if (!input) return input
  if (PUNCTUATION[input.trim()] && !/[\u4e00-\u9fff]/.test(input)) {
    const leading = input.match(/^\s*/)?.[0] || ''
    const trailing = input.match(/\s*$/)?.[0] || ''
    return leading + PUNCTUATION[input.trim()] + trailing
  }
  if (!/[\u4e00-\u9fff]/.test(input)) return input
  const leading = input.match(/^\s*/)?.[0] || ''
  const trailing = input.match(/\s*$/)?.[0] || ''
  const core = input.slice(leading.length, input.length - trailing.length)
  if (!core) return input
  if (DICTIONARY[core]) return leading + DICTIONARY[core] + trailing
  for (const [pattern, replacement] of PHRASE_RULES) {
    if (pattern.test(core)) return leading + core.replace(pattern, replacement) + trailing
  }
  if (isTechnical(core)) return input
  let result = core
  for (const [zh, en] of phraseEntries) {
    if (result.includes(zh)) result = result.split(zh).join(en)
  }
  result = result.replace(/。/g, '.').replace(/，/g, ', ').replace(/：/g, ': ')
  result = result.replace(/；/g, '; ').replace(/！/g, '!').replace(/？/g, '?')
  result = result.replace(/（/g, ' (').replace(/）/g, ') ')
  return leading + result + trailing
}

function shouldSkip(element: Element | null): boolean {
  return Boolean(element?.closest(SKIP_SELECTOR))
}

function shouldSkipAttribute(element: Element): boolean {
  if (element.matches('input, textarea, select')) {
    return Boolean(element.parentElement?.closest(SKIP_SELECTOR))
  }
  return shouldSkip(element)
}

function processTextNode(node: Node): void {
  if (!node.nodeValue || shouldSkip(node.parentElement)) return
  const current = node.nodeValue
  if (currentLanguage === 'zh') {
    const original = originals.get(node)
    if (original !== undefined && current !== original) {
      node.nodeValue = original
    }
    return
  }
  const last = lastTranslated.get(node)
  if (current === last) return
  const translated = translateText(current)
  if (translated !== current) {
    originals.set(node, current)
    node.nodeValue = translated
    lastTranslated.set(node, translated)
  } else {
    lastTranslated.set(node, current)
  }
}

function processAttribute(element: Element, attr: string): void {
  if (shouldSkipAttribute(element)) return
  const current = element.getAttribute(attr)
  if (current === null) return
  if (currentLanguage === 'zh') {
    const saved = attributeOriginals.get(element)?.get(attr)
    if (saved !== undefined && current !== saved) element.setAttribute(attr, saved)
    return
  }
  const translatedMap = attributeTranslated.get(element)
  const last = translatedMap?.get(attr)
  if (current === last) return
  const translated = translateText(current)
  if (translated !== current) {
    let originalsMap = attributeOriginals.get(element)
    if (!originalsMap) {
      originalsMap = new Map()
      attributeOriginals.set(element, originalsMap)
    }
    originalsMap.set(attr, current)
    element.setAttribute(attr, translated)
    let map = attributeTranslated.get(element)
    if (!map) {
      map = new Map()
      attributeTranslated.set(element, map)
    }
    map.set(attr, translated)
  } else {
    let map = attributeTranslated.get(element)
    if (!map) {
      map = new Map()
      attributeTranslated.set(element, map)
    }
    map.set(attr, current)
  }
}

function walk(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    processTextNode(root)
    return
  }
  if (!(root instanceof Element)) return
  if (!shouldSkipAttribute(root)) {
    for (const attr of ATTRS) {
      if (root.hasAttribute(attr)) processAttribute(root, attr)
    }
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    processTextNode(node)
    node = walker.nextNode()
  }
  for (const element of root.querySelectorAll('[placeholder],[title],[aria-label],[alt]')) {
    for (const attr of ATTRS) {
      if (element.hasAttribute(attr)) processAttribute(element, attr)
    }
  }
}

let pendingAdded = new Set<Node>()
let walkScheduled = false

function flushAddedNodes(): void {
  walkScheduled = false
  const roots = [...pendingAdded]
  pendingAdded.clear()
  // In Chinese mode the source strings are already correct; only the
  // English presentation needs the translator.
  if (currentLanguage === 'zh') return
  const top = roots.filter(
    (root) => !roots.some((other) => other !== root && other.contains(root))
  )
  for (const root of top) {
    if (root.isConnected) walk(root)
  }
}

function enqueueWalk(root: Node): void {
  pendingAdded.add(root)
  if (walkScheduled) return
  walkScheduled = true
  requestAnimationFrame(flushAddedNodes)
}

function applyLanguage(language: Language): void {
  const previous = currentLanguage
  currentLanguage = language
  if (!document.body) return
  if (language === 'zh') {
    for (const [node, original] of originals) {
      if (node.nodeValue !== original) node.nodeValue = original
    }
    for (const [element, values] of attributeOriginals) {
      for (const [attr, original] of values) {
        if (element.getAttribute(attr) !== original) element.setAttribute(attr, original)
      }
    }
    return
  }
  if (previous === 'zh') {
    for (const [node, original] of originals) {
      if (node.nodeValue === original) node.nodeValue = original
    }
  }
  walk(document.body)
}

export function startI18n(initial: Language): void {
  currentLanguage = initial
  if (!document.body) return
  walk(document.body)
  observer?.disconnect()
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        processTextNode(mutation.target)
      } else if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) enqueueWalk(node)
      } else if (mutation.type === 'attributes' && mutation.attributeName) {
        if (ATTRS.includes(mutation.attributeName as (typeof ATTRS)[number])) {
          processAttribute(mutation.target as Element, mutation.attributeName)
        }
      }
    }
  })
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS]
  })
}

export function setI18nLanguage(language: Language): void {
  applyLanguage(language)
}

export function initialLanguage(): Language {
  const saved = localStorage.getItem('3pi-language') || localStorage.getItem('claude-desk-language')
  return saved === 'zh' ? 'zh' : 'en'
}

/**
 * Render-time translation helper. Use `t('中文文本')` in frequently updating
 * components to translate directly during React render without waiting for a
 * MutationObserver cycle.
 */
export function t(input: string): string {
  return translateText(input)
}

