'use client'

import { useState } from 'react'
import { addDays, format, startOfWeek, parseISO, differenceInDays, isToday } from 'date-fns'
import { ja } from 'date-fns/locale'
import type { Room, Reservation, Cleaning } from '@/types'
import { roomColorHex, roomDisplayName } from '@/lib/utils'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import CleaningModal from './CleaningModal'

const TOTAL_DAYS = 35
const DAY_WIDTH = 40
const ROW_HEIGHT = 56       // 上段：予約バー / 下段：清掃バー
const RES_TOP = 4
const RES_HEIGHT = 28
const CLEAN_TOP = 38
const CLEAN_HEIGHT = 14

const CLEANING_COLOR = '#94a3b8'  // slate-400
const BAR_COLORS = ['#1d6fb5', '#1a8a5c']  // 2色交互（青・緑）

interface Props {
  rooms: Room[]
  reservations: Reservation[]
  cleanings: Cleaning[]
}

interface ResTooltip {
  reservation: Reservation
  room: Room
  x: number
  y: number
}

interface CleanModal {
  roomId: string
  roomName: string
  date: string
  cleaning?: Cleaning
}

export default function GanttCalendar({ rooms, reservations, cleanings }: Props) {
  const [baseDate, setBaseDate] = useState(() => startOfWeek(new Date(), { locale: ja }))
  const [resTooltip, setResTooltip] = useState<ResTooltip | null>(null)
  const [cleanTooltip, setCleanTooltip] = useState<{ cleaning: Cleaning; x: number; y: number } | null>(null)
  const [cleanModal, setCleanModal] = useState<CleanModal | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const days = Array.from({ length: TOTAL_DAYS }, (_, i) => addDays(baseDate, i))

  function prevWeek() { setBaseDate(d => addDays(d, -7)) }
  function nextWeek() { setBaseDate(d => addDays(d, 7)) }
  function goToday() { setBaseDate(startOfWeek(new Date(), { locale: ja })) }

  function getReservationsForRoom(roomId: string): Reservation[] {
    const start = days[0]; const end = days[TOTAL_DAYS - 1]
    return reservations.filter(r => {
      const ci = parseISO(r.check_in); const co = parseISO(r.check_out)
      return co > start && ci <= end && r.room_id === roomId
    })
  }

  function getCleaningsForRoom(roomId: string): Cleaning[] {
    const start = format(days[0], 'yyyy-MM-dd')
    const end = format(days[TOTAL_DAYS - 1], 'yyyy-MM-dd')
    return cleanings.filter(c => c.room_id === roomId && c.scheduled_date >= start && c.scheduled_date <= end)
  }

  function getResBarStyle(r: Reservation) {
    const start = days[0]
    const ci = parseISO(r.check_in); const co = parseISO(r.check_out)
    const left = Math.max(0, differenceInDays(ci, start))
    const right = Math.min(TOTAL_DAYS, differenceInDays(co, start))
    const width = right - left
    if (width <= 0) return null
    return { left: left * DAY_WIDTH, width: width * DAY_WIDTH - 2 }
  }

  function getCleanBarStyle(c: Cleaning) {
    const start = days[0]
    const dayIdx = differenceInDays(parseISO(c.scheduled_date), start)
    if (dayIdx < 0 || dayIdx >= TOTAL_DAYS) return null
    // 時間が指定されている場合は時間比率でオフセット・幅を計算
    if (c.start_time && c.end_time) {
      const [sh, sm] = c.start_time.split(':').map(Number)
      const [eh, em] = c.end_time.split(':').map(Number)
      const startFrac = (sh * 60 + sm) / (24 * 60)
      const endFrac = (eh * 60 + em) / (24 * 60)
      const offsetInDay = startFrac * DAY_WIDTH
      const widthInDay = Math.max(6, (endFrac - startFrac) * DAY_WIDTH)
      return { left: dayIdx * DAY_WIDTH + offsetInDay, width: widthInDay }
    }
    return { left: dayIdx * DAY_WIDTH + 1, width: DAY_WIDTH - 2 }
  }

  function handleGanttClick(e: React.MouseEvent<HTMLDivElement>, room: Room) {
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = e.clientX - rect.left
    const relY = e.clientY - rect.top
    if (relY < CLEAN_TOP) return   // 上段（予約エリア）はスキップ
    const dayIdx = Math.min(TOTAL_DAYS - 1, Math.max(0, Math.floor(relX / DAY_WIDTH)))
    const date = format(addDays(baseDate, dayIdx), 'yyyy-MM-dd')
    setCleanModal({ roomId: room.id, roomName: roomDisplayName(room), date })
  }

  const weekDayLabel = ['日', '月', '火', '水', '木', '金', '土']

  return (
    <div className="space-y-4">
      {/* ナビゲーション */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={prevWeek} className="btn-secondary py-1.5 px-3 text-xs">← 前週</button>
        <button onClick={goToday} className="btn-secondary py-1.5 px-3 text-xs">今日</button>
        <button onClick={nextWeek} className="btn-secondary py-1.5 px-3 text-xs">次週 →</button>
        <span className="text-sm text-gray-500 flex-1">
          {format(days[0], 'yyyy年M月d日', { locale: ja })} 〜 {format(days[TOTAL_DAYS - 1], 'M月d日', { locale: ja })}
        </span>
        <Link href="/dashboard/reservations/new" className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5">
          <Plus size={13} />
          入居登録
        </Link>
      </div>

      {/* 凡例 */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-3 rounded-sm inline-block" style={{ backgroundColor: BAR_COLORS[0] }} />
          <span className="w-4 h-3 rounded-sm inline-block" style={{ backgroundColor: BAR_COLORS[1] }} />
          予約・入居（2色交互）
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-2.5 rounded-sm inline-block" style={{ backgroundColor: CLEANING_COLOR }} />
          清掃予定（下段をクリックで登録）
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 font-medium">部屋がまだ登録されていません</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">入居登録の前に、まず部屋を登録してください</p>
          <Link href="/dashboard/rooms/new" className="btn-secondary inline-flex">部屋を登録する</Link>
        </div>
      ) : reservations.length === 0 && cleanings.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 font-medium">入居登録がまだありません</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">カレンダーに表示するには入居（予約）を登録してください</p>
          <Link href="/dashboard/reservations/new" className="btn-primary inline-flex items-center gap-1.5">
            <Plus size={14} />
            入居登録をする
          </Link>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="border-collapse" style={{ minWidth: `${DAY_WIDTH * TOTAL_DAYS + 160}px` }}>
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-200 px-4 py-3 text-left text-xs font-semibold text-gray-500 w-40 min-w-[160px]">
                  部屋
                </th>
                {days.map((day, i) => {
                  const dow = day.getDay()
                  const todayFlag = isToday(day)
                  const isWeekend = dow === 0 || dow === 6
                  return (
                    <th key={i} className="border-b text-center p-0"
                      style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH, borderRight: isWeekend ? '1px solid #9ca3af' : '1px solid #d1d5db' }}>
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
                const roomCleanings = getCleaningsForRoom(room.id)
                const color = BAR_COLORS[roomIdx % BAR_COLORS.length]

                return (
                  <tr key={room.id} className="group">
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-b border-r border-gray-100 px-4 py-2 text-sm font-medium text-gray-800 w-40 min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <Link href={`/dashboard/rooms/${room.id}`} className="hover:text-blue-600 truncate">
                          {roomDisplayName(room)}
                        </Link>
                      </div>
                    </td>
                    <td
                      colSpan={TOTAL_DAYS}
                      className="border-b border-gray-100 p-0 group-hover:bg-gray-50 cursor-default"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <div
                        className="relative"
                        style={{ height: ROW_HEIGHT, width: DAY_WIDTH * TOTAL_DAYS }}
                        onClick={e => handleGanttClick(e, room)}
                      >
                        {/* 縦グリッド線 + 今日・土日ハイライト */}
                        {days.map((day, i) => {
                          const dow = day.getDay()
                          const todayFlag = isToday(day)
                          const isWeekend = dow === 0 || dow === 6
                          return (
                            <div
                              key={i}
                              className="absolute inset-y-0 pointer-events-none"
                              style={{
                                left: i * DAY_WIDTH,
                                width: DAY_WIDTH,
                                backgroundColor: todayFlag ? 'rgba(219,234,254,0.6)' : isWeekend ? 'rgba(243,244,246,0.8)' : undefined,
                                borderRight: isWeekend ? '1px solid #9ca3af' : '1px solid #e5e7eb',
                              }}
                            />
                          )
                        })}

                        {/* 清掃エリアのヒント線 */}
                        <div className="absolute left-0 right-0 border-t border-dashed border-gray-200 pointer-events-none"
                          style={{ top: CLEAN_TOP }} />

                        {/* 予約バー */}
                        {roomReservations.map(r => {
                          const style = getResBarStyle(r)
                          if (!style) return null
                          return (
                            <div
                              key={r.id}
                              className="absolute rounded-md flex items-center px-2 cursor-pointer hover:brightness-90 transition-all"
                              style={{ left: style.left + 1, width: style.width, top: RES_TOP, height: RES_HEIGHT, backgroundColor: color }}
                              onMouseEnter={e => {
                                e.stopPropagation()
                                const rect = (e.target as HTMLElement).getBoundingClientRect()
                                setResTooltip({ reservation: r, room, x: rect.left, y: rect.top })
                              }}
                              onMouseLeave={() => setResTooltip(null)}
                              onClick={e => e.stopPropagation()}
                            >
                              <span className="text-white text-xs font-medium truncate leading-tight">
                                {r.is_extension && <span className="text-[9px] opacity-80 mr-1">延長</span>}
                                {r.guest_name}
                              </span>
                            </div>
                          )
                        })}

                        {/* 清掃バー */}
                        {roomCleanings.map(c => {
                          const style = getCleanBarStyle(c)
                          if (!style) return null
                          return (
                            <div
                              key={c.id}
                              className="absolute rounded flex items-center justify-center cursor-pointer hover:brightness-90 transition-all"
                              style={{ left: style.left, width: style.width, top: CLEAN_TOP, height: CLEAN_HEIGHT, backgroundColor: CLEANING_COLOR }}
                              onMouseEnter={e => {
                                e.stopPropagation()
                                const rect = (e.target as HTMLElement).getBoundingClientRect()
                                setCleanTooltip({ cleaning: c, x: rect.left, y: rect.top })
                              }}
                              onMouseLeave={() => setCleanTooltip(null)}
                              onClick={e => {
                                e.stopPropagation()
                                setCleanModal({ roomId: room.id, roomName: roomDisplayName(room), date: c.scheduled_date, cleaning: c })
                              }}
                            >
                              <span className="text-white text-[9px] font-medium truncate px-1">清掃</span>
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

      {/* 予約ツールチップ */}
      {resTooltip && (
        <div className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-4 pointer-events-none text-sm min-w-[220px]"
          style={{ left: resTooltip.x, top: resTooltip.y - 130 }}>
          <div className="flex items-center gap-2 mb-2">
            <p className="font-bold text-gray-900">{resTooltip.reservation.guest_name}</p>
            {resTooltip.reservation.is_extension && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">延長</span>
            )}
          </div>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">部屋</dt>
              <dd className="font-medium">{roomDisplayName(resTooltip.room)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">チェックイン</dt>
              <dd className="font-medium">{resTooltip.reservation.check_in}　{resTooltip.reservation.check_in_time ?? ''}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">チェックアウト</dt>
              <dd className="font-medium">{resTooltip.reservation.check_out}　{resTooltip.reservation.check_out_time ?? ''}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">宿泊料</dt>
              <dd className="font-medium text-emerald-600">¥{resTooltip.reservation.room_fee.toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* 清掃ツールチップ */}
      {cleanTooltip && (
        <div className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-4 pointer-events-none text-sm min-w-[180px]"
          style={{ left: cleanTooltip.x, top: cleanTooltip.y - 100 }}>
          <p className="font-bold text-gray-900 mb-2">清掃予定</p>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">日付</dt>
              <dd className="font-medium">{cleanTooltip.cleaning.scheduled_date}</dd>
            </div>
            {(cleanTooltip.cleaning.start_time || cleanTooltip.cleaning.end_time) && (
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">時間</dt>
                <dd className="font-medium">
                  {cleanTooltip.cleaning.start_time ?? '—'}〜{cleanTooltip.cleaning.end_time ?? '—'}
                </dd>
              </div>
            )}
            {cleanTooltip.cleaning.memo && (
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">メモ</dt>
                <dd className="font-medium">{cleanTooltip.cleaning.memo}</dd>
              </div>
            )}
          </dl>
          <p className="text-[10px] text-gray-400 mt-2">クリックして編集</p>
        </div>
      )}

      {/* 部屋カラー凡例 */}
      {rooms.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {rooms.map((room, idx) => (
            <div key={room.id} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: BAR_COLORS[idx % BAR_COLORS.length] }} />
              {roomDisplayName(room)}
            </div>
          ))}
        </div>
      )}

      {/* 清掃モーダル */}
      {cleanModal && (
        <CleaningModal
          roomId={cleanModal.roomId}
          roomName={cleanModal.roomName}
          date={cleanModal.date}
          cleaning={cleanModal.cleaning}
          onClose={() => setCleanModal(null)}
          onSaved={() => { setCleanModal(null); setRefreshKey(k => k + 1); window.location.reload() }}
        />
      )}
    </div>
  )
}
