import { Plus, X } from 'lucide-react'
import type { TabView } from '../types'

interface TabBarProps {
  tabs: Record<string, TabView>
  tabOrder: string[]
  activeTabId: string
  onActivate: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
}

export function TabBar({
  tabs,
  tabOrder,
  activeTabId,
  onActivate,
  onClose,
  onNew
}: TabBarProps) {
  if (tabOrder.length === 0) return null

  return (
    <div className="tabbar">
      <div className="tabbar-tabs">
        {tabOrder.map((id) => {
          const tab = tabs[id]
          if (!tab) return null
          const permission = tab.permissions.length > 0
          const active = id === activeTabId
          return (
            <div
              key={id}
              role="button"
              tabIndex={0}
              className={`tab ${active ? 'is-active' : ''}`}
              onClick={() => onActivate(id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onActivate(id)
                }
              }}
              title={tab.title}
            >
              <span
                className={`tab-dot ${
                  permission
                    ? 'tab-dot-permission'
                    : tab.state.running || tab.state.connecting
                      ? 'tab-dot-running'
                      : ''
                }`}
              />
              <span
                className="tab-title"
                data-i18n-skip={tab.title !== '新对话' ? 'true' : undefined}
              >
                {tab.title}
              </span>
              <button
                type="button"
                className="tab-close"
                aria-label="关闭标签"
                title="关闭标签"
                onClick={(event) => {
                  event.stopPropagation()
                  onClose(id)
                }}
              >
                <X size={12} />
              </button>
            </div>
          )
        })}
      </div>
      <button type="button" className="tab-new" onClick={onNew} title="新建标签">
        <Plus size={14} />
      </button>
    </div>
  )
}
