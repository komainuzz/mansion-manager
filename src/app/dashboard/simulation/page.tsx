import { supabase } from '@/lib/supabase'
import type { Room, Reservation, UtilityCost } from '@/types'
import {
  currentYearMonth, sumCosts, getRecentMonths, isRoomActiveInMonth,
  formatCurrency, roomDisplayName,
} from '@/lib/utils'
import {
  getDaysInMonth, startOfMonth, differenceInDays, addMonths,
  max as maxDate, min as minDate, parseISO,
} from 'date-fns'
import RoomAccordion from '@/components/simulation/RoomAccordion'
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
      const nextMonthStart = addMonths(monthStart, 1)
      totalAvailable += getDaysInMonth(monthStart)
      for (const r of roomRes) {
        const overlapStart = maxDate([parseISO(r.check_in), monthStart])
        const overlapEnd = minDate([parseISO(r.check_out), nextMonthStart])
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

    // 収入内訳
    const roomFeeRevenue = pastRes.reduce((s, r) => s + (r.room_fee || 0), 0)
    const cleaningFeeIncome = pastRes.reduce((s, r) => s + (r.cleaning_fee || 0), 0)
    const accumulatedCleaningCost = pastRes.reduce((s, r) => s + (r.cleaning_cost || 0), 0)

    // 支出内訳
    const accumulatedFixedCost = monthlyFixed * operationMonths
    const accumulatedUtilityCost = utilityList
      .filter(u => u.room_id === room.id && u.year_month <= todayYM)
      .reduce((s, u) => s + (u.electricity || 0) + (u.water || 0), 0)

    const accumulatedRevenue = roomFeeRevenue + cleaningFeeIncome
    const accumulatedProfit = accumulatedRevenue - accumulatedFixedCost - accumulatedUtilityCost - accumulatedCleaningCost
    const remainingRecovery = Math.max(0, initialCost - accumulatedProfit)

    recoveryByRoom[room.id] = {
      initialCost,
      roomFeeRevenue,
      cleaningFeeIncome,
      reservationCount: pastRes.length,
      pastReservations: pastRes.map(r => ({
        id: r.id,
        guestName: r.guest_name,
        checkIn: r.check_in,
        checkOut: r.check_out,
        roomFee: r.room_fee || 0,
        cleaningFee: r.cleaning_fee || 0,
        cleaningCost: r.cleaning_cost || 0,
      })),
      accumulatedFixedCost,
      accumulatedUtilityCost,
      accumulatedCleaningCost,
      accumulatedProfit,
      remainingRecovery,
      operationMonths,
      hasOperationData: pastRes.length > 0,
    }
  }

  // 価格設定ヒント（稼働率ベース）
  const priceHints = roomList.map(room => {
    const occ = Math.round((occupancyByRoom[room.id] ?? 0) * 100)
    let suggestion = ''
    let colorClass = ''
    if (occ >= 85) {
      suggestion = '需要旺盛。値上げ検討（+5〜15%）を推奨'
      colorClass = 'text-emerald-600'
    } else if (occ >= 60) {
      suggestion = '適正稼働。現状維持が妥当'
      colorClass = 'text-blue-600'
    } else if (occ >= 30) {
      suggestion = '稼働率低め。プロモーションや値下げを検討'
      colorClass = 'text-amber-600'
    } else {
      suggestion = '稼働率が低い。価格・条件の見直しが必要'
      colorClass = 'text-red-600'
    }
    return { room, occ, suggestion, colorClass }
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">投資回収シミュレーション</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          部屋ごとの初期投資回収状況・目標回収期間から必要な月額を試算
        </p>
      </div>

      <RoomAccordion
        rooms={roomList}
        occupancyByRoom={occupancyByRoom}
        recoveryByRoom={recoveryByRoom}
      />

      {/* 価格設定ヒント */}
      {priceHints.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">価格設定ヒント</h3>
            <p className="text-xs text-gray-500 mt-0.5">過去6ヶ月の実績稼働率に基づく分析</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">部屋名</th>
                  <th className="table-th">現在の価格</th>
                  <th className="table-th">平均稼働率</th>
                  <th className="table-th">稼働率ゲージ</th>
                  <th className="table-th">推奨アクション</th>
                </tr>
              </thead>
              <tbody>
                {priceHints.map(({ room, occ, suggestion, colorClass }) => (
                  <tr key={room.id} className="hover:bg-gray-50">
                    <td className="table-td font-medium text-gray-900">{roomDisplayName(room)}</td>
                    <td className="table-td font-semibold text-blue-600 text-right">
                      {formatCurrency(room.current_price)}/月
                    </td>
                    <td className="table-td text-right">
                      <span className={`font-semibold ${
                        occ >= 85 ? 'text-emerald-600' : occ >= 60 ? 'text-blue-600' : occ >= 30 ? 'text-amber-600' : 'text-red-600'
                      }`}>{occ}%</span>
                    </td>
                    <td className="table-td">
                      <div className="w-32 bg-gray-100 rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all ${
                          occ >= 85 ? 'bg-emerald-500' : occ >= 60 ? 'bg-blue-500' : occ >= 30 ? 'bg-amber-500' : 'bg-red-500'
                        }`} style={{ width: `${Math.min(occ, 100)}%` }} />
                      </div>
                    </td>
                    <td className={`table-td text-sm font-medium ${colorClass}`}>{suggestion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
