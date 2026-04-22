'use client'

import { useState } from 'react'
import type { Room } from '@/types'
import { formatCurrency, sumCosts } from '@/lib/utils'

export interface RecoveryReservation {
  id: string
  guestName: string
  checkIn: string
  checkOut: string
  roomFee: number        // 確定総額
  cleaningFee: number
  cleaningCost: number
  status: 'past' | 'active' | 'future'
  earnedRoomFee: number  // 今月末までの日割り分
}

export interface RecoveryScenario {
  label: string
  cutoffDisplay: string
  accumulatedRevenue: number
  accumulatedProfit: number
  remainingRecovery: number
  recoveryPct: number    // 0〜100+ (initialCost=0なら0)
}

export interface RecoveryStats {
  initialCost: number
  // 今月末日割りベースの内訳（詳細カード用）
  roomFeeRevenue: number
  cleaningFeeIncome: number
  reservationCount: number
  pastReservations: RecoveryReservation[]  // 全予約（past/active/future）
  accumulatedFixedCost: number
  accumulatedUtilityCost: number
  accumulatedCleaningCost: number
  accumulatedProfit: number
  remainingRecovery: number
  operationMonths: number
  hasOperationData: boolean
  // 4シナリオ比較
  scenarios: RecoveryScenario[]
}

interface Props {
  room: Room
  actualOccupancy: number
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

const STATUS_BADGE: Record<RecoveryReservation['status'], { label: string; cls: string }> = {
  past:   { label: '完了', cls: 'bg-gray-100 text-gray-500' },
  active: { label: '入居中', cls: 'bg-emerald-100 text-emerald-700' },
  future: { label: '予定', cls: 'bg-blue-100 text-blue-700' },
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

          {/* ── 4シナリオ比較テーブル ── */}
          {recovery.scenarios.length > 0 && (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="text-left pb-2 pr-4">シナリオ</th>
                    <th className="text-right pb-2 px-2">累積利益</th>
                    <th className="pb-2 px-2 min-w-[140px]">回収率</th>
                    <th className="text-right pb-2 pl-2">残回収額</th>
                  </tr>
                </thead>
                <tbody>
                  {recovery.scenarios.map((s, i) => {
                    const recovered = s.remainingRecovery <= 0
                    const pct = Math.min(100, Math.max(0, s.recoveryPct))
                    const isBase = i === 0
                    return (
                      <tr key={s.label} className={`border-b border-gray-50 ${isBase ? 'bg-slate-50' : ''}`}>
                        <td className="py-2 pr-4">
                          <div className={`font-medium text-xs ${isBase ? 'text-slate-700' : 'text-gray-600'}`}>
                            {s.label}
                          </div>
                          <div className="text-[11px] text-gray-400">〜{s.cutoffDisplay}</div>
                        </td>
                        <td className={`py-2 px-2 text-right text-xs font-medium ${s.accumulatedProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {formatCurrency(s.accumulatedProfit)}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden min-w-[60px]">
                              <div
                                className={`h-full rounded-full ${recovered ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-xs font-semibold w-9 text-right shrink-0 ${
                              recovered ? 'text-emerald-600'
                              : s.recoveryPct >= 80 ? 'text-blue-600'
                              : s.recoveryPct >= 50 ? 'text-amber-600'
                              : 'text-red-500'
                            }`}>
                              {s.recoveryPct}%
                            </span>
                          </div>
                        </td>
                        <td className={`py-2 pl-2 text-right text-xs font-semibold ${recovered ? 'text-emerald-600' : 'text-amber-700'}`}>
                          {recovered ? '回収済み ✓' : formatCurrency(s.remainingRecovery)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="text-[11px] text-gray-400 mt-1.5">
                ※今月末まで = 現在進行中の予約を日割り按分した確定収益ベース
              </p>
            </div>
          )}

          {/* 今月末ベースの進捗バー */}
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-1">
            <div
              className={`h-full rounded-full transition-all ${isRecovered ? 'bg-emerald-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.max(1, recoveryPct)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 text-right mb-4">{recoveryPct}% 回収済み（今月末時点）</p>

          {/* 累積利益の計算内訳（今月末日割りベース） */}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">累積利益の内訳（今月末まで日割りベース）</p>
            <div className="space-y-0.5 text-sm">
              {/* 収入 */}
              <div className="flex justify-between text-gray-500 text-xs font-medium pt-1">
                <span>【収入】</span>
              </div>

              {/* 予約明細 */}
              {recovery.pastReservations.length > 0 ? (
                <div className="pl-3 mt-1 mb-2 overflow-x-auto">
                  <table className="w-full text-xs min-w-[500px]">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-100">
                        <th className="text-left pb-1 font-medium pr-2">日程</th>
                        <th className="text-left pb-1 font-medium pr-2">氏名</th>
                        <th className="text-center pb-1 font-medium pr-2">状態</th>
                        <th className="text-right pb-1 font-medium pr-2">宿泊料（今月末分）</th>
                        <th className="text-right pb-1 font-medium pr-2">清掃料</th>
                        <th className="text-right pb-1 font-medium">清掃費</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recovery.pastReservations.map(r => {
                        const badge = STATUS_BADGE[r.status]
                        const isNotEarned = r.status === 'future'
                        return (
                          <tr key={r.id} className={`border-b border-gray-50 ${isNotEarned ? 'opacity-50' : ''}`}>
                            <td className="py-1 text-gray-500 whitespace-nowrap pr-2">
                              {r.checkIn} 〜 {r.checkOut}
                            </td>
                            <td className="py-1 text-gray-700 pr-2">{r.guestName}</td>
                            <td className="py-1 pr-2 text-center">
                              <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="py-1 text-right pr-2">
                              {isNotEarned ? (
                                <span className="text-gray-300">—</span>
                              ) : r.status === 'active' ? (
                                <span className="text-blue-700">
                                  ＋{formatCurrency(r.earnedRoomFee)}
                                  <span className="text-gray-400 ml-1">/ {formatCurrency(r.roomFee)}</span>
                                </span>
                              ) : (
                                <span className="text-blue-700">＋{formatCurrency(r.roomFee)}</span>
                              )}
                            </td>
                            <td className="py-1 text-right text-blue-700 pr-2">
                              {r.status === 'future' ? <span className="text-gray-300">—</span> : `＋${formatCurrency(r.cleaningFee)}`}
                            </td>
                            <td className="py-1 text-right text-red-400">
                              {r.status === 'future' ? <span className="text-gray-300">—</span> : `－${formatCurrency(r.cleaningCost)}`}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="pl-3 text-xs text-gray-400 mb-2">予約なし</div>
              )}
              <div className="flex justify-between pl-3 text-xs text-gray-400 border-b border-gray-100 pb-2">
                <span>収入合計（宿泊料＋清掃料）</span>
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
                  光熱費<span className="text-xs text-gray-400 ml-1">（実績）</span>
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

              <div className={`flex justify-between font-bold pt-1 ${recovery.accumulatedProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                <span>累積利益（今月末時点）</span>
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
                type="button"
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
          月次収入 = 月額 × 稼働率　残回収期間 = 残回収額（今月末時点）÷ 月次利益
        </p>
      </div>

      {/* レコメンド */}
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
                    isAchievable ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'
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
                </p>
              </div>
            )
          })()}
        </div>
      )}

      {isRecovered && (
        <div className="card bg-emerald-50 border-emerald-200 text-center py-5">
          <p className="text-2xl mb-1">🎉</p>
          <p className="font-semibold text-emerald-700">初期投資を回収済みです（今月末時点）</p>
          <p className="text-sm text-emerald-600 mt-0.5">
            累積利益 {formatCurrency(recovery.accumulatedProfit)} で
            初期投資 {formatCurrency(recovery.initialCost)} を超えました
          </p>
        </div>
      )}
    </div>
  )
}
