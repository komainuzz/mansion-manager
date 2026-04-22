'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import type { UtilityCost } from '@/types'

interface Props {
  roomId: string
  yearMonth: string
  existing: UtilityCost | null
  elecEstimate: number
  waterEstimate: number
}

export default function UtilityEditor({ roomId, yearMonth, existing, elecEstimate, waterEstimate }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [elec, setElec] = useState(existing?.electricity != null ? String(existing.electricity) : '')
  const [water, setWater] = useState(existing?.water != null ? String(existing.water) : '')
  const [memo, setMemo] = useState(existing?.memo ?? '')
  const [saving, setSaving] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleSave() {
    setSaving(true)
    const payload = {
      room_id: roomId,
      year_month: yearMonth,
      electricity: elec ? Number(elec) : null,
      water: water ? Number(water) : null,
      memo: memo || null,
      updated_at: new Date().toISOString(),
    }
    if (existing) {
      await supabase.from('utility_costs').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('utility_costs').insert(payload)
    }
    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  async function handleDelete() {
    if (!existing) return
    setSaving(true)
    await supabase.from('utility_costs').delete().eq('id', existing.id)
    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
      >
        {existing ? '編集' : '入力'}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-gray-900 mb-1">実績を入力</h3>
        <p className="text-sm text-gray-500 mb-4">{yearMonth.replace('-', '年')}月</p>
        <div className="space-y-3">
          <div>
            <label className="label">電気代（円）</label>
            <input
              className="input"
              type="number"
              value={elec}
              onChange={e => setElec(e.target.value)}
              placeholder={elecEstimate > 0 ? `概算: ${elecEstimate.toLocaleString()}` : '例: 8000'}
            />
          </div>
          <div>
            <label className="label">水道代（円）</label>
            <input
              className="input"
              type="number"
              value={water}
              onChange={e => setWater(e.target.value)}
              placeholder={waterEstimate > 0 ? `概算: ${waterEstimate.toLocaleString()}` : '例: 3000'}
            />
          </div>
          <div>
            <label className="label">メモ</label>
            <input className="input" value={memo} onChange={e => setMemo(e.target.value)} placeholder="任意" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? '保存中...' : '保存'}
          </button>
          <button onClick={() => setOpen(false)} className="btn-secondary">キャンセル</button>
          {existing && (
            <button onClick={handleDelete} disabled={saving} className="btn-danger px-3">削除</button>
          )}
        </div>
      </div>
    </div>
  )
}
