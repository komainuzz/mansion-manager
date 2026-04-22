import type { Room, UtilityCost } from '@/types'
import { formatCurrency, roomDisplayName, isRoomActiveInMonth } from '@/lib/utils'
import UtilityEditor from './UtilityEditor'

interface Props {
  rooms: Room[]
  allUtilities: UtilityCost[]
  months: string[]
}

export default function UtilityGridView({ rooms, allUtilities, months }: Props) {
  const utilityMap = new Map<string, UtilityCost>()
  for (const u of allUtilities) {
    utilityMap.set(`${u.room_id}:${u.year_month}`, u)
  }

  const buildings: Record<string, Room[]> = {}
  for (const room of rooms) {
    if (!buildings[room.building_name]) buildings[room.building_name] = []
    buildings[room.building_name].push(room)
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="table-th sticky left-0 bg-gray-50 z-10 min-w-[150px] border-r border-gray-200">部屋</th>
              {months.map(ym => {
                const [y, m] = ym.split('-')
                return (
                  <th key={ym} className="table-th text-center whitespace-nowrap min-w-[110px]">
                    {y}年{parseInt(m)}月
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {Object.entries(buildings).map(([building, buildingRooms]) => (
              <>
                <tr key={`bld-${building}`}>
                  <td
                    colSpan={months.length + 1}
                    className="px-4 py-2 bg-slate-50 text-xs font-semibold text-gray-500 tracking-wide border-y border-gray-100 sticky left-0"
                  >
                    {building}
                  </td>
                </tr>
                {buildingRooms.map(room => (
                  <tr key={room.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                    <td className="table-td font-medium sticky left-0 bg-white border-r border-gray-100 whitespace-nowrap">
                      {roomDisplayName(room)}
                    </td>
                    {months.map(ym => {
                      const utility = utilityMap.get(`${room.id}:${ym}`)
                      const active = isRoomActiveInMonth(room, ym)
                      const total = utility ? (utility.electricity || 0) + (utility.water || 0) : null

                      if (!active) {
                        return (
                          <td key={ym} className="table-td text-center text-gray-300 text-xs">
                            —
                          </td>
                        )
                      }

                      if (!utility) {
                        return (
                          <td key={ym} className="table-td text-center bg-red-50">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-xs text-red-400 font-medium">未入力</span>
                              <UtilityEditor
                                roomId={room.id}
                                yearMonth={ym}
                                existing={null}
                                elecEstimate={room.utility_electricity_estimate}
                                waterEstimate={room.utility_water_estimate}
                              />
                            </div>
                          </td>
                        )
                      }

                      return (
                        <td key={ym} className="table-td text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="font-medium text-gray-900">
                              {total ? formatCurrency(total) : '—'}
                            </span>
                            <UtilityEditor
                              roomId={room.id}
                              yearMonth={ym}
                              existing={utility}
                              elecEstimate={room.utility_electricity_estimate}
                              waterEstimate={room.utility_water_estimate}
                            />
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
