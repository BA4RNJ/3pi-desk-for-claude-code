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
  "当前是本地构建，未配置发布源，因此应用不会自动下载安装包。更新 SDK 后重新打包即可；Claude Code CLI 的版本由 SDK 内置。": "This is a local build without a release feed, so it cannot auto-update. Update the SDK and rebuild; the Claude Code CLI version is bundled with the SDK.",
  "常规": "General",
  "外观": "Appearance",
  "外观、集成与会话预算。": "Appearance, integrations, and session budget.",
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
  "全局快捷键": "Global shortcut",
  "Ctrl/Cmd + Shift + Space 显示窗口（Wayland 下可能不可用）。": "Ctrl/Cmd + Shift + Space shows the window (may not work on Wayland).",
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
  'AI 编程工作台 · v0.4.0': 'AI coding workspace · v0.4.0',
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
  '当前是本地构建，未配置发布源，因此应用不会自动下载安装包。更新 SDK 后重新打包即可；引擎版本由 SDK 内置。':
    'This is a local build without a release feed, so it cannot auto-update. Update the SDK and rebuild; the engine version is bundled with the SDK.',
  '检查引擎安装状态': 'Check engine installation',
  'AI 会话': 'AI chat',
  '已完成规划，批准后将开始执行。': 'Planning is complete; execution starts after approval.',
  '已完成规划，批准后将开始执行': 'Planning is complete; execution starts after approval'
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
  [/^还有\s*(\d+)\s*个请求$/, 'and $1 pending requests'],
  [/^已恢复\s*(\d+)\s*个文件$/, 'Restored $1 files'],
  [/^已恢复$/, 'Restored'],
  [/^(\d+)\/(\d+)$/, '$1/$2'],
  [/^(\d+)% 已使用$/, '$1% used'],
  [/^·\s*(\d[\d,]*)\s*次安装$/, '· $1 installs']
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
