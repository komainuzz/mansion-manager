import { supabase } from '@/lib/supabase'
import type { Room, Reservation, UtilityCost } from '@/types'
import {
  currentYearMonth, sumCosts, getRecentMonths, isRoomActiveInMonth,
  formatCurrency, roomDisplayName,
} from '@/lib/utils'
import {
  getDaysInMonth, startOfMonth, differenceInDays, addMonths, addDays,
  max as maxDate, min as minDate, parseISO, format,
} from 'date-fns'
import { ja } from 'date-fns/locale'
import RoomAccordion from '@/components/simulation/RoomAccordion'
import type { RecoveryStats, RecoveryScenario } from '@/components/simulation/RoomSimulationPanel'

export const dynamic = 'force-dynamic'

// ────────────────────────────────────────────────
// 日割り収益計算ヘルパー
// cutoffExclusive = 計上対象期間の翌日 0:00（例: 5/1 → 4/30まで計上）
// ────────────────────────────────────────────────
function revenueUpTo(
  reservations: Reservation[],
  cutoffExclusive: Date,
): { roomFeeRevenue: number; cleaningFeeIncome: number; cleaningCost: number } {
  let roomFeeRevenue = 0
  let cleaningFeeIncome = 0
  let cleaningCost = 0

  for (const r of reservations) {
    const ci = parseISO(r.check_in)
    const co = parseISO(r.check_out)
    const stayDays = differenceInDays(co, ci)
    if (stayDays <= 0) continue

    // 宿泊料：ci〜min(co, cutoffExclusive) の日数を日割り
    const effectiveCo = co < cutoffExclusive ? co : cutoffExclusive
    const coveredDays = differenceInDays(effectiveCo, ci)
    if (coveredDays > 0) {
      const dailyRate = (r.room_fee || 0) / stayDays
      roomFeeRevenue += Math.round(dailyRate * Math.min(coveredDays, stayDays))
    }

    // 清掃料・清掃費：チェックイン日が cutoffExclusive より前なら計上
    if (ci < cutoffExclusive) {
      cleaningFeeIncome += r.cleaning_fee || 0
      cleaningCost += r.cleaning_cost || 0
    }
  }

  return { roomFeeRevenue, cleaningFeeIncome, cleaningCost }
}

function fixedCostUpTo(room: Room, cutoffInclusive: Date): number {
  if (!room.contract_start) return 0
  const start = parseISO(room.contract_start)
  const months = Math.max(0,
    (cutoffInclusive.getFullYear() - start.getFullYear()) * 12 +
    (cutoffInclusive.getMonth() - start.getMonth()) + 1
  )
  return sumCosts(room.monthly_costs) * months
}

function computeScenario(
  room: Room,
  roomRes: Reservation[],
  utilityList: UtilityCost[],
  cutoffInclusive: Date,
  initialCost: number,
  label: string,
): RecoveryScenario {
  const cutoffExclusive = addDays(cutoffInclusive, 1)
  const cutoffYM = format(cutoffInclusive, 'yyyy-MM')

  const { roomFeeRevenue, cleaningFeeIncome, cleaningCost } = revenueUpTo(roomRes, cutoffExclusive)
  const fixedCost = fixedCostUpTo(room, cutoffInclusive)
  const utilityCost = utilityList
    .filter(u => u.room_id === room.id && u.year_month <= cutoffYM)
    .reduce((s, u) => s + (u.electricity || 0) + (u.water || 0), 0)

  const accumulatedRevenue = roomFeeRevenue + cleaningFeeIncome
  const accumulatedProfit = accumulatedRevenue - fixedCost - utilityCost - cleaningCost
  const remainingRecovery = Math.max(0, initialCost - accumulatedProfit)
  const recoveryPct = initialCost > 0
    ? Math.min(999, Math.round((accumulatedProfit / initialCost) * 100))
    : 0
  const cutoffDisplay = format(cutoffInclusive, 'yyyy/M/d', { locale: ja })

  return { label, cutoffDisplay, accumulatedRevenue, accumulatedProfit, remainingRecovery, recoveryPct }
}

// ────────────────────────────────────────────────

export default async function SimulationPage() {
  const [{ data: rooms }, { data: reservations }, { data: utilityCosts }] = await Promise.all([
    supabase.from('rooms').select('*').order('building_name'),
    supabase.from('reservations').select('*').order('check_in'),
    supabase.from('utility_costs').select('*'),
  ])

  const roomList = (rooms ?? []) as Room[]
  const resList = (reservations ?? []) as Reservation[]
  const utilityList = (utilityCosts ?? []) as UtilityCost[]

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const todayYM = currentYearMonth()

  // ── 共通カットオフ日の計算 ──
  // 今月末（日割りの基準）
  const monthEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0) // 当月最終日

  // 今年度末・来年度末（9月を年度末とする）
  const currentMonthIdx = now.getMonth() // 0-indexed (8=September)
  const fyEndYear = currentMonthIdx <= 8 ? now.getFullYear() : now.getFullYear() + 1
  const fyEndDate = new Date(fyEndYear, 8, 30)      // 9月30日
  const nextFyEndDate = new Date(fyEndYear + 1, 8, 30)

  // ── 過去6ヶ月の実績稼働率（部屋別）──
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

  // ── 部屋別の投資回収状況（4シナリオ） ──
  const recoveryByRoom: Record<string, RecoveryStats> = {}

  for (const room of roomList) {
    const initialCost = sumCosts(room.initial_costs)
    const roomRes = resList.filter(r => r.room_id === room.id)

    // 最終退去日（この部屋の全予約で最も遅いcheck_out）
    const lastCoStr = roomRes.length > 0
      ? roomRes.reduce((mx, r) => r.check_out > mx ? r.check_out : mx, roomRes[0].check_out)
      : todayStr
    const lastCheckoutDate = parseISO(lastCoStr)
    const finalCheckoutDate = lastCheckoutDate > monthEndDate ? lastCheckoutDate : monthEndDate

    // 4シナリオ
    const scenarios: RecoveryScenario[] = [
      computeScenario(room, roomRes, utilityList, monthEndDate,      initialCost, '今月末まで（日割り）'),
      computeScenario(room, roomRes, utilityList, finalCheckoutDate, initialCost, '最終退去日まで'),
      computeScenario(room, roomRes, utilityList, fyEndDate,         initialCost, `今年度末（${fyEndYear}/9月）`),
      computeScenario(room, roomRes, utilityList, nextFyEndDate,     initialCost, `来年度末（${fyEndYear + 1}/9月）`),
    ]

    // 今月末ベースの内訳（詳細表示用）
    const monthEndExclusive = addDays(monthEndDate, 1)
    const { roomFeeRevenue, cleaningFeeIncome, cleaningCost: accumulatedCleaningCost } =
      revenueUpTo(roomRes, monthEndExclusive)
    const accumulatedFixedCost = fixedCostUpTo(room, monthEndDate)
    const accumulatedUtilityCost = utilityList
      .filter(u => u.room_id === room.id && u.year_month <= todayYM)
      .reduce((s, u) => s + (u.electricity || 0) + (u.water || 0), 0)
    const accumulatedProfit = (roomFeeRevenue + cleaningFeeIncome) - accumulatedFixedCost - accumulatedUtilityCost - accumulatedCleaningCost
    const remainingRecovery = Math.max(0, initialCost - accumulatedProfit)

    // 運用開始からの月数
    let operationMonths = 0
    if (room.contract_start) {
      const start = parseISO(room.contract_start)
      operationMonths = Math.max(0,
        (now.getFullYear() - start.getFullYear()) * 12 +
        (now.getMonth() - start.getMonth()) + 1
      )
    }

    // 全予約にステータスと日割り取得済み額を付与
    const allReservations = roomRes.map(r => {
      const ci = parseISO(r.check_in)
      const co = parseISO(r.check_out)
      const status: 'past' | 'active' | 'future' =
        r.check_out <= todayStr ? 'past'
        : r.check_in <= todayStr ? 'active'
        : 'future'

      let earnedRoomFee = r.room_fee || 0
      if (status === 'active') {
        const stayDays = differenceInDays(co, ci)
        if (stayDays > 0) {
          const todayPlusOne = addDays(now, 1)
          const effectiveCo = co < todayPlusOne ? co : todayPlusOne
          const coveredDays = differenceInDays(effectiveCo, ci)
          earnedRoomFee = Math.round(((r.room_fee || 0) / stayDays) * Math.min(coveredDays, stayDays))
        }
      } else if (status === 'future') {
        earnedRoomFee = 0
      }

      return {
        id: r.id,
        guestName: r.guest_name,
        checkIn: r.check_in,
        checkOut: r.check_out,
        roomFee: r.room_fee || 0,
        cleaningFee: r.cleaning_fee || 0,
        cleaningCost: r.cleaning_cost || 0,
        status,
        earnedRoomFee,
      }
    }).sort((a, b) => b.checkIn.localeCompare(a.checkIn))

    recoveryByRoom[room.id] = {
      initialCost,
      roomFeeRevenue,
      cleaningFeeIncome,
      reservationCount: roomRes.length,
      pastReservations: allReservations,
      accumulatedFixedCost,
      accumulatedUtilityCost,
      accumulatedCleaningCost,
      accumulatedProfit,
      remainingRecovery,
      operationMonths,
      hasOperationData: roomRes.length > 0,
      scenarios,
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
