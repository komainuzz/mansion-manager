import { supabase } from '@/lib/supabase'
import type { Room, Reservation } from '@/types'
import { formatCurrency, formatDate, roomDisplayName } from '@/lib/utils'
import Link from 'next/link'
import { differenceInDays, parseISO } from 'date-fns'
import { CalendarDays, Upload } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ReservationsPage() {
  const [{ data: rooms }, { data: reservations }] = await Promise.all([
    supabase.from('rooms').select('id, building_name, room_number').order('building_name'),
    supabase.from('reservations').select('*').order('check_in', { ascending: false }),
  ])

  const roomMap = Object.fromEntries(
    (rooms ?? []).map((r: { id: string; building_name: string; room_number: string | null }) => [r.id, roomDisplayName(r)])
  )
  const res = (reservations ?? []) as Reservation[]
  const today = new Date().toISOString().slice(0, 10)

  function status(r: Reservation) {
    if (r.check_out <= today) return { label: '退去済', className: 'bg-gray-100 text-gray-500' }
    if (r.check_in <= today) return { label: '入居中', className: 'bg-emerald-100 text-emerald-700' }
    return { label: '予約済', className: 'bg-blue-100 text-blue-700' }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">予約管理</h2>
          <p className="text-sm text-gray-500 mt-0.5">{res.length} 件</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/reservations/import" className="btn-secondary flex items-center gap-1.5">
            <Upload size={14} />
            CSV一括登録
          </Link>
          <Link href="/dashboard/reservations/new" className="btn-primary">+ 新規登録</Link>
        </div>
      </div>

      {res.length === 0 ? (
        <div className="card text-center py-16">
          <div className="flex justify-center mb-3">
            <CalendarDays size={40} className="text-gray-300" />
          </div>
          <p className="text-gray-500 mb-4">予約が登録されていません</p>
          <Link href="/dashboard/reservations/new" className="btn-primary">最初の予約を登録する</Link>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">ステータス</th>
                <th className="table-th">部屋</th>
                <th className="table-th">ゲスト名</th>
                <th className="table-th">チェックイン</th>
                <th className="table-th">チェックアウト</th>
                <th className="table-th">泊数</th>
                <th className="table-th">宿泊料</th>
                <th className="table-th">清掃料</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {res.map(r => {
                const st = status(r)
                const nights = differenceInDays(parseISO(r.check_out), parseISO(r.check_in))
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-td">
                      <div className="flex gap-1 flex-wrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.className}`}>
                          {st.label}
                        </span>
                        {r.is_extension && (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">延長</span>
                        )}
                      </div>
                    </td>
                    <td className="table-td font-medium">{roomMap[r.room_id] ?? '—'}</td>
                    <td className="table-td">{r.guest_name}</td>
                    <td className="table-td text-gray-500">{formatDate(r.check_in)}</td>
                    <td className="table-td text-gray-500">{formatDate(r.check_out)}</td>
                    <td className="table-td text-gray-500">{nights}泊</td>
                    <td className="table-td font-semibold text-emerald-600">{formatCurrency(r.room_fee)}</td>
                    <td className="table-td text-gray-500">{formatCurrency(r.cleaning_fee)}</td>
                    <td className="table-td">
                      <div className="flex gap-2 justify-end">
                        <Link href={`/dashboard/reservations/${r.id}`} className="btn-secondary py-1 px-3 text-xs">詳細</Link>
                        <Link href={`/dashboard/reservations/${r.id}/edit`} className="btn-primary py-1 px-3 text-xs">編集</Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
