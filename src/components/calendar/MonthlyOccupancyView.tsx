'use client'

import { useState } from 'react'
import { parseISO, getDaysInMonth, startOfMonth, addMonths, differenceInDays, max, min } from 'date-fns'
import type { Room, Reservation } from '@/types'
import { roomDisplayName, isRoomActiveInMonth } from '@/lib/utils'
import Link from 'next/link'

interface Props {
  rooms: Room[]
  reservations: Reservation[]
}

function getMonthsInYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0')
    return `${year}-${m}`
  })
}

function calcOccupancy(room: Room, reservations: Reservation[], yearMonth: string): number | null {
  if (!isRoomActiveInMonth(room, yearMonth)) return null
  const monthStart = startOfMonth(parseISO(yearMonth + '-01'))
  const nextMonthStart = addMonths(monthStart, 1)
  const daysInMonth = getDaysInMonth(monthStart)
  let occupied = 0
  for (const r of reservations) {
    if (r.room_id !== room.id) continue
    const ci = parseISO(r.check_in)
    const co = parseISO(r.check_out)
    const overlapStart = max([ci, monthStart])
    const overlapEnd = min([co, nextMonthStart])
    const days = differenceInDays(overlapEnd, overlapStart)
    if (days > 0) occupied += days
  }
  return occupied / daysInMonth
}

function occStyle(occ: number): string {
  if (occ >= 0.85) return 'bg-emerald-500 text-white'
  if (occ >= 0.6)  return 'bg-blue-500 text-white'
  if (occ >= 0.3)  return 'bg-amber-400 text-white'
  if (occ > 0)     return 'bg-red-400 text-white'
  return 'bg-gray-100 text-gray-400'
}

export default function MonthlyOccupancyView({ rooms, reservations }: Props) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const todayYM = new Date().toISOString().slice(0, 7)

  const months = getMonthsInYear(year)

  if (rooms.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500 font-medium">部屋が登録されていません</p>
        <Link href="/dashboard/rooms/new" className="btn-secondary inline-flex mt-4">部屋を登録する</Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 年ナビゲーション */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setYear(y => y - 1)} className="btn-secondary py-1.5 px-3 text-xs">
          ← {year - 1}年
        </button>
        <span className="font-semibold text-gray-900 min-w-[60px] text-center">{year}年</span>
        <button type="button" onClick={() => setYear(y => y + 1)} className="btn-secondary py-1.5 px-3 text-xs">
          {year + 1}年 →
        </button>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span className="font-medium text-gray-600">稼働率：</span>
        {[
          { label: '85%以上', cls: 'bg-emerald-500' },
          { label: '60〜84%', cls: 'bg-blue-500' },
          { label: '30〜59%', cls: 'bg-amber-400' },
          { label: '1〜29%', cls: 'bg-red-400' },
          { label: '0%', cls: 'bg-gray-100 border border-gray-200' },
        ].map(({ label, cls }) => (
          <div key={label} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded ${cls} inline-block`} />
            <span>{label}</span>
          </div>
        ))}
        <span className="text-gray-400 ml-1">薄い色 = 将来（予測）</span>
      </div>

      {/* グリッド */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-200 px-4 py-3 text-left text-xs font-semibold text-gray-500 w-36 min-w-[144px]">
                  部屋
                </th>
                {months.map(ym => {
                  const [, m] = ym.split('-')
                  const isCurrent = ym === todayYM
                  return (
                    <th
                      key={ym}
                      className={`border-b border-gray-200 px-1 py-3 text-center text-xs font-semibold w-16 min-w-[60px] ${
                        isCurrent ? 'bg-blue-50' : 'bg-gray-50'
                      }`}
                    >
                      <span className={isCurrent ? 'text-blue-600 font-bold' : 'text-gray-600'}>
                        {parseInt(m)}月
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rooms.map(room => (
                <tr key={room.id} className="hover:bg-gray-50/50">
                  <td className="sticky left-0 z-10 bg-white border-b border-r border-gray-100 px-4 py-2 text-sm font-medium text-gray-800 w-36">
                    <Link href={`/dashboard/rooms/${room.id}`} className="hover:text-blue-600 truncate block">
                      {roomDisplayName(room)}
                    </Link>
                  </td>
                  {months.map(ym => {
                    const occ = calcOccupancy(room, reservations, ym)
                    const isFuture = ym > todayYM
                    return (
                      <td key={ym} className="border-b border-gray-100 p-1 text-center">
                        {occ === null ? (
                          <span className="text-xs text-gray-300">—</span>
                        ) : (
                          <div className={`rounded-lg px-1 py-1.5 text-xs font-semibold ${occStyle(occ)} ${isFuture ? 'opacity-50' : ''}`}>
                            {Math.round(occ * 100)}%
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}

              {/* 全部屋平均行 */}
              {rooms.length > 1 && (
                <tr className="bg-gray-50">
                  <td className="sticky left-0 z-10 bg-gray-50 border-t-2 border-r border-gray-200 px-4 py-2 text-xs font-bold text-gray-500">
                    全部屋平均
                  </td>
                  {months.map(ym => {
                    const activeRooms = rooms.filter(r => isRoomActiveInMonth(r, ym))
                    if (activeRooms.length === 0) {
                      return (
                        <td key={ym} className="border-t-2 border-gray-200 p-1 text-center">
                          <span className="text-xs text-gray-300">—</span>
                        </td>
                      )
                    }
                    const total = activeRooms.reduce((sum, room) => {
                      return sum + (calcOccupancy(room, reservations, ym) ?? 0)
                    }, 0)
                    const avg = total / activeRooms.length
                    const isFuture = ym > todayYM
                    return (
                      <td key={ym} className="border-t-2 border-gray-200 p-1 text-center">
                        <div className={`rounded-lg px-1 py-1.5 text-xs font-bold ${occStyle(avg)} ${isFuture ? 'opacity-50' : ''}`}>
                          {Math.round(avg * 100)}%
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
