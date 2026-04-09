import { supabase } from '@/lib/supabase'
import type { Room, Reservation } from '@/types'
import {
  formatCurrency, formatYearMonth, currentYearMonth,
  buildMonthlySummaries, getRecentMonths, sumCosts
} from '@/lib/utils'
import { getDaysInMonth, parseISO, startOfMonth, endOfMonth, isWithinInterval, max, min, differenceInDays } from 'date-fns'
import Link from 'next/link'

async function getData() {
  const [{ data: rooms }, { data: reservations }] = await Promise.all([
    supabase.from('rooms').select('*').order('created_at'),
    supabase.from('reservations').select('*').order('check_in'),
  ])
  return {
    rooms: (rooms ?? []) as Room[],
    reservations: (reservations ?? []) as Reservation[],
  }
}

function occupiedDaysInMonth(reservations: Reservation[], yearMonth: string): number {
  const monthStart = startOfMonth(parseISO(yearMonth + '-01'))
  const monthEnd = endOfMonth(monthStart)
  let total = 0
  for (const r of reservations) {
    const ci = parseISO(r.check_in)
    const co = parseISO(r.check_out)
    const overlapStart = max([ci, monthStart])
    const overlapEnd = min([co, monthEnd])
    const days = differenceInDays(overlapEnd, overlapStart)
    if (days > 0) total += days
  }
  return total
}

export default async function DashboardPage() {
  const { rooms, reservations } = await getData()
  const ym = currentYearMonth()

  // 今月収入（check_inが今月の予約）
  const monthStart = startOfMonth(parseISO(ym + '-01'))
  const monthEnd = endOfMonth(monthStart)

  let monthRevenue = 0
  let monthCleaningCost = 0
  const thisMonthReservations = reservations.filter(r =>
    isWithinInterval(parseISO(r.check_in), { start: monthStart, end: monthEnd })
  )
  for (const r of thisMonthReservations) {
    monthRevenue += (r.room_fee || 0) + (r.cleaning_fee || 0)
    monthCleaningCost += r.cleaning_cost || 0
  }

  // 今月固定費
  let monthFixedCost = 0
  for (const room of rooms) {
    if (room.contract_start && parseISO(room.contract_start) <= monthEnd) {
      monthFixedCost += sumCosts(room.monthly_costs)
    }
  }

  const monthCost = monthFixedCost + monthCleaningCost
  const monthProfit = monthRevenue - monthCost

  // 稼働率
  const daysInMonth = getDaysInMonth(monthStart)
  const activeRooms = rooms.filter(r => r.contract_start && parseISO(r.contract_start) <= monthEnd)
  const totalRoomDays = activeRooms.length * daysInMonth
  const occupiedDays = occupiedDaysInMonth(reservations, ym)
  const occupancyRate = totalRoomDays > 0 ? Math.round((occupiedDays / totalRoomDays) * 100) : 0

  // 累計損益
  let cumulativeRevenue = 0
  let cumulativeCost = 0
  for (const r of reservations) {
    cumulativeRevenue += (r.room_fee || 0) + (r.cleaning_fee || 0)
    cumulativeCost += r.cleaning_cost || 0
  }
  // 全期間の固定費（部屋の契約月から今月まで）
  for (const room of rooms) {
    if (room.contract_start) {
      const start = parseISO(room.contract_start)
      const now = new Date()
      const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1
      cumulativeCost += sumCosts(room.monthly_costs) * Math.max(0, months)
      cumulativeCost += sumCosts(room.initial_costs)
    }
  }
  const cumulativeProfit = cumulativeRevenue - cumulativeCost

  // 今後の予約（直近5件）
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = reservations
    .filter(r => r.check_in >= today)
    .slice(0, 5)
    .map(r => ({ ...r, room: rooms.find(rm => rm.id === r.room_id) }))

  const cards = [
    { label: '今月の収入', value: formatCurrency(monthRevenue), color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '今月の費用', value: formatCurrency(monthCost),    color: 'text-red-500',  bg: 'bg-red-50'  },
    { label: '今月の利益', value: formatCurrency(monthProfit),  color: monthProfit >= 0 ? 'text-emerald-600' : 'text-red-600', bg: monthProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
    { label: '今月の稼働率', value: `${occupancyRate}%`,        color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: '累計損益',   value: formatCurrency(cumulativeProfit), color: cumulativeProfit >= 0 ? 'text-emerald-600' : 'text-red-600', bg: cumulativeProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">概要</h2>
        <p className="text-sm text-gray-500 mt-0.5">{formatYearMonth(ym)}</p>
      </div>

      {/* KPIカード */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map(c => (
          <div key={c.label} className={`card ${c.bg}`}>
            <p className="text-xs font-medium text-gray-500">{c.label}</p>
            <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 部屋一覧 */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">部屋一覧</h3>
            <Link href="/dashboard/rooms/new" className="btn-primary text-xs py-1.5">+ 追加</Link>
          </div>
          {rooms.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">部屋が登録されていません</p>
          ) : (
            <div className="space-y-2">
              {rooms.map(room => (
                <Link key={room.id} href={`/dashboard/rooms/${room.id}`}
                  className="flex justify-between items-center px-3 py-2.5 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{room.name}</p>
                    <p className="text-xs text-gray-400">{room.nearest_station ?? '最寄駅未設定'}</p>
                  </div>
                  <p className="text-sm font-semibold text-blue-600">{formatCurrency(room.current_price)}/月</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 直近の予約 */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">直近の予約</h3>
            <Link href="/dashboard/reservations/new" className="btn-primary text-xs py-1.5">+ 追加</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">予約がありません</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map(r => (
                <Link key={r.id} href={`/dashboard/reservations/${r.id}`}
                  className="flex justify-between items-center px-3 py-2.5 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{r.guest_name}</p>
                    <p className="text-xs text-gray-400">{r.room?.name ?? '—'} · {r.check_in} 〜 {r.check_out}</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-600">{formatCurrency(r.room_fee)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
