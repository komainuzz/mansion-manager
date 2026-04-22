import { supabase } from '@/lib/supabase'
import type { Room, Reservation, UtilityCost } from '@/types'
import {
  buildMonthlySummaries, getRecentMonths, getFutureMonths, currentYearMonth,
} from '@/lib/utils'
import { format, addMonths } from 'date-fns'
import SimulationChart from '@/components/simulation/SimulationChart'

export const dynamic = 'force-dynamic'

export default async function ForecastPage() {
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

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">収支予測</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          過去6ヶ月の実績 + 今後6ヶ月の予測（既存予約ベース）
        </p>
      </div>
      <SimulationChart summaries={summaries} />
    </div>
  )
}
