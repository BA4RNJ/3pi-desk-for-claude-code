import type { PermissionMode, EffortSetting } from './types'

export const PERMISSION_OPTIONS: Array<{
  id: PermissionMode
  label: string
  description: string
  danger?: boolean
}> = [
  { id: 'default', label: '每次询问', description: '执行工具前请求确认' },
  { id: 'acceptEdits', label: '自动接受编辑', description: '文件修改无需确认' },
  { id: 'plan', label: '计划模式', description: '只分析，不执行修改' },
  {
    id: 'bypassPermissions',
    label: '跳过所有确认',
    description: '危险：所有工具直接执行',
    danger: true
  }
]

export const EFFORT_OPTIONS: Array<{ id: EffortSetting; label: string }> = [
  { id: 'default', label: '默认' },
  { id: 'low', label: '低' },
  { id: 'medium', label: '中' },
  { id: 'high', label: '高' },
  { id: 'xhigh', label: '极高' },
  { id: 'max', label: '最大' }
]

export const FALLBACK_COMMANDS = [
  { name: 'compact', description: '压缩当前上下文', argumentHint: '[instructions]' },
  { name: 'clear', description: '清空当前会话上下文' },
  { name: 'status', description: '查看当前会话状态' },
  { name: 'context', description: '查看上下文占用明细' },
  { name: 'cost', description: '查看本次会话用量与费用' },
  { name: 'init', description: '为项目生成 CLAUDE.md' },
  { name: 'review', description: '审查当前改动或 PR' },
  { name: 'export', description: '导出当前对话' },
  { name: 'rewind', description: '回退文件或对话' },
  { name: 'model', description: '查看或切换模型' },
  { name: 'mcp', description: '查看 MCP 服务器状态' },
  { name: 'agents', description: '查看子代理' },
  { name: 'skills', description: '查看可用技能' },
  { name: 'hooks', description: '查看已配置 Hooks' },
  { name: 'doctor', description: '检查引擎安装状态' },
  { name: 'help', description: '查看帮助' }
]

