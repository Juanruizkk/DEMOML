import React, { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import './MonthPicker.css'

interface MonthPickerProps {
  value: string // 'YYYY-MM' format
  onChange: (val: string) => void
  className?: string
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const MONTH_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
]

export default function MonthPicker({ value, onChange, className = '' }: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Parse YYYY-MM
  const parts = (value || '').split('-')
  const currentYear = parseInt(parts[0], 10) || new Date().getFullYear()
  const currentMonthIdx = (parseInt(parts[1], 10) || 1) - 1

  const [viewYear, setViewYear] = useState<number>(currentYear)

  // Current real date
  const now = new Date()
  const thisYear = now.getFullYear()
  const thisMonthIdx = now.getMonth()
  const currentMonthStr = `${thisYear}-${String(thisMonthIdx + 1).padStart(2, '0')}`
  const isCurrentSelected = value === currentMonthStr

  // Sync viewYear when value changes
  useEffect(() => {
    setViewYear(currentYear)
  }, [currentYear])

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelectMonth = (monthIdx: number) => {
    const formatted = `${viewYear}-${String(monthIdx + 1).padStart(2, '0')}`
    onChange(formatted)
    setIsOpen(false)
  }

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    let y = currentYear
    let m = currentMonthIdx - 1
    if (m < 0) {
      m = 11
      y -= 1
    }
    onChange(`${y}-${String(m + 1).padStart(2, '0')}`)
  }

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    let y = currentYear
    let m = currentMonthIdx + 1
    if (m > 11) {
      m = 0
      y += 1
    }
    onChange(`${y}-${String(m + 1).padStart(2, '0')}`)
  }

  const handleSetCurrentMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(currentMonthStr)
    setViewYear(thisYear)
  }

  const displayLabel = `${MONTH_NAMES[currentMonthIdx] || ''} ${currentYear}`

  return (
    <div className={`month-picker-container ${className}`} ref={containerRef}>
      <div className="month-picker-nav-group">
        {/* Previous Month Arrow */}
        <button
          type="button"
          className="month-picker-arrow-btn"
          onClick={handlePrevMonth}
          title="Mes anterior"
          aria-label="Mes anterior"
        >
          <ChevronLeft size={14} />
        </button>

        {/* Trigger Button */}
        <button
          type="button"
          className={`month-picker-trigger-btn ${isOpen ? 'is-active' : ''}`}
          onClick={() => {
            setViewYear(currentYear)
            setIsOpen(!isOpen)
          }}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
        >
          <Calendar size={13} className="picker-cal-icon" />
          <span className="picker-selected-text">{displayLabel}</span>
          <ChevronDown size={13} className={`picker-chevron-icon ${isOpen ? 'is-rotated' : ''}`} />
        </button>

        {/* Next Month Arrow */}
        <button
          type="button"
          className="month-picker-arrow-btn"
          onClick={handleNextMonth}
          title="Mes siguiente"
          aria-label="Mes siguiente"
        >
          <ChevronRight size={14} />
        </button>

        {/* Quick Current Month Button */}
        {!isCurrentSelected && (
          <button
            type="button"
            className="month-picker-today-btn"
            onClick={handleSetCurrentMonth}
            title="Ir a este mes"
          >
            Este mes
          </button>
        )}
      </div>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="month-picker-popover" role="dialog" aria-label="Seleccionar mes">
          {/* Year Navigator */}
          <div className="month-picker-year-row">
            <button
              type="button"
              className="year-nav-btn"
              onClick={() => setViewYear(viewYear - 1)}
              title="Año anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="view-year-label">{viewYear}</span>
            <button
              type="button"
              className="year-nav-btn"
              onClick={() => setViewYear(viewYear + 1)}
              title="Año siguiente"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Months Grid */}
          <div className="months-grid">
            {MONTH_SHORT.map((name, idx) => {
              const isSelected = viewYear === currentYear && idx === currentMonthIdx
              const isThisMonth = viewYear === thisYear && idx === thisMonthIdx

              return (
                <button
                  key={name}
                  type="button"
                  className={`month-grid-btn ${isSelected ? 'is-selected' : ''} ${isThisMonth ? 'is-this-month' : ''}`}
                  onClick={() => handleSelectMonth(idx)}
                >
                  <span>{name}</span>
                  {isThisMonth && !isSelected && <span className="current-month-indicator" />}
                </button>
              )
            })}
          </div>

          {/* Quick Footer */}
          <div className="month-picker-popover-footer">
            <button
              type="button"
              className="popover-footer-btn"
              onClick={() => {
                onChange(currentMonthStr)
                setViewYear(thisYear)
                setIsOpen(false)
              }}
            >
              Mes Actual ({MONTH_SHORT[thisMonthIdx]} {thisYear})
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
