import { supabase } from '@/lib/supabase'
import type { Room, Reservation } from '@/types'
import ReservationForm from '@/components/reservations/ReservationForm'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function EditReservationPage({ params }: { params: { id: string } }) {
  const [{ data: reservation }, { data: rooms }] = await Promise.all([
    supabase.from('reservations').select('*').eq('id', params.id).single(),
    supabase.from('rooms').select('*').order('building_name'),
  ])

  if (!reservation) notFound()

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/reservations/${params.id}`} className="text-gray-400 hover:text-gray-600 text-sm">← 戻る</Link>
        <h2 className="text-2xl font-bold text-gray-900">予約を編集</h2>
      </div>
      <div className="card">
        <ReservationForm rooms={(rooms ?? []) as Room[]} reservation={reservation as Reservation} />
      </div>
    </div>
  )
}
