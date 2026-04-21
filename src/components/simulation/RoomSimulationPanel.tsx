'use client'

import { useState } from 'react'
import type { Room } from '@/types'
import { formatCurrency, sumCosts } from '@/lib/utils'

interface Props {
  room: Room
  actualOccupancy: number // 0–1, 過去実績
}

const OCC_OPTIONS = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]

function nearestOpt(v: number) {
  return OCC_OPTIONS.reduce((prev, curr) =>
    Math.abs(curr - v) < Math.abs(prev - v) ? curr : prev
  )
}

export default function RoomSimulationPanel({ room, actualOccupancy }: Props) {
  const [occupancy, setOccupancy] = useState(actualOccupancy > 0 ? nearestOpt(actualOccupancy) : 0.7)
  const [customPrice, setCustomPrice] = useState(room.current_price)

  const initialCost = sumCosts(room.initial_costs)
  const monthlyFixed = sumCosts(room.monthly_costs)
  const monthlyUtility = (room.utility_electricity_estimate || 0) + (room.utility_water_estimate || 0)
  const monthlyCost = monthlyFixed + monthlyUtility

  const scenarios: { label: string; price: number; highlight?: boolean; custom?: boolean }[] = [
    { label: 'キャンペーン価格', price: room.price_campaign },
    { label: '通常価格', price: room.current_price, highlight: true },
    { label: '長期割引価格', price: room.price_long },
    { label: 'カスタム', price: customPrice, custom: true },
  ]

  function calc(price: number) {
    const revenue = Math.round(price * occupancy)
    const profit = revenue - monthlyCost
    const breakeven = initialCost === 0 ? null : profit > 0 ? Math.ceil(initialCost / profit) : -1
    return { revenue, profit, breakeven }
  }

  function breakevenLabel(b: number | null) {
    if (b === null) return <span className="text-gray-400">—</span>
    if (b === -1) return <span className="text-red-500 text-xs font-medium">回収不可</span>
    return (
      <span className={`font-semibold ${
        b <= 12 ? 'text-emerald-600' : b <= 24 ? 'text-blue-600' : b <= 36 ? 'text-amber-600' : 'text-red-500'
      }`}>
        {b}ヶ月
      </span>
    )
  }

  return (
    <div className="space-y-4">
      {/* コスト内訳 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">初期投資</h4>
          {Object.keys(room.initial_costs).length === 0 ? (
            <p className="text-sm text-gray-400">登録なし</p>
          ) : (
            <>
              {Object.entries(room.initial_costs).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm py-0.5 text-gray-600">
                  <span>{k}</span><span>{formatCurrency(v as number)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t border-gray-100 mt-2 pt-2">
                <span>合計</span>
                <span className="text-red-600">{formatCurrency(initialCost)}</span>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">月次ランニングコスト</h4>
          {Object.entries(room.monthly_costs).map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm py-0.5 text-gray-600">
              <span>{k}</span><span>{formatCurrency(v as number)}</span>
            </div>
          ))}
          {monthlyUtility > 0 && (
            <div className="flex justify-between text-sm py-0.5 text-gray-500">
              <span>光熱費（目安）</span><span>{formatCurrency(monthlyUtility)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold border-t border-gray-100 mt-2 pt-2">
            <span>合計 / 月</span>
            <span className="text-red-600">{formatCurrency(monthlyCost)}</span>
          </div>
        </div>
      </div>

      {/* 価格×稼働率シミュレーション */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h4 className="text-sm font-semibold text-gray-700 whitespace-nowrap">想定稼働率</h4>
          <div className="flex gap-1.5 flex-wrap">
            {OCC_OPTIONS.map(o => (
              <button
                key={o}
                onClick={() => setOccupancy(o)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  occupancy === o
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {Math.round(o * 100)}%
              </button>
            ))}
          </div>
          {actualOccupancy > 0 && (
            <span className="text-xs text-gray-400">
              実績平均: {Math.round(actualOccupancy * 100)}%
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 pr-3">価格設定</th>
                <th className="text-right pb-2 px-2">月額</th>
                <th className="text-right pb-2 px-2">月次収入</th>
                <th className="text-right pb-2 px-2">月次コスト</th>
                <th className="text-right pb-2 px-2">月次利益</th>
                <th className="text-right pb-2 pl-2">初期回収</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map(({ label, price, highlight, custom }) => {
                const { revenue, profit, breakeven } = calc(price)
                return (
                  <tr key={label} className={`border-b border-gray-50 ${highlight ? 'bg-blue-50/50' : ''}`}>
                    <td className="py-2.5 pr-3">
                      {custom ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-500 whitespace-nowrap">{label}</span>
                          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                            <span className="pl-2 text-gray-400 text-xs">¥</span>
                            <input
                              type="number"
                              value={customPrice}
                              onChange={e => setCustomPrice(Number(e.target.value))}
                              className="w-24 px-1.5 py-1 text-sm outline-none"
                              min="0"
                              step="1000"
                            />
                          </div>
                        </div>
                      ) : (
                        <span className={`font-medium ${highlight ? 'text-blue-700' : 'text-gray-700'}`}>
                          {label}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right font-semibold text-blue-600">
                      {formatCurrency(price)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-gray-600">
                      {formatCurrency(revenue)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-red-400">
                      {formatCurrency(monthlyCost)}
                    </td>
                    <td className={`py-2.5 px-2 text-right font-semibold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(profit)}
                    </td>
                    <td className="py-2.5 pl-2 text-right">
                      {breakevenLabel(breakeven)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-400 mt-3 leading-relaxed">
          月次収入 = 月額 × 稼働率　／　月次利益 = 月次収入 − ランニングコスト　／　初期回収 = 初期投資 ÷ 月次利益
        </p>
      </div>
    </div>
  )
}
