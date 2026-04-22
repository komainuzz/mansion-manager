'use client'

import { useState } from 'react'
import { ChevronDown, ChevronsUpDown } from 'lucide-react'
import type { Room } from '@/types'
import { roomDisplayName, formatCurrency } from '@/lib/utils'
import RoomSimulationPanel, { type RecoveryStats } from './RoomSimulationPanel'

interface Props {
  rooms: Room[]
  occupancyByRoom: Record<string, number>
  recoveryByRoom: Record<string, RecoveryStats>
}

const DEFAULT_STATS: RecoveryStats = {
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
}

function priceHint(occ: number): { label: string; color: string } {
  if (occ >= 85) return { label: '値上げ検討', color: 'bg-emerald-100 text-emerald-700' }
  if (occ >= 60) return { label: '適正稼働',   color: 'bg-blue-100 text-blue-700' }
  if (occ >= 30) return { label: '稼働率低め', color: 'bg-amber-100 text-amber-700' }
  if (occ > 0)   return { label: '要見直し',   color: 'bg-red-100 text-red-600' }
  return           { label: 'データなし',   color: 'bg-gray-100 text-gray-500' }
}

export default function RoomAccordion({ rooms, occupancyByRoom, recoveryByRoom }: Props) {
  const [expandedIds, setExpandedIds] = useState<string[]>(
    rooms.slice(0, 1).map(r => r.id)
  )

  if (rooms.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">部屋が登録されていません</p>
  }

  const allExpanded = expandedIds.length === rooms.length

  function toggle(id: string) {
    setExpandedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function toggleAll() {
    setExpandedIds(allExpanded ? [] : rooms.map(r => r.id))
  }

  return (
    <div className="space-y-3">
      {/* 全展開/折りたたみ */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={toggleAll}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ChevronsUpDown size={14} />
          {allExpanded ? 'すべて折りたたむ' : 'すべて展開'}
        </button>
      </div>

      {rooms.map(room => {
        const stats = recoveryByRoom[room.id] ?? DEFAULT_STATS
        const isExpanded = expandedIds.includes(room.id)
        const hasInitial = stats.initialCost > 0
        const isRecovered = hasInitial && stats.remainingRecovery <= 0
        const pct = hasInitial
          ? Math.min(100, Math.max(0, Math.round((stats.accumulatedProfit / stats.initialCost) * 100)))
          : 0
        const occ = Math.round((occupancyByRoom[room.id] ?? 0) * 100)
        const hint = priceHint(occ)

        return (
          <div key={room.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* ヘッダー（常時表示） */}
            <button
              type="button"
              onClick={() => toggle(room.id)}
              className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left cursor-pointer"
            >
              {/* 部屋名 + バッジ */}
              <div className="w-40 shrink-0">
                <p className="font-semibold text-gray-900 truncate">{roomDisplayName(room)}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {isRecovered && (
                    <span className="text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                      回収済み ✓
                    </span>
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${hint.color}`}>
                    {occ > 0 ? `実績${occ}% ` : ''}{hint.label}
                  </span>
                </div>
              </div>

              {/* 進捗バー + % */}
              <div className="flex-1 min-w-0">
                {hasInitial ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>回収進捗</span>
                      <span className="font-medium text-gray-600">{pct}%</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isRecovered ? 'bg-emerald-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.max(1, pct)}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">初期投資未登録</p>
                )}
              </div>

              {/* 数値3列 */}
              <div className="hidden sm:flex items-center gap-5 shrink-0 text-sm">
                <div className="text-center w-24">
                  <p className="text-xs text-gray-400 mb-0.5">初期投資</p>
                  <p className="font-medium text-gray-700">
                    {hasInitial ? formatCurrency(stats.initialCost) : '—'}
                  </p>
                </div>
                <div className="text-center w-24">
                  <p className="text-xs text-gray-400 mb-0.5">累積利益</p>
                  <p className={`font-medium ${
                    !hasInitial ? 'text-gray-400' :
                    stats.accumulatedProfit >= 0 ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {hasInitial ? formatCurrency(stats.accumulatedProfit) : '—'}
                  </p>
                </div>
                <div className="text-center w-24">
                  <p className="text-xs text-gray-400 mb-0.5">残回収額</p>
                  <p className={`font-medium ${isRecovered ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {!hasInitial ? '—' :
                     isRecovered ? '回収済み' :
                     formatCurrency(stats.remainingRecovery)}
                  </p>
                </div>
              </div>

              <ChevronDown
                size={18}
                className={`text-gray-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              />
            </button>

            {/* 詳細パネル（展開時のみ） */}
            {isExpanded && (
              <div className="border-t border-gray-100 p-5 bg-gray-50/50">
                <RoomSimulationPanel
                  room={room}
                  actualOccupancy={occupancyByRoom[room.id] ?? 0}
                  recovery={stats}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
