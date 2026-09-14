import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import './PaginationControls.css'

export interface PaginationMetadata {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface PaginationControlsProps {
  pagination: PaginationMetadata
  onPageChange: (page: number) => void
  onLimitChange?: (limit: number) => void
  itemName?: string
  pageSizeOptions?: number[]
}

export default function PaginationControls({
  pagination,
  onPageChange,
  onLimitChange,
  itemName = 'elementos',
  pageSizeOptions = [10, 20, 50],
}: PaginationControlsProps) {
  const { page, limit, total, totalPages, hasNext, hasPrev } = pagination

  if (total === 0) {
    return null
  }

  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  // Generate page numbers to display (sliding window of up to 5 numbers)
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      if (page <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages)
      } else if (page >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
      } else {
        pages.push(1, '...', page - 1, page, page + 1, '...', totalPages)
      }
    }
    return pages
  }

  return (
    <div className="pagination-bar glass-panel">
      <div className="pagination-info">
        <span className="pagination-range">
          Mostrando <strong>{start}</strong> - <strong>{end}</strong> de{' '}
          <strong>{total}</strong> {itemName}
        </span>
        {onLimitChange && (
          <div className="pagination-limit-picker">
            <span className="limit-label">Por pág:</span>
            <select
              className="limit-select"
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="pagination-actions">
        <button
          className="page-btn page-btn-icon"
          onClick={() => onPageChange(1)}
          disabled={!hasPrev || page === 1}
          title="Primera página"
        >
          <ChevronsLeft size={16} />
        </button>

        <button
          className="page-btn page-btn-icon"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          title="Página anterior"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="page-numbers">
          {getPageNumbers().map((p, idx) =>
            typeof p === 'number' ? (
              <button
                key={idx}
                className={`page-btn page-num${page === p ? ' active' : ''}`}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            ) : (
              <span key={idx} className="page-ellipsis">
                {p}
              </span>
            )
          )}
        </div>

        <button
          className="page-btn page-btn-icon"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          title="Página siguiente"
        >
          <ChevronRight size={16} />
        </button>

        <button
          className="page-btn page-btn-icon"
          onClick={() => onPageChange(totalPages)}
          disabled={!hasNext || page === totalPages}
          title="Última página"
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  )
}
