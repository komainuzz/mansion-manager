'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Room, Reservation, ChecklistItem } from '@/types'

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { label: '鍵の返却', checked: false },
  { label: '室内清掃完了', checked: false },
  { label: '備品・家電確認', checked: false },
  { label: '退去精算完了', checked: false },
]

interface Props {
  rooms: Room[]
  reservation?: Reservation
  defaultRoomId?: string
}

export default function ReservationForm({ rooms, reservation, defaultRoomId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [roomId, setRoomId] = useState(reservation?.room_id ?? defaultRoomId ?? '')
  const [guestName, setGuestName] = useState(reservation?.guest_name ?? '')
  const [checkIn, setCheckIn] = useState(reservation?.check_in ?? '')
  const [checkOut, setCheckOut] = useState(reservation?.check_out ?? '')
  const [roomFee, setRoomFee] = useState(String(reservation?.room_fee ?? ''))
  const [cleaningFee, setCleaningFee] = useState(String(reservation?.cleaning_fee ?? ''))
  const [cleaningCost, setCleaningCost] = useState(String(reservation?.cleaning_cost ?? ''))
  const [memo, setMemo] = useState(reservation?.memo ?? '')
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    reservation?.checklist && reservation.checklist.length > 0
      ? reservation.checklist
      : DEFAULT_CHECKLIST
  )
  const [newCheckItem, setNewCheckItem] = useState('')

  // 掲載価格を自動入力
  function handleRoomChange(id: string) {
    setRoomId(id)
    const room = rooms.find(r => r.id === id)
    if (room && !roomFee) setRoomFee(String(room.current_price))
  }

  function toggleCheck(idx: number) {
    setChecklist(prev => prev.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item))
  }
  function addCheckItem() {
    if (!newCheckItem.trim()) return
    setChecklist(prev => [...prev, { label: newCheckItem.trim(), checked: false }])
    setNewCheckItem('')
  }
  function removeCheckItem(idx: number) {
    setChecklist(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = {
      room_id: roomId,
      guest_name: guestName,
      check_in: checkIn,
      check_out: checkOut,
      room_fee: Number(roomFee) || 0,
      cleaning_fee: Number(cleaningFee) || 0,
      cleaning_cost: Number(cleaningCost) || 0,
      checklist,
      memo: memo || null,
    }

    let err
    if (reservation) {
      ;({ error: err } = await supabase.from('reservations').update(payload).eq('id', reservation.id))
    } else {
      ;({ error: err } = await supabase.from('reservations').insert(payload))
    }

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    router.push('/dashboard/reservations')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">部屋 *</label>
          <select className="input" required value={roomId} onChange={e => handleRoomChange(e.target.value)}>
            <option value="">選択してください</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">ゲスト名 *</label>
          <input className="input" required value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="例：山田 太郎" />
        </div>
        <div>
          <label className="label">チェックイン *</label>
          <input className="input" type="date" required value={checkIn} onChange={e => setCheckIn(e.target.value)} />
        </div>
        <div>
          <label className="label">チェックアウト *</label>
          <input className="input" type="date" required value={checkOut} onChange={e => setCheckOut(e.target.value)} />
        </div>
        <div>
          <label className="label">宿泊料（円）</label>
          <input className="input" type="number" value={roomFee} onChange={e => setRoomFee(e.target.value)} placeholder="150000" />
        </div>
        <div>
          <label className="label">清掃料（円・ゲスト負担）</label>
          <input className="input" type="number" value={cleaningFee} onChange={e => setCleaningFee(e.target.value)} placeholder="5000" />
        </div>
        <div>
          <label className="label">清掃費用（円・実費）</label>
          <input className="input" type="number" value={cleaningCost} onChange={e => setCleaningCost(e.target.value)} placeholder="3000" />
        </div>
        <div className="col-span-2">
          <label className="label">メモ</label>
          <textarea className="input min-h-[80px]" value={memo} onChange={e => setMemo(e.target.value)} placeholder="特記事項など" />
        </div>
      </div>

      {/* チェックリスト */}
      <div>
        <label className="label">退去チェックリスト</label>
        <div className="space-y-2 bg-gray-50 rounded-lg p-3">
          {checklist.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="checkbox" className="w-4 h-4 rounded text-blue-600"
                checked={item.checked} onChange={() => toggleCheck(i)} />
              <span className={`flex-1 text-sm ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                {item.label}
              </span>
              <button type="button" onClick={() => removeCheckItem(i)}
                className="text-gray-300 hover:text-red-400 text-sm">×</button>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input className="input text-sm py-1.5 flex-1" value={newCheckItem}
              onChange={e => setNewCheckItem(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCheckItem() } }}
              placeholder="項目を追加..." />
            <button type="button" onClick={addCheckItem}
              className="btn-secondary py-1.5 px-3 text-xs">追加</button>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? '保存中...' : reservation ? '更新する' : '登録する'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">キャンセル</button>
      </div>
    </form>
  )
}
