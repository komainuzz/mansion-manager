'use client'

import { useState } from 'react'
import { addDays, format, startOfWeek, parseISO, differenceInDays, isSameDay, isToday } from 'date-fns'
import { ja } from 'date-fns/locale'
import type { Room, Reservation } from '@/types'
import { roomColorHex } from '@/lib/utils'
import Link from 'next/link'

const TOTAL_DAYS = 35
const DAY_WIDTH = 36 // px

interface Props {
  rooms: Room[]
  reservations: Reservation[]
}

interface Tooltip {
  reservation: Reservation
  room: Room
  x: number
  y: number
}

export default function GanttCalendar({ rooms, reservations }: Props) {
  const [baseDate, setBaseDate] = useState(() => startOfWeek(new Date(), { locale: ja }))
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)

  const days = Array.from({ length: TOTAL_DAYS }, (_, i) => addDays(baseDate, i))

  function prevWeek() { setBaseDate(d => addDays(d, -7)) }
  function nextWeek() { setBaseDate(d => addDays(d, 7)) }
  function goToday() { setBaseDate(startOfWeek(new Date(), { locale: ja })) }

  function getReservationsForRoom(roomId: string): Reservation[] {
    const start = days[0]
    const end = days[TOTAL_DAYS - 1]
    return reservations.filter(r => {
      const ci = parseISO(r.check_in)
      const co = parseISO(r.check_out)
      return co > start && ci <= end && r.room_id === roomId
    })
  }

  function getBarStyle(r: Reservation) {
    const start = days[0]
    const ci = parseISO(r.check_in)
    const co = parseISO(r.check_out)
    const left = Math.max(0, differenceInDays(ci, start))
    const right = Math.min(TOTAL_DAYS, differenceInDays(co, start))
    const width = right - left
    if (width <= 0) return null
    return { left: left * DAY_WIDTH, width: width * DAY_WIDTH - 2 }
  }

  const weekDayLabel = ['日', '月', '火', '水', '木', '金', '土']

  return (
    <div className="space-y-4">
      {/* ナビゲーション */}
      <div className="flex items-center gap-3">
        <button onClick={prevWeek} className="btn-secondary py-1.5 px-3 text-xs">← 前週</button>
        <button onClick={goToday} className="btn-secondary py-1.5 px-3 text-xs">今日</button>
        <button onClick={nextWeek} className="btn-secondary py-1.5 px-3 text-xs">次週 →</button>
        <span className="text-sm text-gray-500">
          {format(days[0], 'yyyy年M月d日', { locale: ja })} 〜 {format(days[TOTAL_DAYS - 1], 'M月d日', { locale: ja })}
        </span>
      </div>

      {rooms.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400">部屋が登録されていません</p>
          <Link href="/dashboard/rooms/new" className="btn-primary mt-3 inline-flex">部屋を登録する</Link>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="border-collapse" style={{ minWidth: `${DAY_WIDTH * TOTAL_DAYS + 160}px` }}>
            <thead>
              <tr>
                {/* 部屋名列 */}
                <th className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-200 px-4 py-3 text-left text-xs font-semibold text-gray-500 w-40 min-w-[160px]">
                  部屋
                </th>
                {/* 日付列 */}
                {days.map((day, i) => {
                  const dow = day.getDay()
                  const todayFlag = isToday(day)
                  return (
                    <th key={i} className="border-b border-gray-200 text-center p-0"
                      style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}>
                      <div className={`flex flex-col items-center py-1.5 text-xs font-medium
                        ${todayFlag ? 'bg-blue-600 text-white rounded' : ''}
                        ${!todayFlag && dow === 0 ? 'text-red-500' : ''}
                        ${!todayFlag && dow === 6 ? 'text-blue-500' : ''}
                        ${!todayFlag && dow > 0 && dow < 6 ? 'text-gray-600' : ''}
                      `}>
                        <span>{format(day, 'd')}</span>
                        <span className="text-[10px]">{weekDayLabel[dow]}</span>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room, roomIdx) => {
                const roomReservations = getReservationsForRoom(room.id)
                const color = roomColorHex(roomIdx)

                return (
                  <tr key={room.id} className="group">
                    {/* 部屋名セル */}
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-b border-r border-gray-100 px-4 py-2 text-sm font-medium text-gray-800 w-40 min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <Link href={`/dashboard/rooms/${room.id}`} className="hover:text-blue-600 truncate">
                          {room.name}
                        </Link>
                      </div>
                    </td>
                    {/* ガントバーセル（1行まとめて relative で配置） */}
                    <td colSpan={TOTAL_DAYS} className="border-b border-gray-100 p-0 group-hover:bg-gray-50"
                      style={{ height: 44 }}>
                      <div className="relative" style={{ height: 44, width: DAY_WIDTH * TOTAL_DAYS }}>
                        {/* 今日のハイライト線 */}
                        {days.map((day, i) => isToday(day) ? (
                          <div key="today" className="absolute inset-y-0 bg-blue-50 border-x border-blue-200"
                            style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }} />
                        ) : null)}

                        {/* 土日ハイライト */}
                        {days.map((day, i) => {
                          const dow = day.getDay()
                          if (dow === 0 || dow === 6) {
                            return <div key={i} className="absolute inset-y-0 bg-gray-50"
                              style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }} />
                          }
                          return null
                        })}

                        {/* 予約バー */}
                        {roomReservations.map(r => {
                          const style = getBarStyle(r)
                          if (!style) return null
                          return (
                            <div
                              key={r.id}
                              className="absolute rounded-md flex items-center px-2 cursor-pointer transition-opacity hover:opacity-80"
                              style={{
                                left: style.left + 1,
                                width: style.width,
                                top: 6,
                                height: 32,
                                backgroundColor: color,
                              }}
                              onMouseEnter={e => {
                                const rect = (e.target as HTMLElement).getBoundingClientRect()
                                setTooltip({ reservation: r, room, x: rect.left, y: rect.top })
                              }}
                              onMouseLeave={() => setTooltip(null)}
                            >
                              <span className="text-white text-xs font-medium truncate">{r.guest_name}</span>
                            </div>
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ツールチップ */}
      {tooltip && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-4 pointer-events-none text-sm min-w-[220px]"
          style={{ left: tooltip.x, top: tooltip.y - 120 }}
        >
          <p className="font-bold text-gray-900 mb-2">{tooltip.reservation.guest_name}</p>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">部屋</dt>
              <dd className="font-medium">{tooltip.room.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">期間</dt>
              <dd className="font-medium">{tooltip.reservation.check_in} 〜 {tooltip.reservation.check_out}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">宿泊料</dt>
              <dd className="font-medium text-emerald-600">¥{tooltip.reservation.room_fee.toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* 凡例 */}
      {rooms.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {rooms.map((room, idx) => (
            <div key={room.id} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: roomColorHex(idx) }} />
              {room.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
