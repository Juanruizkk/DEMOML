import './PageHeader.css'

interface Stat {
  label: string
  value: number | string
  color?: 'amber' | 'emerald' | 'rose' | 'blue' | 'dim'
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  stats?: Stat[]
  actions?: React.ReactNode
}

export default function PageHeader({ title, subtitle, stats, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header-left">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      <div className="page-header-right">
        {stats && stats.map(s => (
          <div key={s.label} className={`stat-chip stat-chip--${s.color || 'dim'}`}>
            <span className="stat-value tabular">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
        {actions}
      </div>
    </header>
  )
}
