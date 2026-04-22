'use client'

import { useState } from 'react'
import type { Room } from '@/types'
import { roomDisplayName } from '@/lib/utils'
import RoomSimulationPanel, { type RecoveryStats } from './RoomSimulationPanel'

interface Props {
  rooms: Room[]
  occupancyByRoom: Record<string, number>
  recoveryByRoom: Record<string, RecoveryStats>
}

export default function RoomTabs({ rooms, occupancyByRoom, recoveryByRoom }: Props) {
  const [selectedId, setSelectedId] = useState(rooms[0]?.id ?? '')
  const room = rooms.find(r => r.id === selectedId)

  if (rooms.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">部屋が登録されていません</p>
  }

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-5">
        {rooms.map(r => (
          <button
            key={r.id}
            onClick={() => setSelectedId(r.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              r.id === selectedId
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {roomDisplayName(r)}
          </button>
        ))}
      </div>
      {room && (
        <RoomSimulationPanel
          room={room}
          actualOccupancy={occupancyByRoom[room.id] ?? 0}
          recovery={recoveryByRoom[room.id] ?? {
            initialCost: 0,
            accumulatedProfit: 0,
            remainingRecovery: 0,
            operationMonths: 0,
            hasOperationData: false,
          }}
        />
      )}
    </div>
  )
}
