import { ReactNode } from 'react'
import Sidebar from './Sidebar'
import './Layout.css'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">{children}</main>
    </div>
  )
}
