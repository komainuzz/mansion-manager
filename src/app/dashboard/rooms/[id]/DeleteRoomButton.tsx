'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Trash2, AlertTriangle } from 'lucide-react'

export default function DeleteRoomButton({ id, roomName }: { id: string; roomName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    const { error } = await supabase.from('rooms').delete().eq('id', id)
    if (error) {
      setError(error.message)
      setDeleting(false)
      return
    }
    router.push('/dashboard/rooms')
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-danger flex items-center gap-1.5">
        <Trash2 size={14} />
        削除
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !deleting && setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">部屋を削除しますか？</p>
                <p className="text-sm text-gray-500 mt-0.5">{roomName}</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-5">
              この部屋に紐づく予約データもすべて削除されます。この操作は取り消せません。
            </p>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-danger flex-1 justify-center"
              >
                {deleting ? '削除中...' : '削除する'}
              </button>
              <button
                onClick={() => setOpen(false)}
                disabled={deleting}
                className="btn-secondary flex-1 justify-center"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
