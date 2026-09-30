import React from 'react'
import './UnifiedTabNav.css'

export interface UnifiedTab {
  id: string
  label: string
  icon?: React.ReactNode
  count?: number
  colorVariant?: 'amber' | 'emerald' | 'blue' | 'rose' | 'purple' | 'neutral'
  alertDot?: boolean
  disabled?: boolean
}

interface UnifiedTabNavProps {
  tabs: UnifiedTab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  extraRightContent?: React.ReactNode
  className?: string
}

export default function UnifiedTabNav({
  tabs,
  activeTab,
  onTabChange,
  extraRightContent,
  className = '',
}: UnifiedTabNavProps) {
  return (
    <div className={`unified-tab-nav-container ${className}`}>
      <div className="unified-tabs-track" role="tablist">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const variant = tab.colorVariant || 'blue'

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              disabled={tab.disabled}
              className={`unified-tab-btn tab-variant-${variant}${
                isActive ? ' is-active' : ''
              }`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.alertDot && <span className="tab-alert-dot" />}
              {tab.icon && <span className="tab-icon">{tab.icon}</span>}
              <span className="tab-label">{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`tab-count-pill${
                    tab.count > 0 ? ' has-count' : ' is-zero'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {extraRightContent && (
        <div className="unified-tabs-extra">{extraRightContent}</div>
      )}
    </div>
  )
}
