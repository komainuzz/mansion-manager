'use client'

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import type { MonthlySummary } from '@/types'
import { formatCurrency, formatYearMonth } from '@/lib/utils'

interface Props {
  summaries: MonthlySummary[]
}

function formatYM(ym: string) {
  const [y, m] = ym.split('-')
  return `${y.slice(2)}/${m}`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null
  const isForecast = payload[0]?.payload?.isForecast
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-sm min-w-[200px]">
      <p className="font-bold text-gray-900 mb-2">{label} {isForecast ? '(予測)' : '(実績)'}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium">{typeof p.value === 'number' ? formatCurrency(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function SimulationChart({ summaries }: Props) {
  const chartData = summaries.map(s => ({
    name: formatYM(s.yearMonth),
    収入: s.revenue,
    費用: s.costs,
    利益: s.profit,
    isForecast: s.isForecast,
  }))

  let cumulative = 0
  const cumulativeData = summaries.map(s => {
    cumulative += s.profit
    return { name: formatYM(s.yearMonth), 累計損益: cumulative, isForecast: s.isForecast }
  })

  return (
    <div className="space-y-6">
      {/* 月次損益グラフ */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-1">月次損益（実績 + 予測）</h3>
        <p className="text-xs text-gray-500 mb-4">薄い色 = 予測（既存予約ベース）</p>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}万`} tick={{ fontSize: 11 }} width={50} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#9ca3af" />
            <Bar dataKey="収入" name="収入" maxBarSize={28} radius={[3, 3, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.isForecast ? '#93c5fd' : '#3b82f6'} />
              ))}
            </Bar>
            <Bar dataKey="費用" name="費用" maxBarSize={28} radius={[3, 3, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.isForecast ? '#fca5a5' : '#ef4444'} />
              ))}
            </Bar>
            <Line dataKey="利益" name="利益" type="monotone" stroke="#10b981" strokeWidth={2}
              dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 累計損益グラフ */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-1">累計損益推移</h3>
        <p className="text-xs text-gray-500 mb-4">薄い色 = 予測</p>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={cumulativeData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}万`} tick={{ fontSize: 11 }} width={50} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#9ca3af" />
            <Line dataKey="累計損益" name="累計損益" type="monotone" strokeWidth={2.5}
              dot={(props: any) => {
                const { cx, cy, payload } = props
                return <circle key={cx} cx={cx} cy={cy} r={3}
                  fill={payload.isForecast ? '#a78bfa' : '#7c3aed'} stroke="white" strokeWidth={1} />
              }}
              stroke="#7c3aed"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 月次サマリーテーブル */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">月次サマリー一覧</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 font-semibold">
                <th className="px-4 py-3 text-left">月</th>
                <th className="px-4 py-3 text-right">収入</th>
                <th className="px-4 py-3 text-right">費用</th>
                <th className="px-4 py-3 text-right">利益</th>
                <th className="px-4 py-3 text-right">稼働率</th>
                <th className="px-4 py-3 text-left">種別</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map(s => (
                <tr key={s.yearMonth} className={`border-t border-gray-100 hover:bg-gray-50 ${s.isForecast ? 'opacity-70' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-700">{formatYearMonth(s.yearMonth)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-medium">{formatCurrency(s.revenue)}</td>
                  <td className="px-4 py-3 text-right text-red-500">{formatCurrency(s.costs)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${s.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(s.profit)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{Math.round(s.occupancyRate * 100)}%</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.isForecast ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {s.isForecast ? '予測' : '実績'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
