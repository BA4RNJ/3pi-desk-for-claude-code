import {
  Gauge,
  ListFilter,
  ListTree,
  MessageSquare,
  Shield,
  ShieldAlert,
  Sparkles,
  User
} from 'lucide-react'
import type { EffortSetting, ModelOption, PermissionMode } from '../../../shared/types'
import { EFFORT_OPTIONS, PERMISSION_OPTIONS } from '../hooks/useDesk'
import { formatTokens } from '../lib/format'
import { findModel } from '../lib/usage'
import { Dropdown } from './Dropdown'

export type ChatViewMode = 'detail' | 'compact'

interface ComposerControlsProps {
  model: string
  models: ModelOption[]
  effort: EffortSetting
  permissionMode: PermissionMode
  viewMode: ChatViewMode
  userOnly: boolean
  onModelChange: (model: string) => void
  onEffortChange: (effort: EffortSetting) => void
  onPermissionModeChange: (mode: PermissionMode) => void
  onViewModeChange: (mode: ChatViewMode) => void
  onUserOnlyChange: (value: boolean) => void
}

export function ComposerControls({
  model,
  models,
  effort,
  permissionMode,
  viewMode,
  userOnly,
  onModelChange,
  onEffortChange,
  onPermissionModeChange,
  onViewModeChange,
  onUserOnlyChange
}: ComposerControlsProps) {
  const selectedModel = findModel(models, model)
  const modelLabel = selectedModel?.name || model
  const supportedEfforts = selectedModel?.effortLevels || []
  const effortLabel =
    EFFORT_OPTIONS.find((option) => option.id === effort)?.label || '默认'
  const mode = PERMISSION_OPTIONS.find((option) => option.id === permissionMode)
  const ModeIcon = mode?.danger ? ShieldAlert : Shield

  return (
    <div className="composer-controls">
      <div className="composer-controls-group">
        <button
          type="button"
          className="chip control-chip"
          onClick={() => onViewModeChange(viewMode === 'compact' ? 'detail' : 'compact')}
          title="切换简洁/详细模式"
        >
          {viewMode === 'compact' ? <ListTree size={14} /> : <ListFilter size={14} />}
          <span>{viewMode === 'compact' ? '详细模式' : '简洁模式'}</span>
        </button>
        <button
          type="button"
          className={`chip control-chip ${userOnly ? 'is-active' : ''}`}
          onClick={() => onUserOnlyChange(!userOnly)}
          title="切换用户 / 全部消息"
          aria-pressed={userOnly}
        >
          {userOnly ? <User size={14} /> : <MessageSquare size={14} />}
          <span>{userOnly ? '用户' : '全部'}</span>
        </button>
      </div>

      <div className="composer-controls-group">
        <Dropdown
          direction="up"
          trigger={
            <>
              <Sparkles size={14} />
              <span>{modelLabel}</span>
            </>
          }
        >
          {models.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`dropdown-item model-item ${option.id === model ? 'is-selected' : ''}`}
              onClick={() => onModelChange(option.id)}
              title={option.description}
            >
              <span>{option.name}</span>
              <small>
                {option.description || option.id}
                {option.contextWindow
                  ? ` · 上下文 ${formatTokens(option.contextWindow)}`
                  : ''}
              </small>
            </button>
          ))}
        </Dropdown>

        {supportedEfforts.length > 0 && (
          <Dropdown
            direction="up"
            trigger={
              <>
                <Gauge size={14} />
                <span>强度 {effortLabel}</span>
              </>
            }
          >
            {EFFORT_OPTIONS.filter(
              (option) =>
                option.id === 'default' || supportedEfforts.includes(option.id)
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                className={`dropdown-item ${option.id === effort ? 'is-selected' : ''}`}
                onClick={() => onEffortChange(option.id)}
              >
                <span>{option.label}</span>
                <small>
                  {option.id === 'default' ? '由模型自动决定' : `effort=${option.id}`}
                </small>
              </button>
            ))}
          </Dropdown>
        )}

        <Dropdown
          direction="up"
          trigger={
            <>
              <ModeIcon size={14} className={mode?.danger ? 'danger-icon' : ''} />
              <span>{mode?.label || '权限模式'}</span>
            </>
          }
        >
          {PERMISSION_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`dropdown-item ${option.id === permissionMode ? 'is-selected' : ''}`}
              onClick={() => onPermissionModeChange(option.id)}
            >
              <span className={option.danger ? 'danger-text' : ''}>{option.label}</span>
              <small>{option.description}</small>
            </button>
          ))}
        </Dropdown>
      </div>
    </div>
  )
}
