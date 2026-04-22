'use client'

import { useState } from 'react'
import type { Room } from '@/types'
import { formatCurrency, sumCosts } from '@/lib/utils'

export interface RecoveryStats {
  initialCost: number
  // 収入内訳
  roomFeeRevenue: number       // 宿泊料収入合計
  cleaningFeeIncome: number    // 清掃料（ゲスト負担）収入合計
  reservationCount: number     // 予約件数
  // 支出内訳
  accumulatedFixedCost: number    // 固定費累計（月次コスト×運用月数）
  accumulatedUtilityCost: number  // 光熱費実績累計
  accumulatedCleaningCost: number // 清掃費累計
  // 計算値
  accumulatedProfit: number
  remainingRecovery: number
  operationMonths: number
  hasOperationData: boolean
}

interface Props {
  room: Room
  actualOccupancy: number   // 0–1 過去実績
  recovery: RecoveryStats
}

const OCC_OPTIONS = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]

function nearestOpt(v: number) {
  return OCC_OPTIONS.reduce((prev, curr) =>
    Math.abs(curr - v) < Math.abs(prev - v) ? curr : prev
  )
}

function monthsLabel(m: number | null) {
  if (m === null) return <span className="text-gray-300">—</span>
  if (m === -1) return <span className="text-red-500 text-xs font-medium">回収不可</span>
  if (m === 0) return <span className="text-emerald-500 text-xs font-medium">回収済み</span>
  return (
    <span className={`font-semibold ${
      m <= 12 ? 'text-emerald-600' : m <= 24 ? 'text-blue-600' : m <= 36 ? 'text-amber-600' : 'text-red-500'
    }`}>
      あと{m}ヶ月
    </span>
  )
}

export default function RoomSimulationPanel({ room, actualOccupancy, recovery }: Props) {
  const [occupancy, setOccupancy] = useState(actualOccupancy > 0 ? nearestOpt(actualOccupancy) : 0.7)
  const [customPrice, setCustomPrice] = useState(room.current_price)

  const monthlyFixed = sumCosts(room.monthly_costs)
  const monthlyUtility = (room.utility_electricity_estimate || 0) + (room.utility_water_estimate || 0)
  const monthlyCost = monthlyFixed + monthlyUtility

  const isRecovered = recovery.remainingRecovery <= 0 && recovery.initialCost > 0
  const recoveryPct = recovery.initialCost > 0
    ? Math.min(100, Math.round((recovery.accumulatedProfit / recovery.initialCost) * 100))
    : 0

  function calc(price: number) {
    const revenue = Math.round(price * occupancy)
    const profit = revenue - monthlyCost
    if (recovery.initialCost === 0) return { revenue, profit, months: null }
    if (isRecovered) return { revenue, profit, months: 0 }
    if (profit <= 0) return { revenue, profit, months: -1 }
    return { revenue, profit, months: Math.ceil(recovery.remainingRecovery / profit) }
  }

  // 目標月数から逆算した必要月額
  function requiredPrice(targetMonths: number): number {
    if (recovery.remainingRecovery <= 0) return 0
    const neededProfit = recovery.remainingRecovery / targetMonths
    return Math.ceil((monthlyCost + neededProfit) / occupancy / 1000) * 1000
  }

  const scenarios: { label: string; price: number; highlight?: boolean; custom?: boolean }[] = [
    { label: 'キャンペーン価格', price: room.price_campaign },
    { label: '通常価格',         price: room.current_price, highlight: true },
    { label: '長期割引価格',     price: room.price_long },
    { label: 'カスタム',         price: customPrice, custom: true },
  ]

  const targets = [
    { label: '6ヶ月', months: 6 },
    { label: '1年',   months: 12 },
    { label: '2年',   months: 24 },
    { label: '3年',   months: 36 },
  ]

  return (
    <div className="space-y-4">
      {/* コスト概要 */}
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
                <span>合計</span><span className="text-red-600">{formatCurrency(recovery.initialCost)}</span>
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
            <span>合計 / 月</span><span className="text-red-600">{formatCurrency(monthlyCost)}</span>
          </div>
        </div>
      </div>

      {/* 投資回収状況（初期投資がある場合のみ） */}
      {recovery.initialCost > 0 && (
        <div className={`card ${isRecovered ? 'bg-emerald-50 border-emerald-200' : ''}`}>
          <div className="flex items-start justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">投資回収状況</h4>
            {recovery.operationMonths > 0 && (
              <span className="text-xs text-gray-400">運用開始から{recovery.operationMonths}ヶ月</span>
            )}
          </div>

          {/* サマリー3列 */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">初期投資</p>
              <p className="text-sm font-semibold text-red-600">{formatCurrency(recovery.initialCost)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">累積利益</p>
              <p className={`text-sm font-semibold ${recovery.accumulatedProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {formatCurrency(recovery.accumulatedProfit)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">残回収額</p>
              <p className={`text-sm font-semibold ${isRecovered ? 'text-emerald-600' : 'text-amber-600'}`}>
                {isRecovered ? '回収済み ✓' : formatCurrency(recovery.remainingRecovery)}
              </p>
            </div>
          </div>

          {/* 進捗バー */}
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-1">
            <div
              className={`h-full rounded-full transition-all ${isRecovered ? 'bg-emerald-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.max(1, recoveryPct)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 text-right mb-4">{recoveryPct}% 回収済み</p>

          {/* 累積利益の計算内訳 */}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">累積利益の内訳</p>
            <div className="space-y-0.5 text-sm">
              {/* 収入 */}
              <div className="flex justify-between text-gray-500 text-xs font-medium pt-1">
                <span>【収入】</span>
              </div>
              <div className="flex justify-between pl-3">
                <span className="text-gray-600">
                  宿泊料収入
                  {recovery.reservationCount > 0 && (
                    <span className="text-xs text-gray-400 ml-1">（{recovery.reservationCount}件）</span>
                  )}
                </span>
                <span className="font-medium text-blue-700">＋{formatCurrency(recovery.roomFeeRevenue)}</span>
              </div>
              <div className="flex justify-between pl-3">
                <span className="text-gray-600">清掃料収入</span>
                <span className="font-medium text-blue-700">＋{formatCurrency(recovery.cleaningFeeIncome)}</span>
              </div>
              <div className="flex justify-between pl-3 text-xs text-gray-400 border-b border-gray-100 pb-2">
                <span>収入合計</span>
                <span className="font-semibold text-gray-700">{formatCurrency(recovery.roomFeeRevenue + recovery.cleaningFeeIncome)}</span>
              </div>

              {/* 支出 */}
              <div className="flex justify-between text-gray-500 text-xs font-medium pt-1">
                <span>【支出】</span>
              </div>
              <div className="flex justify-between pl-3">
                <span className="text-gray-600">
                  固定費
                  {recovery.operationMonths > 0 && (
                    <span className="text-xs text-gray-400 ml-1">
                      （{formatCurrency(sumCosts(room.monthly_costs))}/月 × {recovery.operationMonths}ヶ月）
                    </span>
                  )}
                </span>
                <span className="font-medium text-red-500">－{formatCurrency(recovery.accumulatedFixedCost)}</span>
              </div>
              <div className="flex justify-between pl-3">
                <span className="text-gray-600">
                  光熱費
                  <span className="text-xs text-gray-400 ml-1">（実績）</span>
                </span>
                <span className={`font-medium ${recovery.accumulatedUtilityCost > 0 ? 'text-red-500' : 'text-gray-300'}`}>
                  {recovery.accumulatedUtilityCost > 0 ? `－${formatCurrency(recovery.accumulatedUtilityCost)}` : '未入力'}
                </span>
              </div>
              <div className="flex justify-between pl-3">
                <span className="text-gray-600">清掃費</span>
                <span className="font-medium text-red-500">－{formatCurrency(recovery.accumulatedCleaningCost)}</span>
              </div>
              <div className="flex justify-between pl-3 text-xs text-gray-400 border-b border-gray-100 pb-2">
                <span>支出合計</span>
                <span className="font-semibold text-gray-700">
                  {formatCurrency(recovery.accumulatedFixedCost + recovery.accumulatedUtilityCost + recovery.accumulatedCleaningCost)}
                </span>
              </div>

              {/* 累積利益 */}
              <div className={`flex justify-between font-bold pt-1 ${recovery.accumulatedProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                <span>累積利益</span>
                <span>{formatCurrency(recovery.accumulatedProfit)}</span>
              </div>
            </div>
          </div>

          {!recovery.hasOperationData && (
            <p className="text-xs text-amber-600 mt-3 bg-amber-50 rounded-lg px-3 py-1.5">
              予約データがまだありません。運用開始後に累積利益が反映されます。
            </p>
          )}
        </div>
      )}

      {/* 稼働率 × 価格シミュレーション */}
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
            <span className="text-xs text-gray-400">実績平均: {Math.round(actualOccupancy * 100)}%</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 pr-3">価格設定</th>
                <th className="text-right pb-2 px-2">月額</th>
                <th className="text-right pb-2 px-2">月次収入</th>
                <th className="text-right pb-2 px-2">月次利益</th>
                <th className="text-right pb-2 pl-2">
                  {recovery.initialCost > 0 ? '残回収期間' : '損益'}
                </th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map(({ label, price, highlight, custom }) => {
                const { revenue, profit, months } = calc(price)
                return (
                  <tr key={label} className={`border-b border-gray-50 ${highlight ? 'bg-blue-50/50' : ''}`}>
                    <td className="py-2.5 pr-3">
                      {custom ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-500 text-xs whitespace-nowrap">{label}</span>
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
                    <td className="py-2.5 px-2 text-right font-semibold text-blue-600">{formatCurrency(price)}</td>
                    <td className="py-2.5 px-2 text-right text-gray-600">{formatCurrency(revenue)}</td>
                    <td className={`py-2.5 px-2 text-right font-semibold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(profit)}
                    </td>
                    <td className="py-2.5 pl-2 text-right">{monthsLabel(months)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          月次収入 = 月額 × 稼働率　残回収期間 = 残回収額 ÷ 月次利益
        </p>
      </div>

      {/* レコメンド（初期投資があり未回収の場合） */}
      {recovery.initialCost > 0 && !isRecovered && (
        <div className="card border-amber-200 bg-amber-50/40">
          <h4 className="text-sm font-semibold text-gray-700 mb-1">目標回収期間から逆算するには</h4>
          <p className="text-xs text-gray-500 mb-3">
            残回収額 {formatCurrency(recovery.remainingRecovery)} を回収するために必要な最低月額（稼働率{Math.round(occupancy * 100)}% 想定）
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {targets.map(({ label, months }) => {
              const price = requiredPrice(months)
              const isAchievable = room.current_price >= price
              return (
                <div
                  key={months}
                  className={`rounded-xl px-3 py-2.5 border ${
                    isAchievable
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <p className="text-xs text-gray-500 mb-1">{label}で回収</p>
                  <p className={`text-base font-bold ${isAchievable ? 'text-emerald-600' : 'text-gray-800'}`}>
                    {formatCurrency(price)}
                  </p>
                  <p className="text-xs mt-0.5">
                    {isAchievable
                      ? <span className="text-emerald-500">✓ 通常価格で達成可</span>
                      : <span className="text-gray-400">+{formatCurrency(price - room.current_price)}</span>
                    }
                  </p>
                </div>
              )
            })}
          </div>

          {/* キャンペーン時の注意 */}
          {(() => {
            const campCalc = calc(room.price_campaign)
            if (campCalc.months === null || campCalc.months <= 0) return null
            const normalCalc = calc(room.current_price)
            if (normalCalc.months === null || normalCalc.months <= 0) return null
            const diff = campCalc.months - normalCalc.months
            if (diff <= 0) return null
            return (
              <div className="mt-3 bg-white rounded-xl border border-amber-200 px-4 py-3 text-sm">
                <p className="font-medium text-amber-700">💡 キャンペーン価格（{formatCurrency(room.price_campaign)}）でのシミュレーション</p>
                <p className="text-gray-600 mt-1">
                  通常価格と比べて回収が <span className="font-semibold text-amber-600">{diff}ヶ月遅れます</span>（
                  通常: あと{normalCalc.months}ヶ月 → キャンペーン: あと{campCalc.months}ヶ月）。
                  稼働率が上がった場合のみキャンペーン適用を推奨します。
                </p>
              </div>
            )
          })()}
        </div>
      )}

      {/* 回収済みメッセージ */}
      {isRecovered && (
        <div className="card bg-emerald-50 border-emerald-200 text-center py-5">
          <p className="text-2xl mb-1">🎉</p>
          <p className="font-semibold text-emerald-700">初期投資を回収済みです</p>
          <p className="text-sm text-emerald-600 mt-0.5">
            累積利益 {formatCurrency(recovery.accumulatedProfit)} で
            初期投資 {formatCurrency(recovery.initialCost)} を超えました
          </p>
        </div>
      )}
    </div>
  )
}
