'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Room } from '@/types'

type KVRow = { key: string; value: string }

function toKVRows(obj: Record<string, number>): KVRow[] {
  const entries = Object.entries(obj)
  return entries.length > 0 ? entries.map(([k, v]) => ({ key: k, value: String(v) })) : [{ key: '', value: '' }]
}

function fromKVRows(rows: KVRow[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const { key, value } of rows) {
    if (key.trim()) result[key.trim()] = Number(value) || 0
  }
  return result
}

interface Props {
  room?: Room
}

export default function RoomForm({ room }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(room?.name ?? '')
  const [station, setStation] = useState(room?.nearest_station ?? '')
  const [address, setAddress] = useState(room?.address ?? '')
  const [contractStart, setContractStart] = useState(room?.contract_start ?? '')
  const [keyLocation, setKeyLocation] = useState(room?.key_location ?? '')
  const [features, setFeatures] = useState(room?.features ?? '')
  const [currentPrice, setCurrentPrice] = useState(String(room?.current_price ?? ''))
  const [initialCosts, setInitialCosts] = useState<KVRow[]>(toKVRows(room?.initial_costs ?? {}))
  const [monthlyCosts, setMonthlyCosts] = useState<KVRow[]>(toKVRows(room?.monthly_costs ?? {}))

  const updateKV = (setter: React.Dispatch<React.SetStateAction<KVRow[]>>, idx: number, field: 'key' | 'value', val: string) => {
    setter(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r))
  }
  const addKV = (setter: React.Dispatch<React.SetStateAction<KVRow[]>>) => {
    setter(prev => [...prev, { key: '', value: '' }])
  }
  const removeKV = (setter: React.Dispatch<React.SetStateAction<KVRow[]>>, idx: number) => {
    setter(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = {
      name,
      nearest_station: station || null,
      address: address || null,
      contract_start: contractStart || null,
      key_location: keyLocation || null,
      features: features || null,
      current_price: Number(currentPrice) || 0,
      initial_costs: fromKVRows(initialCosts),
      monthly_costs: fromKVRows(monthlyCosts),
    }

    let err
    if (room) {
      ;({ error: err } = await supabase.from('rooms').update(payload).eq('id', room.id))
    } else {
      ;({ error: err } = await supabase.from('rooms').insert(payload))
    }

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    router.push('/dashboard/rooms')
    router.refresh()
  }

  const KVSection = ({
    label, rows, setter
  }: { label: string; rows: KVRow[]; setter: React.Dispatch<React.SetStateAction<KVRow[]>> }) => (
    <div>
      <label className="label">{label}</label>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2">
            <input className="input flex-1" placeholder="項目名" value={row.key}
              onChange={e => updateKV(setter, i, 'key', e.target.value)} />
            <input className="input w-36" placeholder="金額" type="number" value={row.value}
              onChange={e => updateKV(setter, i, 'value', e.target.value)} />
            <button type="button" onClick={() => removeKV(setter, i)}
              className="px-2 text-gray-400 hover:text-red-500 text-lg">×</button>
          </div>
        ))}
        <button type="button" onClick={() => addKV(setter)}
          className="text-sm text-blue-600 hover:underline">+ 追加</button>
      </div>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">部屋名 *</label>
          <input className="input" required value={name} onChange={e => setName(e.target.value)} placeholder="例：渋谷マンション201" />
        </div>
        <div>
          <label className="label">最寄駅</label>
          <input className="input" value={station} onChange={e => setStation(e.target.value)} placeholder="例：渋谷駅 徒歩5分" />
        </div>
        <div>
          <label className="label">契約開始日</label>
          <input className="input" type="date" value={contractStart} onChange={e => setContractStart(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">住所</label>
          <input className="input" value={address} onChange={e => setAddress(e.target.value)} placeholder="例：東京都渋谷区○○1-2-3" />
        </div>
        <div>
          <label className="label">鍵の場所</label>
          <input className="input" value={keyLocation} onChange={e => setKeyLocation(e.target.value)} placeholder="例：キーボックス・玄関右" />
        </div>
        <div>
          <label className="label">掲載価格（円/月）</label>
          <input className="input" type="number" value={currentPrice} onChange={e => setCurrentPrice(e.target.value)} placeholder="150000" />
        </div>
        <div className="col-span-2">
          <label className="label">設備・特徴</label>
          <textarea className="input min-h-[80px]" value={features} onChange={e => setFeatures(e.target.value)}
            placeholder="例：WiFi完備、洗濯機、エアコン" />
        </div>
      </div>

      <KVSection label="初期費用" rows={initialCosts} setter={setInitialCosts} />
      <KVSection label="月次固定費" rows={monthlyCosts} setter={setMonthlyCosts} />

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? '保存中...' : room ? '更新する' : '登録する'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">キャンセル</button>
      </div>
    </form>
  )
}
