'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Room } from '@/types'

type KVRow = { key: string; value: string }

function toKVRows(obj: Record<string, number>): KVRow[] {
  const entries = Object.entries(obj)
  return entries.length > 0 ? entries.map(([k, v]) => ({ key: k, value: String(v) })) : []
}

function fromKVRows(rows: KVRow[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const { key, value } of rows) {
    if (key.trim()) result[key.trim()] = Number(value) || 0
  }
  return result
}

const DEFAULT_MONTHLY_ROWS: KVRow[] = [
  { key: '家賃', value: '' },
  { key: '管理費', value: '' },
  { key: '共益費', value: '' },
]

const DEFAULT_INITIAL_ROWS: KVRow[] = [
  { key: '家具', value: '' },
  { key: '契約費用', value: '' },
]

interface Props { room?: Room }

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-2 border-b border-gray-100 pb-1 mt-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{children}</p>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer" onClick={() => onChange(!checked)}>
      <div className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}>
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
}

export default function RoomForm({ room }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [buildingName, setBuildingName]   = useState(room?.building_name ?? '')
  const [roomNumber, setRoomNumber]       = useState(room?.room_number ?? '')
  const [postalCode, setPostalCode]       = useState(room?.postal_code ?? '')
  const [address, setAddress]             = useState(room?.address ?? '')
  const [contractStart, setContractStart] = useState(room?.contract_start ?? '')
  const [contractEnd, setContractEnd]     = useState(room?.contract_end ?? '')
  const [station, setStation]               = useState(room?.nearest_station ?? '')
  const [stationTransport, setStationTransport] = useState(room?.nearest_station_transport ?? '徒歩')
  const [stationMin, setStationMin]         = useState(room?.nearest_station_minutes != null ? String(room.nearest_station_minutes) : '')
  const [mgmtCompany, setMgmtCompany]     = useState(room?.management_company ?? '')
  const [mgmtContact, setMgmtContact]     = useState(room?.management_company_contact ?? '')
  const [keyLocation, setKeyLocation]     = useState(room?.key_location ?? '')
  const [mailboxCode, setMailboxCode]     = useState(room?.mailbox_code ?? '')
  const [hasParking, setHasParking]       = useState(room?.has_parking ?? false)
  const [parkingFee, setParkingFee]       = useState(room?.parking_fee ? String(room.parking_fee) : '')
  const [wifiDetail, setWifiDetail]       = useState(room?.wifi_detail ?? '')
  const [electricity, setElectricity]     = useState(room?.electricity ?? '')
  const [waterHeater, setWaterHeater]     = useState(room?.water_heater ?? '')
  const [gas, setGas]                     = useState(room?.gas ?? '')
  const [waterHeaterModel, setWaterHeaterModel] = useState(room?.water_heater_model ?? '')
  const [features, setFeatures]           = useState(room?.features ?? '')
  const [currentPrice, setCurrentPrice]   = useState(room?.current_price ? String(room.current_price) : '')
  const [priceLong, setPriceLong]         = useState(room?.price_long ? String(room.price_long) : '')
  const [priceCampaign, setPriceCampaign] = useState(room?.price_campaign ? String(room.price_campaign) : '')
  const [elecEstimate, setElecEstimate]   = useState(room?.utility_electricity_estimate ? String(room.utility_electricity_estimate) : '')
  const [waterEstimate, setWaterEstimate] = useState(room?.utility_water_estimate ? String(room.utility_water_estimate) : '')
  const [initialCosts, setInitialCosts]   = useState<KVRow[]>(room ? toKVRows(room.initial_costs) : DEFAULT_INITIAL_ROWS)
  const [monthlyCosts, setMonthlyCosts]   = useState<KVRow[]>(room ? toKVRows(room.monthly_costs) : DEFAULT_MONTHLY_ROWS)

  const updateKV = (setter: React.Dispatch<React.SetStateAction<KVRow[]>>, idx: number, field: 'key' | 'value', val: string) =>
    setter(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r))
  const addKV    = (setter: React.Dispatch<React.SetStateAction<KVRow[]>>) =>
    setter(prev => [...prev, { key: '', value: '' }])
  const removeKV = (setter: React.Dispatch<React.SetStateAction<KVRow[]>>, idx: number) =>
    setter(prev => prev.filter((_, i) => i !== idx))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = {
      building_name: buildingName,
      room_number: roomNumber || null,
      postal_code: postalCode || null,
      nearest_station: station || null,
      nearest_station_transport: stationTransport,
      nearest_station_minutes: stationMin ? Number(stationMin) : null,
      address: address || null,
      contract_start: contractStart || null,
      contract_end: contractEnd || null,
      management_company: mgmtCompany || null,
      management_company_contact: mgmtContact || null,
      key_location: keyLocation || null,
      mailbox_code: mailboxCode || null,
      has_parking: hasParking,
      parking_fee: Number(parkingFee) || 0,
      has_wifi: wifiDetail.trim().length > 0,
      wifi_detail: wifiDetail.trim() || null,
      electricity: electricity || null,
      water_heater: waterHeater || null,
      gas: gas || null,
      water_heater_model: waterHeaterModel || null,
      features: features || null,
      current_price: Number(currentPrice) || 0,
      price_long: Number(priceLong) || 0,
      price_campaign: Number(priceCampaign) || 0,
      utility_electricity_estimate: Number(elecEstimate) || 0,
      utility_water_estimate: Number(waterEstimate) || 0,
      initial_costs: fromKVRows(initialCosts),
      monthly_costs: fromKVRows(monthlyCosts),
    }

    let err
    if (room) {
      ;({ error: err } = await supabase.from('rooms').update(payload).eq('id', room.id))
    } else {
      ;({ error: err } = await supabase.from('rooms').insert(payload))
    }

    if (err) { setError(err.message); setLoading(false); return }
    router.push('/dashboard/rooms')
    router.refresh()
  }

  const KVSection = ({ label, rows, setter }: { label: string; rows: KVRow[]; setter: React.Dispatch<React.SetStateAction<KVRow[]>> }) => (
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
              className="px-2 text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
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

        {/* 基本情報 */}
        <SectionHeader>基本情報</SectionHeader>
        <div>
          <label className="label">建物名 *</label>
          <input className="input" required value={buildingName} onChange={e => setBuildingName(e.target.value)} placeholder="例：渋谷マンション" />
        </div>
        <div>
          <label className="label">部屋番号</label>
          <input className="input" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="例：201" />
        </div>
        <div>
          <label className="label">郵便番号</label>
          <input className="input" value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="123-4567" />
        </div>
        <div>
          <label className="label">契約開始日</label>
          <input className="input" type="date" value={contractStart} onChange={e => setContractStart(e.target.value)} />
        </div>
        <div>
          <label className="label">解約日</label>
          <input className="input" type="date" value={contractEnd} onChange={e => setContractEnd(e.target.value)} />
        </div>
        <div className="col-span-1" />
        <div className="col-span-2">
          <label className="label">住所</label>
          <input className="input" value={address} onChange={e => setAddress(e.target.value)} placeholder="例：東京都渋谷区○○1-2-3" />
        </div>

        {/* アクセス */}
        <SectionHeader>アクセス</SectionHeader>
        <div>
          <label className="label">最寄駅</label>
          <input className="input" value={station} onChange={e => setStation(e.target.value)} placeholder="例：渋谷駅" />
        </div>
        <div>
          <label className="label">交通手段・時間（分）</label>
          <div className="flex gap-2">
            <select className="input w-28 shrink-0" value={stationTransport} onChange={e => setStationTransport(e.target.value)}>
              <option value="徒歩">徒歩</option>
              <option value="バス">バス</option>
              <option value="自転車">自転車</option>
              <option value="車">車</option>
            </select>
            <input className="input" type="number" min="0" value={stationMin} onChange={e => setStationMin(e.target.value)} placeholder="5" />
          </div>
        </div>

        {/* 管理情報 */}
        <SectionHeader>管理情報</SectionHeader>
        <div>
          <label className="label">管理会社</label>
          <input className="input" value={mgmtCompany} onChange={e => setMgmtCompany(e.target.value)} placeholder="例：○○不動産" />
        </div>
        <div>
          <label className="label">管理会社の連絡先</label>
          <input className="input" value={mgmtContact} onChange={e => setMgmtContact(e.target.value)} placeholder="例：03-1234-5678" />
        </div>
        <div>
          <label className="label">鍵の場所</label>
          <input className="input" value={keyLocation} onChange={e => setKeyLocation(e.target.value)} placeholder="例：キーボックス・玄関右" />
        </div>
        <div>
          <label className="label">ポストの開け方（番号）</label>
          <input className="input" value={mailboxCode} onChange={e => setMailboxCode(e.target.value)} placeholder="例：1234" />
        </div>

        {/* 設備 */}
        <SectionHeader>設備・インフラ</SectionHeader>
        {/* 駐車場 */}
        <div className="col-span-2">
          <Toggle label="駐車場あり" checked={hasParking} onChange={v => { setHasParking(v); if (!v) setParkingFee('') }} />
        </div>
        {hasParking && (
          <div>
            <label className="label">駐車場の契約料（円/月）</label>
            <input className="input" type="number" value={parkingFee} onChange={e => setParkingFee(e.target.value)} placeholder="例：10000" />
          </div>
        )}
        {!hasParking && <div />}

        {/* WiFi */}
        <div className="col-span-2">
          <label className="label">WiFi（空欄 = なし）</label>
          <input
            className="input"
            value={wifiDetail}
            onChange={e => setWifiDetail(e.target.value)}
            placeholder="例：Softbank契約中 / ポケットWiFi利用中 / 建物内使用可能"
          />
        </div>

        {/* 電気 */}
        <div>
          <label className="label">電気</label>
          <input className="input" value={electricity} onChange={e => setElectricity(e.target.value)} placeholder="例：東京電力 30A" />
        </div>
        <div>
          <label className="label">電気温水器</label>
          <input className="input" value={waterHeater} onChange={e => setWaterHeater(e.target.value)} placeholder="例：○○製 200L" />
        </div>

        {/* ガス */}
        <div>
          <label className="label">ガス契約会社</label>
          <input className="input" value={gas} onChange={e => setGas(e.target.value)} placeholder="例：東京ガス / プロパン" />
        </div>
        <div>
          <label className="label">給湯器の型番</label>
          <input className="input" value={waterHeaterModel} onChange={e => setWaterHeaterModel(e.target.value)} placeholder="例：RUF-A1610SAW" />
        </div>

        <div className="col-span-2">
          <label className="label">設備・特徴</label>
          <input className="input" value={features} onChange={e => setFeatures(e.target.value)} placeholder="例：洗濯機 エアコン IH" />
        </div>

        {/* 掲載価格 */}
        <SectionHeader>掲載価格（円/月）</SectionHeader>
        <div>
          <label className="label">基本プラン</label>
          <input className="input" type="number" value={currentPrice} onChange={e => setCurrentPrice(e.target.value)} placeholder="150000" />
        </div>
        <div>
          <label className="label">ロングプラン</label>
          <input className="input" type="number" value={priceLong} onChange={e => setPriceLong(e.target.value)} placeholder="130000" />
        </div>
        <div>
          <label className="label">キャンペーン価格</label>
          <input className="input" type="number" value={priceCampaign} onChange={e => setPriceCampaign(e.target.value)} placeholder="120000" />
        </div>

        {/* 水道光熱費の概算ベース */}
        <SectionHeader>水道光熱費 概算ベース（円/月）</SectionHeader>
        <div>
          <label className="label">電気代（概算）</label>
          <input className="input" type="number" value={elecEstimate} onChange={e => setElecEstimate(e.target.value)} placeholder="8000" />
        </div>
        <div>
          <label className="label">水道代（概算）</label>
          <input className="input" type="number" value={waterEstimate} onChange={e => setWaterEstimate(e.target.value)} placeholder="3000" />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">費用</p>
        <div className="grid grid-cols-2 gap-6">
          <KVSection label="月次固定費（円）" rows={monthlyCosts} setter={setMonthlyCosts} />
          <KVSection label="初期費用（円）" rows={initialCosts} setter={setInitialCosts} />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? '保存中...' : room ? '更新する' : '登録する'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">キャンセル</button>
      </div>
    </form>
  )
}
