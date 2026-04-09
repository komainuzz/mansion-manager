import { supabase } from '@/lib/supabase'
import type { Room, Reservation } from '@/types'
import {
  buildMonthlySummaries, getRecentMonths, getFutureMonths, currentYearMonth
} from '@/lib/utils'
import SimulationChart from '@/components/simulation/SimulationChart'

export const dynamic = 'force-dynamic'

export default async function SimulationPage() {
  const [{ data: rooms }, { data: reservations }] = await Promise.all([
    supabase.from('rooms').select('*').order('name'),
    supabase.from('reservations').select('*').order('check_in'),
  ])

  const roomList = (rooms ?? []) as Room[]
  const resList = (reservations ?? []) as Reservation[]

  const ym = currentYearMonth()
  const pastMonths = getRecentMonths(6, ym)       // 過去6ヶ月（当月含む）
  const futureMonths = getFutureMonths(6, ym)     // 未来6ヶ月
  const allMonths = [...pastMonths, ...futureMonths]
  const forecastFrom = futureMonths[0] ?? ym       // 来月以降を予測とする

  const summaries = buildMonthlySummaries(roomList, resList, allMonths, forecastFrom)

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">シミュレーション</h2>
        <p className="text-sm text-gray-500 mt-0.5">過去6ヶ月の実績 + 今後6ヶ月の予測（既存予約ベース）</p>
      </div>
      <SimulationChart summaries={summaries} rooms={roomList} />
    </div>
  )
}
