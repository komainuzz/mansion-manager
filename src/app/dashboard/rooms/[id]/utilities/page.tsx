import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import type { Room, UtilityCost } from '@/types'
import { formatCurrency, roomDisplayName } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import UtilityEditor from './UtilityEditor'

export const dynamic = 'force-dynamic'

function getRecentMonths(n: number): string[] {
  const now = new Date()
  const months: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

function formatYM(ym: string) {
  const [y, m] = ym.split('-')
  return `${y}年${parseInt(m)}月`
}

export default async function UtilitiesPage({ params }: { params: { id: string } }) {
  const [{ data: roomData }, { data: utilitiesData }] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', params.id).single(),
    supabase.from('utility_costs').select('*').eq('room_id', params.id).order('year_month', { ascending: false }),
  ])

  if (!roomData) notFound()
  const room = roomData as Room
  const utilities = (utilitiesData ?? []) as UtilityCost[]
  const utilityMap = Object.fromEntries(utilities.map(u => [u.year_month, u]))

  const months = getRecentMonths(12)

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/rooms/${room.id}`} className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">水道光熱費管理</h2>
          <p className="text-sm text-gray-500 mt-0.5">{roomDisplayName(room)}</p>
        </div>
      </div>

      {/* 概算ベース */}
      <div className="card bg-slate-50">
        <p className="text-sm font-semibold text-gray-700 mb-3">概算ベース（実績未入力の月に自動適用）</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex justify-between items-center bg-white rounded-lg px-4 py-3">
            <span className="text-sm text-gray-600">電気代</span>
            <span className="font-bold text-amber-700">
              {room.utility_electricity_estimate > 0 ? formatCurrency(room.utility_electricity_estimate) : '未設定'}
            </span>
          </div>
          <div className="flex justify-between items-center bg-white rounded-lg px-4 py-3">
            <span className="text-sm text-gray-600">水道代</span>
            <span className="font-bold text-cyan-700">
              {room.utility_water_estimate > 0 ? formatCurrency(room.utility_water_estimate) : '未設定'}
            </span>
          </div>
        </div>
        {(room.utility_electricity_estimate === 0 && room.utility_water_estimate === 0) && (
          <p className="text-xs text-gray-400 mt-2">
            概算ベースは
            <Link href={`/dashboard/rooms/${room.id}/edit`} className="text-blue-600 hover:underline mx-1">部屋の編集画面</Link>
            から設定できます
          </p>
        )}
      </div>

      {/* 月別テーブル */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">月別 水道光熱費（直近12ヶ月）</h3>
          <p className="text-xs text-gray-400">実績がない月は概算を表示</p>
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">月</th>
              <th className="table-th text-right">電気代</th>
              <th className="table-th text-right">水道代</th>
              <th className="table-th text-right">合計</th>
              <th className="table-th text-center">状態</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {months.map(ym => {
              const actual = utilityMap[ym]
              const elec = actual?.electricity ?? room.utility_electricity_estimate
              const water = actual?.water ?? room.utility_water_estimate
              const isActual = !!actual
              const total = (elec ?? 0) + (water ?? 0)

              return (
                <tr key={ym} className="hover:bg-gray-50 transition-colors">
                  <td className="table-td font-medium">{formatYM(ym)}</td>
                  <td className="table-td text-right">
                    <span className={isActual ? 'text-gray-900' : 'text-gray-400'}>
                      {elec != null && elec > 0 ? formatCurrency(elec) : '—'}
                    </span>
                  </td>
                  <td className="table-td text-right">
                    <span className={isActual ? 'text-gray-900' : 'text-gray-400'}>
                      {water != null && water > 0 ? formatCurrency(water) : '—'}
                    </span>
                  </td>
                  <td className="table-td text-right font-semibold">
                    {total > 0 ? formatCurrency(total) : '—'}
                  </td>
                  <td className="table-td text-center">
                    {isActual ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">実績</span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">概算</span>
                    )}
                  </td>
                  <td className="table-td">
                    <UtilityEditor
                      roomId={room.id}
                      yearMonth={ym}
                      existing={actual ?? null}
                      elecEstimate={room.utility_electricity_estimate}
                      waterEstimate={room.utility_water_estimate}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
