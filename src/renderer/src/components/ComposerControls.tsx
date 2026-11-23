import {
  Check,
  Gauge,
  Globe2,
  KeyRound,
  Settings2,
  ListFilter,
  ListTree,
  MessageSquare,
  Shield,
  ShieldAlert,
  Sparkles,
  User
} from 'lucide-react'
import type {
  ApiProfile,
  EffortSetting,
  ModelOption,
  PermissionMode
} from '../../../shared/types'
import { providerDisplayName } from '../../../shared/providers'
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
  webSearchEnabled: boolean
  profiles?: ApiProfile[]
  activeProfileId?: string
  dropdownDirection?: 'up' | 'down'
  dropdownAlign?: 'left' | 'right'
  showViewControls?: boolean
  onModelChange: (model: string) => void
  onEffortChange: (effort: EffortSetting) => void
  onPermissionModeChange: (mode: PermissionMode) => void
  onToggleWebSearch: () => void
  onSelectProfile?: (id: string) => void
  onManageProfiles?: () => void
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
  webSearchEnabled,
  profiles = [],
  activeProfileId,
  dropdownDirection = 'up',
  dropdownAlign = 'right',
  showViewControls = true,
  onModelChange,
  onEffortChange,
  onPermissionModeChange,
  onToggleWebSearch,
  onSelectProfile,
  onManageProfiles,
  onViewModeChange,
  onUserOnlyChange
}: ComposerControlsProps) {
  const selectedModel = findModel(models, model)
  const modelLabel = selectedModel?.name || model
  const activeProfileName = profiles.find(
    (profile) => profile.id === activeProfileId
  )?.name
  const orderedModels = [...models]
  if (model && !orderedModels.some((option) => option.id === model)) {
    orderedModels.unshift({ id: model, name: model })
  }
  orderedModels.sort((a, b) =>
    a.id === model ? -1 : b.id === model ? 1 : 0
  )
  const orderedProfiles = [...profiles].sort((a, b) =>
    a.id === activeProfileId ? -1 : b.id === activeProfileId ? 1 : 0
  )
  const supportedEfforts = selectedModel?.effortLevels || []
  const effortLabel =
    EFFORT_OPTIONS.find((option) => option.id === effort)?.label || '默认'
  const mode = PERMISSION_OPTIONS.find((option) => option.id === permissionMode)
  const ModeIcon = mode?.danger ? ShieldAlert : Shield

  return (
    <div className="composer-controls">
      {showViewControls && (
        <div className="composer-controls-group composer-view-controls">
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
      )}

      <div className="composer-controls-group">
        <Dropdown
          direction={dropdownDirection}
          align={dropdownAlign}
          menuClassName="model-picker-menu"
          trigger={
            <>
              <Sparkles size={14} />
              <span>{modelLabel}</span>
              {activeProfileName && (
                <>
                  <span className="chip-separator">·</span>
                  <span className="chip-profile" data-i18n-skip>
                    {activeProfileName}
                  </span>
                </>
              )}
            </>
          }
        >
          <div className="model-picker-box">
            <div className="model-picker-box-head">
              <KeyRound size={12} /> API 配置 / 订阅
            </div>
            <div className="model-picker-box-list">
              {profiles.length === 0 && (
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => onManageProfiles?.()}
                >
                  <span>还没有保存订阅</span>
                  <small>去设置里添加多个 token / plan</small>
                </button>
              )}
              {orderedProfiles.map((profile) => {
                const active = profile.id === activeProfileId
                return (
                  <button
                    key={profile.id}
                    type="button"
                    className={`dropdown-item profile-item ${active ? 'is-selected' : ''}`}
                    onClick={() => {
                      if (!active) onSelectProfile?.(profile.id)
                    }}
                    title={profile.baseUrl}
                  >
                    <span>
                      {active && <Check size={12} />}
                      <span data-i18n-skip>{profile.name}</span>
                    </span>
                    <small>
                      {providerDisplayName(profile.providerId || profile.baseUrl)} ·{' '}
                      {profile.model}
                    </small>
                  </button>
                )
              })}
              <button
                type="button"
                className="dropdown-item"
                onClick={() => onManageProfiles?.()}
              >
                <Settings2 size={12} />
                <span>管理订阅…</span>
              </button>
            </div>
          </div>

          <div className="model-picker-box">
            <div className="model-picker-box-head">
              <Sparkles size={12} /> 模型
            </div>
            <div className="model-picker-box-list">
              {orderedModels.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`dropdown-item model-item ${option.id === model ? 'is-selected' : ''}`}
                  onClick={() => onModelChange(option.id)}
                  title={option.description}
                >
                  <span>
                    {option.id === model && <Check size={11} />}
                    {option.name}
                  </span>
                  <small>
                    {option.description || option.id}
                    {option.contextWindow
                      ? ` · 上下文 ${formatTokens(option.contextWindow)}`
                      : ''}
                  </small>
                </button>
              ))}
            </div>
          </div>
        </Dropdown>

        {supportedEfforts.length > 0 && (
          <Dropdown
            direction={dropdownDirection}
            align={dropdownAlign}
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

        <button
          type="button"
          className={`chip control-chip ${webSearchEnabled ? 'is-active' : ''}`}
          onClick={onToggleWebSearch}
          title={webSearchEnabled ? '联网搜索已开启（新会话生效）' : '联网搜索已关闭（新会话生效）'}
          aria-pressed={webSearchEnabled}
        >
          <Globe2 size={14} />
          <span>联网搜索</span>
        </button>

        <Dropdown
          direction={dropdownDirection}
          align={dropdownAlign}
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
