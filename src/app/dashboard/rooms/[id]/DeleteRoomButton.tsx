'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function DeleteRoomButton({ id }: { id: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)

  async function handleDelete() {
    const { error } = await supabase.from('rooms').delete().eq('id', id)
    if (!error) {
      router.push('/dashboard/rooms')
      router.refresh()
    }
  }

  if (confirming) {
    return (
      <div className="flex gap-2 items-center">
        <span className="text-sm text-gray-500">本当に削除しますか？</span>
        <button onClick={handleDelete} className="btn-danger py-1.5 px-3 text-xs">削除する</button>
        <button onClick={() => setConfirming(false)} className="btn-secondary py-1.5 px-3 text-xs">キャンセル</button>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirming(true)} className="btn-danger">削除</button>
  )
}
