import { supabase } from '@/lib/supabase'
import type { Room, Reservation, Cleaning } from '@/types'
import CalendarShell from '@/components/calendar/CalendarShell'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const [{ data: rooms }, { data: reservations }, { data: cleanings }] = await Promise.all([
    supabase.from('rooms').select('*').order('building_name'),
    supabase.from('reservations').select('*').order('check_in'),
    supabase.from('cleanings').select('*').order('scheduled_date'),
  ])

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">稼働カレンダー</h2>
        <p className="text-sm text-gray-500 mt-0.5">ガントチャート・月別稼働率の切り替え表示</p>
      </div>
      <CalendarShell
        rooms={(rooms ?? []) as Room[]}
        reservations={(reservations ?? []) as Reservation[]}
        cleanings={(cleanings ?? []) as Cleaning[]}
      />
    </div>
  )
}
