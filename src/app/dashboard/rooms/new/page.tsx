import RoomForm from '@/components/rooms/RoomForm'
import Link from 'next/link'

export default function NewRoomPage() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/rooms" className="text-gray-400 hover:text-gray-600 text-sm">← 戻る</Link>
        <h2 className="text-2xl font-bold text-gray-900">部屋を新規登録</h2>
      </div>
      <div className="card">
        <RoomForm />
      </div>
    </div>
  )
}
