'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Room } from '@/types'
import { roomDisplayName, formatCurrency } from '@/lib/utils'
import RoomSimulationPanel, { type RecoveryStats } from './RoomSimulationPanel'

interface Props {
  rooms: Room[]
  occupancyByRoom: Record<string, number>
  recoveryByRoom: Record<string, RecoveryStats>
}

const emptyRecovery: RecoveryStats = {
  initialCost: 0,
  roomFeeRevenue: 0,
  cleaningFeeIncome: 0,
  reservationCount: 0,
  pastReservations: [],
  accumulatedFixedCost: 0,
  accumulatedUtilityCost: 0,
  accumulatedCleaningCost: 0,
  accumulatedProfit: 0,
  remainingRecovery: 0,
  operationMonths: 0,
  hasOperationData: false,
  scenarios: [],
}

export default function RoomAccordion({ rooms, occupancyByRoom, recoveryByRoom }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    rooms.length > 0 ? { [rooms[0].id]: true } : {}
  )

  function toggle(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (rooms.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">部屋が登録されていません</p>
  }

  return (
    <div className="space-y-3">
      {rooms.map(room => {
        const open = !!expanded[room.id]
        const recovery = recoveryByRoom[room.id] ?? emptyRecovery
        const occ = Math.round((occupancyByRoom[room.id] ?? 0) * 100)
        const isRecovered = recovery.initialCost > 0 && recovery.remainingRecovery <= 0
        const recoveryPct = recovery.initialCost > 0
          ? Math.min(100, Math.round((recovery.accumulatedProfit / recovery.initialCost) * 100))
          : null

        return (
          <div key={room.id} className="card p-0 overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(room.id)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="font-semibold text-gray-900">{roomDisplayName(room)}</span>
                  {occ > 0 && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      occ >= 85 ? 'bg-emerald-100 text-emerald-700'
                      : occ >= 60 ? 'bg-blue-100 text-blue-700'
                      : occ >= 30 ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                    }`}>
                      稼働率 {occ}%
                    </span>
                  )}
                  {isRecovered && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      回収済み ✓
                    </span>
                  )}
                </div>

                {recoveryPct !== null && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-xs">
                      <div
                        className={`h-full rounded-full ${isRecovered ? 'bg-emerald-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.max(1, recoveryPct)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {isRecovered
                        ? '回収済み'
                        : `${recoveryPct}% 回収済み｜残 ${formatCurrency(recovery.remainingRecovery)}`
                      }
                    </span>
                  </div>
                )}
              </div>

              <ChevronDown
                className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              />
            </button>

            {open && (
              <div className="border-t border-gray-100 px-5 pb-5 pt-4">
                <RoomSimulationPanel
                  room={room}
                  actualOccupancy={occupancyByRoom[room.id] ?? 0}
                  recovery={recovery}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
