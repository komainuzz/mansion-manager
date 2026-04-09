import { supabase } from '@/lib/supabase'
import type { Room } from '@/types'
import RoomForm from '@/components/rooms/RoomForm'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function EditRoomPage({ params }: { params: { id: string } }) {
  const { data } = await supabase.from('rooms').select('*').eq('id', params.id).single()
  if (!data) notFound()
  const room = data as Room

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/rooms/${params.id}`} className="text-gray-400 hover:text-gray-600 text-sm">← 戻る</Link>
        <h2 className="text-2xl font-bold text-gray-900">部屋を編集：{room.name}</h2>
      </div>
      <div className="card">
        <RoomForm room={room} />
      </div>
    </div>
  )
}
