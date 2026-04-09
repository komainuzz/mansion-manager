'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/dashboard',             label: '概要',         icon: '📊' },
  { href: '/dashboard/rooms',       label: '部屋管理',     icon: '🏠' },
  { href: '/dashboard/reservations',label: '予約管理',     icon: '📅' },
  { href: '/dashboard/calendar',    label: '稼働カレンダー', icon: '🗓️' },
  { href: '/dashboard/simulation',  label: 'シミュレーション', icon: '📈' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 min-h-screen bg-slate-900 text-white flex flex-col">
      <div className="px-5 py-5 border-b border-slate-700">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">管理システム</p>
        <h1 className="text-lg font-bold mt-0.5">マンション管理</h1>
      </div>
      <nav className="flex-1 py-4 space-y-0.5 px-2">
        {NAV.map(({ href, label, icon }) => {
          const active = href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
            >
              <span>{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-500">
        v1.0.0
      </div>
    </aside>
  )
}
