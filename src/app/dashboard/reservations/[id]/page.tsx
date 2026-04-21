import { supabase } from '@/lib/supabase'
import type { Room, Reservation } from '@/types'
import { formatCurrency, formatDate, roomDisplayName } from '@/lib/utils'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { differenceInDays, parseISO } from 'date-fns'
import DeleteReservationButton from './DeleteReservationButton'
import ExtendReservationButton from './ExtendReservationButton'

export const dynamic = 'force-dynamic'

export default async function ReservationDetailPage({ params }: { params: { id: string } }) {
  const { data } = await supabase
    .from('reservations')
    .select('*, room:rooms(*)')
    .eq('id', params.id)
    .single()

  if (!data) notFound()

  const r = data as Reservation & { room: Room }
  const nights = differenceInDays(parseISO(r.check_out), parseISO(r.check_in))
  const today = new Date().toISOString().slice(0, 10)

  let statusLabel = '予約済'
  let statusClass = 'bg-blue-100 text-blue-700'
  if (r.check_out <= today) { statusLabel = '退去済'; statusClass = 'bg-gray-100 text-gray-500' }
  else if (r.check_in <= today) { statusLabel = '入居中'; statusClass = 'bg-emerald-100 text-emerald-700' }

  const totalIncome = r.room_fee + r.cleaning_fee
  const netIncome = totalIncome - r.cleaning_cost
  const checkedCount = r.checklist.filter(c => c.checked).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/reservations" className="text-gray-400 hover:text-gray-600 text-sm">← 戻る</Link>
          <h2 className="text-2xl font-bold text-gray-900">{r.guest_name} 様</h2>
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusClass}`}>{statusLabel}</span>
          {r.is_extension && (
            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">延長</span>
          )}
        </div>
        <div className="flex gap-2">
          <ExtendReservationButton id={r.id} currentCheckOut={r.check_out} currentRoomFee={r.room_fee} />
          <Link href={`/dashboard/reservations/${r.id}/edit`} className="btn-secondary">編集</Link>
          <DeleteReservationButton id={r.id} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">予約情報</h3>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {[
                ['部屋', r.room ? roomDisplayName(r.room) : null],
                ['ゲスト名', r.guest_name],
                ['チェックイン', `${formatDate(r.check_in)}　${r.check_in_time ?? ''}`.trim()],
                ['チェックアウト', `${formatDate(r.check_out)}　${r.check_out_time ?? ''}`.trim()],
                ['泊数', `${nights} 泊`],
                ['最寄駅', r.room?.nearest_station],
                ['鍵の場所', r.room?.key_location],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-gray-500 mb-0.5">{label}</dt>
                  <dd className="font-medium text-gray-900">{(value as string) || '—'}</dd>
                </div>
              ))}
              {r.memo && (
                <div className="col-span-2">
                  <dt className="text-gray-500 mb-0.5">メモ</dt>
                  <dd className="font-medium text-gray-900 whitespace-pre-wrap">{r.memo}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* チェックリスト */}
          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-900">退去チェックリスト</h3>
              <span className="text-sm text-gray-500">{checkedCount}/{r.checklist.length}</span>
            </div>
            {r.checklist.length === 0 ? (
              <p className="text-sm text-gray-400">チェック項目がありません</p>
            ) : (
              <div className="space-y-2">
                {r.checklist.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-xs
                      ${item.checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300'}`}>
                      {item.checked ? '✓' : ''}
                    </span>
                    <span className={`text-sm ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 料金サマリー */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">料金内訳</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">宿泊料</dt>
              <dd className="font-medium">{formatCurrency(r.room_fee)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">清掃料（ゲスト負担）</dt>
              <dd className="font-medium">{formatCurrency(r.cleaning_fee)}</dd>
            </div>
            <div className="flex justify-between font-semibold text-emerald-600 border-t border-gray-100 pt-3">
              <dt>収入合計</dt>
              <dd>{formatCurrency(totalIncome)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">清掃費用（実費）</dt>
              <dd className="font-medium text-red-500">-{formatCurrency(r.cleaning_cost)}</dd>
            </div>
            <div className="flex justify-between font-bold text-base border-t border-gray-100 pt-3">
              <dt>純利益</dt>
              <dd className={netIncome >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(netIncome)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
