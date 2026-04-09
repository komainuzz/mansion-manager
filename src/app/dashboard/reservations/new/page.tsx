import { supabase } from '@/lib/supabase'
import type { Room } from '@/types'
import ReservationForm from '@/components/reservations/ReservationForm'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: { room_id?: string }
}) {
  const { data } = await supabase.from('rooms').select('*').order('name')
  const rooms = (data ?? []) as Room[]

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/reservations" className="text-gray-400 hover:text-gray-600 text-sm">← 戻る</Link>
        <h2 className="text-2xl font-bold text-gray-900">予約を新規登録</h2>
      </div>
      <div className="card">
        <ReservationForm rooms={rooms} defaultRoomId={searchParams.room_id} />
      </div>
    </div>
  )
}
