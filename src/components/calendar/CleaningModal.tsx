'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Trash2 } from 'lucide-react'
import type { Cleaning } from '@/types'

interface Props {
  roomId: string
  roomName: string
  date: string            // YYYY-MM-DD
  cleaning?: Cleaning     // 編集時は既存データ
  onClose: () => void
  onSaved: () => void
}

export default function CleaningModal({ roomId, roomName, date, cleaning, onClose, onSaved }: Props) {
  const [scheduledDate, setScheduledDate] = useState(cleaning?.scheduled_date ?? date)
  const [startTime, setStartTime] = useState(cleaning?.start_time ?? '')
  const [endTime, setEndTime] = useState(cleaning?.end_time ?? '')
  const [memo, setMemo] = useState(cleaning?.memo ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      room_id: roomId,
      scheduled_date: scheduledDate,
      start_time: startTime || null,
      end_time: endTime || null,
      memo: memo || null,
    }

    const { error: err } = cleaning
      ? await supabase.from('cleanings').update(payload).eq('id', cleaning.id)
      : await supabase.from('cleanings').insert(payload)

    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  async function handleDelete() {
    if (!cleaning) return
    setDeleting(true)
    await supabase.from('cleanings').delete().eq('id', cleaning.id)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-semibold text-gray-900">{cleaning ? '清掃予定を編集' : '清掃予定を登録'}</p>
            <p className="text-sm text-gray-500">{roomName}</p>
          </div>
          {cleaning && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="label">清掃日 *</label>
            <input
              className="input"
              type="date"
              required
              value={scheduledDate}
              onChange={e => setScheduledDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">開始時間</label>
              <input
                className="input"
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                placeholder="11:00"
              />
            </div>
            <div>
              <label className="label">終了時間</label>
              <input
                className="input"
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                placeholder="15:00"
              />
            </div>
          </div>

          <div>
            <label className="label">メモ</label>
            <input
              className="input"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="清掃業者名など"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? '保存中...' : '保存する'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
