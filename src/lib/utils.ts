import { format, parseISO, differenceInDays, getDaysInMonth, startOfMonth, endOfMonth, isWithinInterval, max, min, addMonths } from 'date-fns'
import { ja } from 'date-fns/locale'
import type { Room, Reservation, UtilityCost, MonthlySummary } from '@/types'

export function roomDisplayName(room: Pick<Room, 'building_name' | 'room_number'>): string {
  return room.room_number ? `${room.building_name} ${room.room_number}` : room.building_name
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount)
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return format(parseISO(dateStr), 'yyyy/MM/dd', { locale: ja })
}

export function formatYearMonth(dateStr: string): string {
  return format(parseISO(dateStr + '-01'), 'yyyy年M月', { locale: ja })
}

export function sumCosts(costs: Record<string, number>): number {
  return Object.values(costs).reduce((s, v) => s + (v || 0), 0)
}

export function stayDays(checkIn: string, checkOut: string): number {
  return differenceInDays(parseISO(checkOut), parseISO(checkIn))
}

/** 指定月に稼働していた日数（activeRoomIdsで絞り込み） */
function occupiedDaysInMonth(reservations: Reservation[], yearMonth: string, activeRoomIds?: Set<string>): number {
  const monthStart = startOfMonth(parseISO(yearMonth + '-01'))
  const monthEnd = endOfMonth(monthStart)
  let total = 0
  for (const r of reservations) {
    if (activeRoomIds && !activeRoomIds.has(r.room_id)) continue
    const ci = parseISO(r.check_in)
    const co = parseISO(r.check_out)
    const overlapStart = max([ci, monthStart])
    const overlapEnd = min([co, monthEnd])
    const days = differenceInDays(overlapEnd, overlapStart)
    if (days > 0) total += days
  }
  return total
}

/** 指定月に部屋が稼働中か（契約開始済み かつ 解約日が月開始より後 or 未設定） */
export function isRoomActiveInMonth(room: Room, yearMonth: string): boolean {
  const monthStart = startOfMonth(parseISO(yearMonth + '-01'))
  const monthEnd = endOfMonth(monthStart)
  if (!room.contract_start || parseISO(room.contract_start) > monthEnd) return false
  if (room.contract_end && parseISO(room.contract_end) < monthStart) return false
  return true
}

/** 指定月の月次固定費合計（稼働中の部屋のみ） */
function monthlyFixedCosts(rooms: Room[], yearMonth: string): number {
  let total = 0
  for (const room of rooms) {
    if (isRoomActiveInMonth(room, yearMonth)) {
      total += sumCosts(room.monthly_costs)
    }
  }
  return total
}

/**
 * 指定月の収益と清掃費用を計算する。
 * 宿泊料は日割りで各月に按分（例: 4/1〜5/10の¥310,000 → 日額¥10,000×各月の滞在日数）。
 * 清掃料（収入）・清掃費（コスト）はチェックイン月に一括計上。
 */
function monthlyReservationData(reservations: Reservation[], yearMonth: string) {
  const monthStart = startOfMonth(parseISO(yearMonth + '-01'))
  const nextMonthStart = addMonths(monthStart, 1)
  let revenue = 0
  let cleaningCost = 0

  for (const r of reservations) {
    const ci = parseISO(r.check_in)
    const co = parseISO(r.check_out)
    const stayDays = differenceInDays(co, ci)
    if (stayDays <= 0) continue

    // 宿泊料：日割り按分（この月の滞在日数 × 日額）
    const overlapStart = ci > monthStart ? ci : monthStart
    const overlapEnd = co < nextMonthStart ? co : nextMonthStart
    const overlapDays = differenceInDays(overlapEnd, overlapStart)
    if (overlapDays > 0) {
      const dailyRate = (r.room_fee || 0) / stayDays
      revenue += Math.round(dailyRate * overlapDays)
    }

    // 清掃料収入・清掃費はチェックイン月に計上
    if (ci >= monthStart && ci < nextMonthStart) {
      revenue += r.cleaning_fee || 0
      cleaningCost += r.cleaning_cost || 0
    }
  }
  return { revenue, cleaningCost }
}

export function buildMonthlySummaries(
  rooms: Room[],
  reservations: Reservation[],
  utilityCosts: UtilityCost[],
  months: string[],  // ["YYYY-MM", ...]
  forecastFrom: string
): MonthlySummary[] {
  return months.map(ym => {
    const activeRooms = rooms.filter(r => isRoomActiveInMonth(r, ym))
    const activeRoomIds = new Set(activeRooms.map(r => r.id))

    const { revenue, cleaningCost } = monthlyReservationData(reservations, ym)
    const fixedCost = monthlyFixedCosts(rooms, ym)
    const utilityCost = utilityCosts
      .filter(u => u.year_month === ym)
      .reduce((sum, u) => sum + (u.electricity || 0) + (u.water || 0), 0)
    const costs = fixedCost + cleaningCost + utilityCost
    const profit = revenue - costs

    const daysInMonth = getDaysInMonth(parseISO(ym + '-01'))
    const totalRoomDays = activeRooms.length * daysInMonth

    const occupiedDays = occupiedDaysInMonth(reservations, ym, activeRoomIds)
    const occupancyRate = totalRoomDays > 0 ? occupiedDays / totalRoomDays : 0

    return {
      yearMonth: ym,
      revenue,
      fixedCost,
      utilityCost,
      cleaningCost,
      costs,
      profit,
      occupiedDays,
      totalRoomDays,
      occupancyRate,
      isForecast: ym >= forecastFrom,
    }
  })
}

export function getRecentMonths(count: number, fromYM?: string): string[] {
  const base = fromYM ? parseISO(fromYM + '-01') : new Date()
  const months: string[] = []
  for (let i = -(count - 1); i <= 0; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1)
    months.push(format(d, 'yyyy-MM'))
  }
  return months
}

export function getFutureMonths(count: number, fromYM?: string): string[] {
  const base = fromYM ? parseISO(fromYM + '-01') : new Date()
  const months: string[] = []
  for (let i = 1; i <= count; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1)
    months.push(format(d, 'yyyy-MM'))
  }
  return months
}

export function currentYearMonth(): string {
  return format(new Date(), 'yyyy-MM')
}

// 色パレット（部屋ごとの色）— 白文字が読みやすいダーク系
const ROOM_COLORS = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-amber-700',
  'bg-rose-600',
  'bg-cyan-700',
  'bg-orange-600',
  'bg-pink-700',
  'bg-teal-600',
  'bg-indigo-600',
]

const ROOM_COLORS_HEX = [
  '#1d6fb5',  // ブルー
  '#1a8a5c',  // グリーン
  '#6d3ab5',  // バイオレット
  '#a35a10',  // アンバー
  '#b83030',  // レッド
  '#0a7a90',  // シアン
  '#b85820',  // オレンジ
  '#9c2870',  // ピンク
  '#0e7878',  // ティール
  '#3730a3',  // インディゴ
]

export function roomColor(index: number): string {
  return ROOM_COLORS[index % ROOM_COLORS.length]
}

export function roomColorHex(index: number): string {
  return ROOM_COLORS_HEX[index % ROOM_COLORS_HEX.length]
}
