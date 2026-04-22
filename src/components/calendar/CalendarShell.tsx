'use client'

import { useState } from 'react'
import type { Room, Reservation, Cleaning } from '@/types'
import GanttCalendar from './GanttCalendar'
import MonthlyOccupancyView from './MonthlyOccupancyView'

interface Props {
  rooms: Room[]
  reservations: Reservation[]
  cleanings: Cleaning[]
}

type View = 'gantt' | 'monthly'

export default function CalendarShell({ rooms, reservations, cleanings }: Props) {
  const [view, setView] = useState<View>('gantt')

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([
          { key: 'gantt',   label: 'ガントチャート' },
          { key: 'monthly', label: '月別稼働率' },
        ] as { key: View; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              view === key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'gantt' ? (
        <GanttCalendar rooms={rooms} reservations={reservations} cleanings={cleanings} />
      ) : (
        <MonthlyOccupancyView rooms={rooms} reservations={reservations} />
      )}
    </div>
  )
}
