import { supabase } from '@/lib/supabase'
import type { Room, Reservation, UtilityCost } from '@/types'
import {
  buildMonthlySummaries, getRecentMonths, getFutureMonths, currentYearMonth,
  isRoomActiveInMonth,
} from '@/lib/utils'
import {
  getDaysInMonth, startOfMonth, endOfMonth, differenceInDays,
  max as maxDate, min as minDate, parseISO, format, addMonths,
} from 'date-fns'
import SimulationChart from '@/components/simulation/SimulationChart'
import RoomTabs from '@/components/simulation/RoomTabs'

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

  const ym = currentYearMonth()
  const pastMonths = getRecentMonths(6, ym)
  const futureMonths = getFutureMonths(6, ym)
  const allMonths = [...pastMonths, ...futureMonths]
  const forecastFrom = format(addMonths(new Date(), 1), 'yyyy-MM')

  const summaries = buildMonthlySummaries(roomList, resList, utilityList, allMonths, forecastFrom)

  // 過去6ヶ月の実績稼働率を部屋別に計算
  const occupancyByRoom: Record<string, number> = {}
  for (const room of roomList) {
    let totalOccupied = 0
    let totalAvailable = 0
    const roomReservations = resList.filter(r => r.room_id === room.id)

    for (const month of pastMonths) {
      if (!isRoomActiveInMonth(room, month)) continue
      const monthStart = startOfMonth(parseISO(month + '-01'))
      const monthEnd = endOfMonth(monthStart)
      totalAvailable += getDaysInMonth(monthStart)

      for (const r of roomReservations) {
        const ci = parseISO(r.check_in)
        const co = parseISO(r.check_out)
        const overlapStart = maxDate([ci, monthStart])
        const overlapEnd = minDate([co, monthEnd])
        const days = differenceInDays(overlapEnd, overlapStart)
        if (days > 0) totalOccupied += days
      }
    }
    occupancyByRoom[room.id] = totalAvailable > 0 ? totalOccupied / totalAvailable : 0
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">シミュレーション</h2>
        <p className="text-sm text-gray-500 mt-0.5">部屋別の投資回収シミュレーション・収支予測</p>
      </div>

      {/* 部屋別投資回収シミュレーション */}
      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">部屋別 投資回収シミュレーション</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            稼働率を変えながら月次利益と初期投資の回収期間を試算できます
          </p>
        </div>
        <RoomTabs rooms={roomList} occupancyByRoom={occupancyByRoom} />
      </div>

      {/* 全体収支推移 */}
      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">全体の収支推移</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            過去6ヶ月の実績 + 今後6ヶ月の予測（既存予約ベース）
          </p>
        </div>
        <SimulationChart summaries={summaries} rooms={roomList} />
      </div>
    </div>
  )
}
