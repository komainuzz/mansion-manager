import { supabase } from '@/lib/supabase'
import type { Room, Reservation, UtilityCost } from '@/types'
import {
  formatCurrency, formatYearMonth, currentYearMonth,
  buildMonthlySummaries, roomDisplayName
} from '@/lib/utils'
import { format, addMonths } from 'date-fns'
import Link from 'next/link'
import YearMonthSelector from '@/components/dashboard/YearMonthSelector'

export const dynamic = 'force-dynamic'

async function getData() {
  const [{ data: rooms }, { data: reservations }, { data: utilityCosts }] = await Promise.all([
    supabase.from('rooms').select('*').order('building_name'),
    supabase.from('reservations').select('*').order('check_in'),
    supabase.from('utility_costs').select('*'),
  ])
  return {
    rooms: (rooms ?? []) as Room[],
    reservations: (reservations ?? []) as Reservation[],
    utilityCosts: (utilityCosts ?? []) as UtilityCost[],
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { ym?: string }
}) {
  const todayYM = currentYearMonth()
  const ym = searchParams.ym ?? todayYM
  const { rooms, reservations, utilityCosts } = await getData()

  // 利用可能な年の範囲を算出
  const currentYear = new Date().getFullYear()
  const allDates = [
    ...rooms.map(r => r.contract_start).filter(Boolean) as string[],
    ...reservations.map(r => r.check_in),
  ]
  const minYear = allDates.length > 0
    ? Math.min(...allDates.map(d => parseInt(d.slice(0, 4))))
    : currentYear
  const years = Array.from({ length: currentYear - minYear + 1 }, (_, i) => minYear + i)
  if (!years.includes(currentYear)) years.push(currentYear)

  // 選択年の12ヶ月
  const selYear = parseInt(ym.slice(0, 4))
  const months12 = Array.from({ length: 12 }, (_, i) =>
    `${selYear}-${String(i + 1).padStart(2, '0')}`
  )
  const forecastFrom = format(addMonths(new Date(), 1), 'yyyy-MM')

  const summaries = buildMonthlySummaries(rooms, reservations, utilityCosts, months12, forecastFrom)
  const current = summaries.find(s => s.yearMonth === ym) ?? summaries[new Date().getMonth()]
  const occupancyPct = Math.round((current?.occupancyRate ?? 0) * 100)

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = reservations
    .filter(r => r.check_in >= today)
    .slice(0, 5)
    .map(r => ({ ...r, room: rooms.find(rm => rm.id === r.room_id) }))

  return (
    <div className="p-6 space-y-6">
      {/* ヘッダー + 年月セレクター */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">概要</h2>
        <YearMonthSelector ym={ym} years={years} />
      </div>

      {/* KPIカード */}
      {current && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="card bg-blue-50">
            <p className="text-xs font-medium text-gray-500">収入</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(current.revenue)}</p>
          </div>
          <div className="card bg-red-50">
            <p className="text-xs font-medium text-gray-500">費用合計</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(current.costs)}</p>
            <div className="mt-2 space-y-0.5 text-xs text-gray-500">
              <div className="flex justify-between"><span>固定費</span><span>{formatCurrency(current.fixedCost)}</span></div>
              <div className="flex justify-between"><span>光熱費</span><span>{formatCurrency(current.utilityCost)}</span></div>
              <div className="flex justify-between"><span>清掃費</span><span>{formatCurrency(current.cleaningCost)}</span></div>
            </div>
          </div>
          <div className={`card ${current.profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <p className="text-xs font-medium text-gray-500">利益</p>
            <p className={`text-2xl font-bold mt-1 ${current.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(current.profit)}
            </p>
          </div>
          <div className="card bg-violet-50 col-span-2 lg:col-span-3">
            <p className="text-xs font-medium text-gray-500">稼働率</p>
            <div className="flex items-end gap-3 mt-1">
              <p className="text-2xl font-bold text-violet-600">{occupancyPct}%</p>
              <p className="text-sm text-gray-500 mb-0.5">
                {current.occupiedDays}日 / {current.totalRoomDays}日（部屋×日数）
              </p>
            </div>
            {current.totalRoomDays > 0 && (
              <div className="mt-2 h-2 bg-violet-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all"
                  style={{ width: `${Math.min(occupancyPct, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 選択年の月別サマリーテーブル */}
      <div className="card overflow-x-auto">
        <h3 className="font-semibold text-gray-900 mb-3">{selYear}年 月別実績</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="text-left py-1.5 pr-3 font-medium whitespace-nowrap">月</th>
              <th className="text-right py-1.5 px-2 font-medium whitespace-nowrap">収入</th>
              <th className="text-right py-1.5 px-2 font-medium whitespace-nowrap">固定費</th>
              <th className="text-right py-1.5 px-2 font-medium whitespace-nowrap">光熱費</th>
              <th className="text-right py-1.5 px-2 font-medium whitespace-nowrap">清掃費</th>
              <th className="text-right py-1.5 px-2 font-medium whitespace-nowrap">利益</th>
              <th className="text-right py-1.5 pl-2 font-medium whitespace-nowrap">稼働率</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map(s => {
              const isSelected = s.yearMonth === ym
              const pct = Math.round(s.occupancyRate * 100)
              return (
                <tr
                  key={s.yearMonth}
                  className={`border-b border-gray-50 ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <Link
                      href={`/dashboard?ym=${s.yearMonth}`}
                      className={`font-medium ${isSelected ? 'text-blue-700' : 'text-gray-700 hover:text-blue-600'}`}
                    >
                      {formatYearMonth(s.yearMonth)}
                      {s.isForecast && <span className="ml-1 text-xs text-amber-500">予測</span>}
                    </Link>
                  </td>
                  <td className="py-2 px-2 text-right text-blue-600 font-medium">{formatCurrency(s.revenue)}</td>
                  <td className="py-2 px-2 text-right text-gray-500">{formatCurrency(s.fixedCost)}</td>
                  <td className="py-2 px-2 text-right">
                    <span className={s.utilityCost === 0 ? 'text-gray-300' : 'text-gray-500'}>
                      {formatCurrency(s.utilityCost)}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right text-gray-500">{formatCurrency(s.cleaningCost)}</td>
                  <td className={`py-2 px-2 text-right font-semibold ${s.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(s.profit)}
                  </td>
                  <td className="py-2 pl-2 text-right text-violet-600">
                    {s.totalRoomDays > 0 ? `${pct}%` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="text-xs text-gray-400 mt-3">
          ※ 光熱費は各部屋の水道光熱費ページから入力できます。未入力の月は¥0として計算されます。
        </p>
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
                    <p className="text-sm font-medium text-gray-800">{roomDisplayName(room)}</p>
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
                    <p className="text-xs text-gray-400">
                      {r.room ? roomDisplayName(r.room) : '—'} · {r.check_in} 〜 {r.check_out}
                    </p>
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
