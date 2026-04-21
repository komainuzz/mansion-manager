import { supabase } from '@/lib/supabase'
import type { Room, Reservation } from '@/types'
import { formatCurrency, formatDate, sumCosts, roomDisplayName } from '@/lib/utils'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import DeleteRoomButton from './DeleteRoomButton'
import { Zap } from 'lucide-react'

export const dynamic = 'force-dynamic'

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 mb-0.5">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value || '—'}</dd>
    </div>
  )
}

export default async function RoomDetailPage({ params }: { params: { id: string } }) {
  const [{ data: room }, { data: reservations }] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', params.id).single(),
    supabase.from('reservations').select('*').eq('room_id', params.id).order('check_in', { ascending: false }),
  ])

  if (!room) notFound()

  const r = room as Room
  const res = (reservations ?? []) as Reservation[]

  const totalRevenue = res.reduce((s, rv) => s + rv.room_fee + rv.cleaning_fee, 0)
  const totalCleaningCost = res.reduce((s, rv) => s + rv.cleaning_cost, 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/rooms" className="text-gray-400 hover:text-gray-600 text-sm">← 戻る</Link>
          <div>
              <h2 className="text-2xl font-bold text-gray-900">{r.building_name}</h2>
              {r.room_number && <p className="text-sm text-gray-500">部屋番号 {r.room_number}</p>}
            </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/rooms/${r.id}/edit`} className="btn-secondary">編集</Link>
          <DeleteRoomButton id={r.id} roomName={roomDisplayName(r)} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">

          {/* 基本情報 */}
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-900">基本情報</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <InfoRow label="郵便番号" value={r.postal_code} />
              <InfoRow label="契約開始日" value={formatDate(r.contract_start)} />
              <InfoRow label="解約日" value={r.contract_end ? formatDate(r.contract_end) : null} />
              <InfoRow label="住所" value={r.address} />
              <InfoRow label="最寄駅" value={
                r.nearest_station
                  ? `${r.nearest_station}${r.nearest_station_minutes != null ? `（${r.nearest_station_transport}${r.nearest_station_minutes}分）` : ''}`
                  : null
              } />
            </dl>
          </div>

          {/* 管理情報 */}
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-900">管理情報</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <InfoRow label="管理会社" value={r.management_company} />
              <InfoRow label="管理会社の連絡先" value={r.management_company_contact} />
              <InfoRow label="鍵の場所" value={r.key_location} />
              <InfoRow label="ポスト番号" value={r.mailbox_code} />
            </dl>
          </div>

          {/* 設備 */}
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-900">設備・インフラ</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <InfoRow label="駐車場" value={
                r.has_parking
                  ? r.parking_fee > 0 ? `あり（${formatCurrency(r.parking_fee)}/月）` : 'あり'
                  : 'なし'
              } />
              <InfoRow label="WiFi" value={r.wifi_detail ?? 'なし'} />
              <InfoRow label="電気" value={r.electricity} />
              <InfoRow label="電気温水器" value={r.water_heater} />
              <InfoRow label="ガス契約会社" value={r.gas} />
              <InfoRow label="給湯器型番" value={r.water_heater_model} />
              <InfoRow label="設備・特徴" value={r.features} />
            </dl>
          </div>

          {/* 掲載価格 */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">掲載価格</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '基本プラン', value: r.current_price, color: 'text-blue-600' },
                { label: 'ロングプラン', value: r.price_long, color: 'text-violet-600' },
                { label: 'キャンペーン', value: r.price_campaign, color: 'text-emerald-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <p className={`font-bold text-lg ${color}`}>{value ? formatCurrency(value) : '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 水道光熱費概算 */}
          {(r.utility_electricity_estimate > 0 || r.utility_water_estimate > 0) && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3">水道光熱費 概算ベース</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">電気代</p>
                  <p className="font-bold text-amber-700">{formatCurrency(r.utility_electricity_estimate)}</p>
                </div>
                <div className="bg-cyan-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">水道代</p>
                  <p className="font-bold text-cyan-700">{formatCurrency(r.utility_water_estimate)}</p>
                </div>
              </div>
              <Link href={`/dashboard/rooms/${r.id}/utilities`} className="btn-secondary w-full justify-center text-xs py-2 mt-3 flex items-center gap-1.5">
                <Zap size={12} />
                実績を入力する
              </Link>
            </div>
          )}

          {/* 費用 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3">月次固定費</h3>
              {Object.keys(r.monthly_costs).length === 0 ? (
                <p className="text-sm text-gray-400">未設定</p>
              ) : (
                <dl className="space-y-1.5">
                  {Object.entries(r.monthly_costs).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <dt className="text-gray-500">{k}</dt>
                      <dd className="font-medium">{formatCurrency(v)}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold border-t border-gray-100 pt-2 mt-2">
                    <dt>合計</dt><dd className="text-red-500">{formatCurrency(sumCosts(r.monthly_costs))}</dd>
                  </div>
                </dl>
              )}
            </div>
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3">初期費用</h3>
              {Object.keys(r.initial_costs).length === 0 ? (
                <p className="text-sm text-gray-400">未設定</p>
              ) : (
                <dl className="space-y-1.5">
                  {Object.entries(r.initial_costs).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <dt className="text-gray-500">{k}</dt>
                      <dd className="font-medium">{formatCurrency(v)}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold border-t border-gray-100 pt-2 mt-2">
                    <dt>合計</dt><dd className="text-blue-600">{formatCurrency(sumCosts(r.initial_costs))}</dd>
                  </div>
                </dl>
              )}
            </div>
          </div>
        </div>

        {/* サイドバー：実績 */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">この部屋の実績</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">予約件数</dt>
                <dd className="font-medium">{res.length} 件</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">累計収入</dt>
                <dd className="font-semibold text-emerald-600">{formatCurrency(totalRevenue)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">累計清掃費</dt>
                <dd className="font-medium text-red-500">{formatCurrency(totalCleaningCost)}</dd>
              </div>
            </dl>
            <div className="mt-4 space-y-2">
              <Link href={`/dashboard/reservations/new?room_id=${r.id}`} className="btn-primary w-full justify-center text-xs py-2">
                + 予約を追加
              </Link>
              <Link href={`/dashboard/rooms/${r.id}/utilities`} className="btn-secondary w-full justify-center text-xs py-2 flex items-center gap-1.5">
                <Zap size={12} />
                水道光熱費を管理
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 予約履歴 */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">予約履歴</h3>
        </div>
        {res.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">予約がありません</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">ゲスト名</th>
                <th className="table-th">チェックイン</th>
                <th className="table-th">チェックアウト</th>
                <th className="table-th">宿泊料</th>
                <th className="table-th">清掃料</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {res.map(rv => (
                <tr key={rv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-td font-medium">{rv.guest_name}</td>
                  <td className="table-td text-gray-500">{formatDate(rv.check_in)}</td>
                  <td className="table-td text-gray-500">{formatDate(rv.check_out)}</td>
                  <td className="table-td font-semibold text-emerald-600">{formatCurrency(rv.room_fee)}</td>
                  <td className="table-td text-gray-500">{formatCurrency(rv.cleaning_fee)}</td>
                  <td className="table-td">
                    <Link href={`/dashboard/reservations/${rv.id}`} className="btn-secondary py-1 px-3 text-xs">詳細</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
