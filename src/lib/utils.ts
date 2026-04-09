import { format, parseISO, differenceInDays, getDaysInMonth, startOfMonth, endOfMonth, isWithinInterval, max, min } from 'date-fns'
import { ja } from 'date-fns/locale'
import type { Room, Reservation, MonthlySummary } from '@/types'

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

/** 指定月に部屋が稼働していた日数（予約の重複部分） */
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

/** 指定月の月次固定費合計（契約中の部屋のみ） */
function monthlyFixedCosts(rooms: Room[], yearMonth: string): number {
  let total = 0
  const monthStart = parseISO(yearMonth + '-01')
  for (const room of rooms) {
    if (room.contract_start && parseISO(room.contract_start) <= endOfMonth(monthStart)) {
      total += sumCosts(room.monthly_costs)
    }
  }
  return total
}

/** 指定月の予約収入（room_fee + cleaning_fee）と清掃費用（cleaning_cost）の合計 */
function monthlyReservationData(reservations: Reservation[], yearMonth: string) {
  const monthStart = startOfMonth(parseISO(yearMonth + '-01'))
  const monthEnd = endOfMonth(monthStart)
  let revenue = 0
  let cleaningCost = 0

  for (const r of reservations) {
    const ci = parseISO(r.check_in)
    // check_inが指定月に含まれる予約を対象
    if (isWithinInterval(ci, { start: monthStart, end: monthEnd })) {
      revenue += (r.room_fee || 0) + (r.cleaning_fee || 0)
      cleaningCost += r.cleaning_cost || 0
    }
  }
  return { revenue, cleaningCost }
}

export function buildMonthlySummaries(
  rooms: Room[],
  reservations: Reservation[],
  months: string[],  // ["YYYY-MM", ...]
  forecastFrom: string
): MonthlySummary[] {
  return months.map(ym => {
    const { revenue, cleaningCost } = monthlyReservationData(reservations, ym)
    const fixedCosts = monthlyFixedCosts(rooms, ym)
    const costs = fixedCosts + cleaningCost
    const profit = revenue - costs

    const daysInMonth = getDaysInMonth(parseISO(ym + '-01'))
    const totalRoomDays = rooms.filter(r =>
      r.contract_start && parseISO(r.contract_start) <= endOfMonth(parseISO(ym + '-01'))
    ).length * daysInMonth

    const occupied = occupiedDaysInMonth(reservations, ym)
    const occupancyRate = totalRoomDays > 0 ? occupied / totalRoomDays : 0

    return {
      yearMonth: ym,
      revenue,
      costs,
      profit,
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

// 色パレット（部屋ごとの色）
const ROOM_COLORS = [
  'bg-blue-400',
  'bg-emerald-400',
  'bg-violet-400',
  'bg-amber-400',
  'bg-rose-400',
  'bg-cyan-400',
  'bg-orange-400',
  'bg-pink-400',
]

const ROOM_COLORS_HEX = [
  '#60a5fa', '#34d399', '#a78bfa', '#fbbf24',
  '#fb7185', '#22d3ee', '#fb923c', '#f472b6',
]

export function roomColor(index: number): string {
  return ROOM_COLORS[index % ROOM_COLORS.length]
}

export function roomColorHex(index: number): string {
  return ROOM_COLORS_HEX[index % ROOM_COLORS_HEX.length]
}
