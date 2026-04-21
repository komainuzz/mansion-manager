'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { CalendarPlus } from 'lucide-react'

interface Props {
  id: string
  currentCheckOut: string
  currentRoomFee: number
}

export default function ExtendReservationButton({ id, currentCheckOut, currentRoomFee }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [newCheckOut, setNewCheckOut] = useState('')
  const [checkOutTime, setCheckOutTime] = useState('午前')
  const [extensionFee, setExtensionFee] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  function handleOpen() {
    setNewCheckOut('')
    setCheckOutTime('午前')
    setExtensionFee('')
    setError(null)
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newCheckOut || newCheckOut <= currentCheckOut) {
      setError('延長後のチェックアウトは現在より後の日付を指定してください')
      return
    }
    setSaving(true)
    setError(null)

    const newRoomFee = currentRoomFee + (Number(extensionFee) || 0)
    const { error: err } = await supabase
      .from('reservations')
      .update({ check_out: newCheckOut, check_out_time: checkOutTime, room_fee: newRoomFee })
      .eq('id', id)

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button onClick={handleOpen} className="btn-secondary flex items-center gap-1.5">
        <CalendarPlus size={14} />
        延長
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !saving && setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold text-gray-900 mb-1">滞在を延長する</h3>
            <p className="text-sm text-gray-500 mb-5">
              現在のチェックアウト：<span className="font-medium text-gray-700">{currentCheckOut}</span>
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">新しいチェックアウト日 *</label>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    type="date"
                    required
                    min={currentCheckOut}
                    value={newCheckOut}
                    onChange={e => setNewCheckOut(e.target.value)}
                  />
                  <select className="input w-24" value={checkOutTime} onChange={e => setCheckOutTime(e.target.value)}>
                    <option value="午前">午前</option>
                    <option value="午後">午後</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">延長料金（追加分・円）</label>
                <input
                  className="input"
                  type="number"
                  value={extensionFee}
                  onChange={e => setExtensionFee(e.target.value)}
                  placeholder="0"
                />
                {extensionFee && (
                  <p className="text-xs text-gray-500 mt-1">
                    宿泊料合計：{(currentRoomFee + (Number(extensionFee) || 0)).toLocaleString()}円
                  </p>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? '更新中...' : '延長する'}
                </button>
                <button type="button" onClick={() => setOpen(false)} disabled={saving} className="btn-secondary flex-1 justify-center">
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
