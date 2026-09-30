import React from 'react'
import './UnifiedKpiGrid.css'

export interface KpiItem {
  id?: string
  title: string
  value: number | string
  subtitle?: string
  icon: React.ReactNode
  colorVariant: 'blue' | 'amber' | 'emerald' | 'rose' | 'purple'
  badge?: {
    text: string
    variant?: 'warning' | 'success' | 'info' | 'danger' | 'neutral'
  }
  onClick?: () => void
}

interface UnifiedKpiGridProps {
  items: KpiItem[]
  columns?: 2 | 3 | 4
  className?: string
}

export default function UnifiedKpiGrid({
  items,
  columns = 4,
  className = '',
}: UnifiedKpiGridProps) {
  return (
    <div className={`unified-kpi-grid cols-${columns} ${className}`}>
      {items.map((item, index) => {
        const isClickable = Boolean(item.onClick)
        return (
          <div
            key={item.id || index}
            className={`unified-kpi-card variant-${item.colorVariant}${
              isClickable ? ' is-clickable' : ''
            }`}
            onClick={item.onClick}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
          >
            <div className="kpi-top-row">
              <span className="kpi-title">{item.title}</span>
              <div className={`kpi-icon-bubble bubble-${item.colorVariant}`}>
                {item.icon}
              </div>
            </div>

            <div className="kpi-value-row">
              <span className="kpi-value">{item.value}</span>
              {item.badge && (
                <span
                  className={`kpi-badge badge-${
                    item.badge.variant || 'neutral'
                  }`}
                >
                  {item.badge.text}
                </span>
              )}
            </div>

            {item.subtitle && (
              <div className="kpi-subtitle-row">
                <span className="kpi-subtitle">{item.subtitle}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
