import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Room, UtilityCost } from '@/types'
import { currentYearMonth, formatCurrency, roomDisplayName } from '@/lib/utils'
import UtilityEditor from '@/components/utilities/UtilityEditor'
import UtilityMonthNav from '@/components/utilities/UtilityMonthNav'
import UtilityCsvImport from '@/components/utilities/UtilityCsvImport'
import UtilityGridView from '@/components/utilities/UtilityGridView'

export const dynamic = 'force-dynamic'

function getGridMonths(utilityList: UtilityCost[], currentYM: string): string[] {
  const months = new Set<string>()
  const [cy, cm] = currentYM.split('-').map(Number)
  for (let i = 0; i < 18; i++) {
    const d = new Date(cy, cm - 1 - i, 1)
    months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  for (const u of utilityList) months.add(u.year_month)
  return Array.from(months).sort().reverse()
}

export default async function UtilitiesPage({
  searchParams,
}: {
  searchParams: { ym?: string; view?: string }
}) {
  const ym = searchParams.ym || currentYearMonth()
  const view = searchParams.view === 'grid' ? 'grid' : 'monthly'
  const [year, month] = ym.split('-')

  const [{ data: rooms }, { data: utilities }] = await Promise.all([
    supabase.from('rooms').select('*').order('building_name').order('room_number'),
    supabase.from('utility_costs').select('*').order('year_month', { ascending: false }),
  ])

  const roomList = (rooms ?? []) as Room[]
  const allUtilities = (utilities ?? []) as UtilityCost[]

  // 月別ビュー用
  const monthlyUtilities = allUtilities.filter(u => u.year_month === ym)
  const utilityMap = Object.fromEntries(monthlyUtilities.map(u => [u.room_id, u]))

  // 建物名でグループ化
  const buildings: Record<string, Room[]> = {}
  for (const room of roomList) {
    if (!buildings[room.building_name]) buildings[room.building_name] = []
    buildings[room.building_name].push(room)
  }

  const gridMonths = getGridMonths(allUtilities, ym)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">光熱費入力</h2>
          <p className="text-sm text-gray-500 mt-0.5">建物・部屋別に月次の水道光熱費を登録</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <UtilityCsvImport rooms={roomList} currentYM={ym} />
          {view === 'monthly' && <UtilityMonthNav currentYM={ym} />}
        </div>
      </div>

      {/* タブ */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <Link
          href={`/dashboard/utilities?ym=${ym}&view=monthly`}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            view === 'monthly'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          月別入力
        </Link>
        <Link
          href={`/dashboard/utilities?ym=${ym}&view=grid`}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            view === 'grid'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          部屋×月 一覧
        </Link>
      </div>

      {roomList.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">部屋が登録されていません</p>
        </div>
      ) : view === 'grid' ? (
        <UtilityGridView rooms={roomList} allUtilities={allUtilities} months={gridMonths} />
      ) : (
        <div className="space-y-6">
          {Object.entries(buildings).map(([building, buildingRooms]) => {
            const buildingTotal = buildingRooms.reduce((sum, room) => {
              const u = utilityMap[room.id]
              return sum + (u?.electricity || 0) + (u?.water || 0)
            }, 0)
            const actualCount = buildingRooms.filter(r => !!utilityMap[r.id]).length

            return (
              <div key={building} className="card overflow-hidden p-0">
                <div className="px-5 py-3 bg-slate-50 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{building}</h3>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span>{actualCount}/{buildingRooms.length}部屋 実績入力済み</span>
                    {buildingTotal > 0 && (
                      <span>
                        {year}年{parseInt(month)}月 合計：
                        <span className="font-semibold text-gray-900 ml-1">{formatCurrency(buildingTotal)}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-th">部屋</th>
                        <th className="table-th text-right">電気代</th>
                        <th className="table-th text-right">水道代</th>
                        <th className="table-th text-right">合計</th>
                        <th className="table-th text-center">状態</th>
                        <th className="table-th w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {buildingRooms.map(room => {
                        const actual = utilityMap[room.id]
                        const elec = actual?.electricity ?? room.utility_electricity_estimate
                        const water = actual?.water ?? room.utility_water_estimate
                        const isActual = !!actual
                        const total = (elec ?? 0) + (water ?? 0)

                        return (
                          <tr key={room.id} className="hover:bg-gray-50 transition-colors">
                            <td className="table-td font-medium">{roomDisplayName(room)}</td>
                            <td className="table-td text-right">
                              <span className={isActual ? 'text-gray-900' : 'text-gray-400'}>
                                {elec != null && elec > 0 ? formatCurrency(elec) : '—'}
                              </span>
                            </td>
                            <td className="table-td text-right">
                              <span className={isActual ? 'text-gray-900' : 'text-gray-400'}>
                                {water != null && water > 0 ? formatCurrency(water) : '—'}
                              </span>
                            </td>
                            <td className="table-td text-right font-semibold">
                              {total > 0 ? formatCurrency(total) : '—'}
                            </td>
                            <td className="table-td text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                isActual
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}>
                                {isActual ? '実績' : '概算'}
                              </span>
                            </td>
                            <td className="table-td">
                              <UtilityEditor
                                roomId={room.id}
                                yearMonth={ym}
                                existing={actual ?? null}
                                elecEstimate={room.utility_electricity_estimate}
                                waterEstimate={room.utility_water_estimate}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
