import { supabase } from '@/lib/supabase'
import type { Room } from '@/types'
import { formatCurrency, formatDate, sumCosts, roomDisplayName } from '@/lib/utils'
import Link from 'next/link'
import { Building2, Upload } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function RoomsPage() {
  const { data, error } = await supabase.from('rooms').select('*').order('created_at')
  const rooms = (data ?? []) as Room[]

  return (
    <div className="p-6 space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">部屋管理</h2>
          <p className="text-sm text-gray-500 mt-0.5">{rooms.length} 件登録</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/rooms/import" className="btn-secondary flex items-center gap-1.5">
            <Upload size={14} />
            CSV一括登録
          </Link>
          <Link href="/dashboard/rooms/new" className="btn-primary">+ 新規登録</Link>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          データの取得に失敗しました: {error.message}
        </div>
      )}

      {rooms.length === 0 ? (
        <div className="card text-center py-16">
          <div className="flex justify-center mb-3">
            <Building2 size={40} className="text-gray-300" />
          </div>
          <p className="text-gray-500 mb-4">部屋が登録されていません</p>
          <Link href="/dashboard/rooms/new" className="btn-primary">最初の部屋を登録する</Link>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">部屋名</th>
                <th className="table-th">最寄駅</th>
                <th className="table-th">契約開始</th>
                <th className="table-th">掲載価格</th>
                <th className="table-th">月次固定費</th>
                <th className="table-th">初期費用</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {rooms.map(room => {
                const today = new Date().toISOString().slice(0, 10)
                const isEnded = !!room.contract_end && room.contract_end < today
                return (
                <tr key={room.id} className={`hover:bg-gray-50 transition-colors ${isEnded ? 'opacity-60' : ''}`}>
                  <td className="table-td font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {roomDisplayName(room)}
                      {isEnded && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-normal">運営終了</span>}
                    </div>
                  </td>
                  <td className="table-td text-gray-500">{room.nearest_station ?? '—'}</td>
                  <td className="table-td text-gray-500">{formatDate(room.contract_start)}</td>
                  <td className="table-td font-semibold text-blue-600">{formatCurrency(room.current_price)}</td>
                  <td className="table-td text-gray-500">{formatCurrency(sumCosts(room.monthly_costs))}</td>
                  <td className="table-td text-gray-500">{formatCurrency(sumCosts(room.initial_costs))}</td>
                  <td className="table-td">
                    <div className="flex gap-2 justify-end">
                      <Link href={`/dashboard/rooms/${room.id}`} className="btn-secondary py-1 px-3 text-xs">詳細</Link>
                      <Link href={`/dashboard/rooms/${room.id}/edit`} className="btn-primary py-1 px-3 text-xs">編集</Link>
                    </div>
                  </td>
                </tr>
                )})}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
