'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from './LogoutButton'
import {
  LayoutDashboard,
  Building2,
  CalendarDays,
  CalendarRange,
  TrendingUp,
  BarChart2,
  ShieldCheck,
  Zap,
} from 'lucide-react'

const NAV: { href: string; label: string; Icon: React.ElementType }[] = [
  { href: '/dashboard',                     label: '概要',           Icon: LayoutDashboard },
  { href: '/dashboard/rooms',               label: '部屋管理',       Icon: Building2 },
  { href: '/dashboard/reservations',        label: '予約管理',       Icon: CalendarDays },
  { href: '/dashboard/calendar',            label: '稼働カレンダー', Icon: CalendarRange },
  { href: '/dashboard/utilities',           label: '光熱費入力',     Icon: Zap },
  { href: '/dashboard/simulation',          label: '投資回収',       Icon: TrendingUp },
  { href: '/dashboard/simulation/forecast', label: '収支予測',       Icon: BarChart2 },
]

interface Props {
  userEmail?: string
  isAdmin?: boolean
}

export default function Sidebar({ userEmail, isAdmin }: Props) {
  const pathname = usePathname()

  return (
    <aside className="w-56 h-screen sticky top-0 bg-slate-900 text-white flex flex-col overflow-y-auto shrink-0">
      <div className="px-5 py-5 border-b border-slate-700">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">管理システム</p>
        <h1 className="text-lg font-bold mt-0.5">マンスリー管理</h1>
      </div>

      <nav className="flex-1 py-4 space-y-0.5 px-2">
        {NAV.map(({ href, label, Icon }) => {
          const active =
            href === '/dashboard'
              ? pathname === '/dashboard'
              : href === '/dashboard/simulation'
                ? pathname === '/dashboard/simulation'
                : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      {isAdmin && (
        <div className="px-2 pb-2">
          <Link
            href="/dashboard/admin"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              pathname.startsWith('/dashboard/admin')
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <ShieldCheck size={16} />
            ユーザー承認
          </Link>
        </div>
      )}

      <div className="px-2 py-3 border-t border-slate-700 space-y-1">
        {userEmail && (
          <div className="px-3 py-2">
            <p className="text-xs text-slate-500">ログイン中</p>
            <p className="text-xs text-slate-300 truncate mt-0.5">{userEmail}</p>
          </div>
        )}
        <LogoutButton />
      </div>
    </aside>
  )
}
