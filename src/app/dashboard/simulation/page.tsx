import { supabase } from '@/lib/supabase'
import type { Room, Reservation, UtilityCost } from '@/types'
import {
  currentYearMonth, sumCosts, getRecentMonths, isRoomActiveInMonth,
} from '@/lib/utils'
import {
  getDaysInMonth, startOfMonth, endOfMonth, differenceInDays,
  max as maxDate, min as minDate, parseISO,
} from 'date-fns'
import RoomTabs from '@/components/simulation/RoomTabs'
import type { RecoveryStats } from '@/components/simulation/RoomSimulationPanel'

export const dynamic = 'force-dynamic'

export default async function SimulationPage() {
  const [{ data: rooms }, { data: reservations }, { data: utilityCosts }] = await Promise.all([
    supabase.from('rooms').select('*').order('building_name'),
    supabase.from('reservations').select('*').order('check_in'),
    supabase.from('utility_costs').select('*'),
  ])

  const roomList = (rooms ?? []) as Room[]
  const resList = (reservations ?? []) as Reservation[]
  const utilityList = (utilityCosts ?? []) as UtilityCost[]

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayYM = currentYearMonth()

  // 過去6ヶ月の実績稼働率（部屋別）
  const occupancyByRoom: Record<string, number> = {}
  const past6Months = getRecentMonths(6, todayYM)

  for (const room of roomList) {
    let totalOccupied = 0
    let totalAvailable = 0
    const roomRes = resList.filter(r => r.room_id === room.id)

    for (const month of past6Months) {
      if (!isRoomActiveInMonth(room, month)) continue
      const monthStart = startOfMonth(parseISO(month + '-01'))
      const monthEnd = endOfMonth(monthStart)
      totalAvailable += getDaysInMonth(monthStart)
      for (const r of roomRes) {
        const overlapStart = maxDate([parseISO(r.check_in), monthStart])
        const overlapEnd = minDate([parseISO(r.check_out), monthEnd])
        const days = differenceInDays(overlapEnd, overlapStart)
        if (days > 0) totalOccupied += days
      }
    }
    occupancyByRoom[room.id] = totalAvailable > 0 ? totalOccupied / totalAvailable : 0
  }

  // 部屋別の投資回収状況を計算
  const recoveryByRoom: Record<string, RecoveryStats> = {}

  for (const room of roomList) {
    const initialCost = sumCosts(room.initial_costs)
    const monthlyFixed = sumCosts(room.monthly_costs)
    const roomRes = resList.filter(r => r.room_id === room.id)
    const pastRes = roomRes.filter(r => r.check_in < todayStr)

    // 運用開始からの月数
    let operationMonths = 0
    if (room.contract_start) {
      const start = parseISO(room.contract_start)
      const now = new Date()
      operationMonths = Math.max(0,
        (now.getFullYear() - start.getFullYear()) * 12 +
        (now.getMonth() - start.getMonth()) + 1
      )
    }

    // 累積収入・清掃費（過去の予約から）
    const accumulatedRevenue = pastRes.reduce((s, r) => s + (r.room_fee || 0) + (r.cleaning_fee || 0), 0)
    const accumulatedCleaningCost = pastRes.reduce((s, r) => s + (r.cleaning_cost || 0), 0)

    // 累積固定費（月次コスト × 運用月数）
    const accumulatedFixedCost = monthlyFixed * operationMonths

    // 累積光熱費（実績）
    const accumulatedUtilityCost = utilityList
      .filter(u => u.room_id === room.id && u.year_month <= todayYM)
      .reduce((s, u) => s + (u.electricity || 0) + (u.water || 0), 0)

    const accumulatedProfit = accumulatedRevenue - accumulatedFixedCost - accumulatedUtilityCost - accumulatedCleaningCost
    const remainingRecovery = Math.max(0, initialCost - accumulatedProfit)

    recoveryByRoom[room.id] = {
      initialCost,
      accumulatedProfit,
      remainingRecovery,
      operationMonths,
      hasOperationData: pastRes.length > 0,
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">投資回収シミュレーション</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          部屋ごとの初期投資回収状況・目標回収期間から必要な月額を試算
        </p>
      </div>

      <RoomTabs
        rooms={roomList}
        occupancyByRoom={occupancyByRoom}
        recoveryByRoom={recoveryByRoom}
      />
    </div>
  )
}
