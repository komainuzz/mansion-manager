'use client'

import { useState, useEffect } from 'react'
import type { Room } from '@/types'
import { formatCurrency, sumCosts } from '@/lib/utils'

export interface RecoveryReservation {
  id: string
  guestName: string
  checkIn: string
  checkOut: string
  roomFee: number
  cleaningFee: number
  cleaningCost: number
  status: 'past' | 'active' | 'future'
  earnedRoomFee: number
}

export interface RecoveryScenario {
  label: string
  cutoffDisplay: string
  cutoffYM: string
  accumulatedRevenue: number
  accumulatedProfit: number
  remainingRecovery: number
  recoveryPct: number
}

export interface RecoveryStats {
  initialCost: number
  roomFeeRevenue: number
  cleaningFeeIncome: number
  reservationCount: number
  pastReservations: RecoveryReservation[]
  accumulatedFixedCost: number
  accumulatedUtilityCost: number
  accumulatedCleaningCost: number
  accumulatedProfit: number
  remainingRecovery: number
  operationMonths: number
  hasOperationData: boolean
  scenarios: RecoveryScenario[]
  finalCheckoutYM: string | null
  confirmedRecoveryYM: string | null
  actualPaceMonthlyProfit: number | null
  actualPaceRecoveryYM: string | null
}

interface Props {
  room: Room
  actualOccupancy: number
  recovery: RecoveryStats
}

// ── ユーティリティ ──────────────────────────────
function ymDisplay(ym: string): string {
  const [y, m] = ym.split('-')
  return `${y}年${parseInt(m)}月`
}

function fromNowMonths(ym: string): number {
  const [y, m] = ym.split('-').map(Number)
  const now = new Date()
  return (y - now.getFullYear()) * 12 + (m - (now.getMonth() + 1))
}

function fromNowLabel(ym: string): string {
  const diff = fromNowMonths(ym)
  if (diff < 0) return `${-diff}ヶ月前に回収済み`
  if (diff === 0) return '今月 回収'
  return `あと ${diff} ヶ月`
}

function toMonthsFromStart(startYM: string, targetYM: string): number {
  const [sy, sm] = startYM.split('-').map(Number)
  const [ty, tm] = targetYM.split('-').map(Number)
  return (ty - sy) * 12 + (tm - sm)
}

// ── タイムライン ────────────────────────────────
interface TLItem {
  ym: string
  label: string
  sub?: string
  dot: string  // tailwind bg class
  isNow?: boolean
}

function RecoveryTimeline({ items }: { items: TLItem[] }) {
  if (items.length < 2) return null

  const sorted = [...items].sort((a, b) => a.ym.localeCompare(b.ym))
  const minYM = sorted[0].ym
  const maxYM = sorted[sorted.length - 1].ym

  const [minY, minM] = minYM.split('-').map(Number)
  const [maxY, maxM] = maxYM.split('-').map(Number)
  const totalMonths = Math.max(1, (maxY - minY) * 12 + (maxM - minM)) * 1.08

  function pos(ym: string): number {
    const [y, m] = ym.split('-').map(Number)
    const months = (y - minY) * 12 + (m - minM)
    return Math.min(96, Math.max(2, (months / totalMonths) * 100))
  }

  // 現在地までの進捗バー幅
  const nowItem = items.find(i => i.isNow)
  const progressWidth = nowItem ? pos(nowItem.ym) : 0

  return (
    <div className="mt-5 mb-10 mx-1 relative select-none">
      {/* ベースライン */}
      <div className="relative h-1.5 bg-gray-200 rounded-full">
        <div
          className="absolute left-0 top-0 h-full bg-blue-300 rounded-full"
          style={{ width: `${progressWidth}%` }}
        />
      </div>

      {/* ドット & ラベル */}
      {sorted.map((item, i) => {
        const p = pos(item.ym)
        const above = i % 2 === 0
        return (
          <div
            key={item.ym}
            className="absolute"
            style={{ left: `${p}%`, top: 0, transform: 'translateX(-50%)' }}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow -mt-1 mx-auto ${item.dot} ${item.isNow ? 'ring-2 ring-blue-300' : ''}`}
            />
            {above ? (
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
                <span className={`text-[10px] font-semibold whitespace-nowrap ${item.dot.includes('emerald') ? 'text-emerald-600' : item.dot.includes('blue') ? 'text-blue-600' : item.dot.includes('amber') ? 'text-amber-600' : 'text-gray-500'}`}>
                  {item.label}
                </span>
                <span className="text-[9px] text-gray-400 whitespace-nowrap">{item.sub ?? item.ym.replace('-', '/')}</span>
              </div>
            ) : (
              <div className="absolute top-5 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
                <span className="text-[9px] text-gray-400 whitespace-nowrap">{item.sub ?? item.ym.replace('-', '/')}</span>
                <span className={`text-[10px] font-semibold whitespace-nowrap ${item.dot.includes('emerald') ? 'text-emerald-600' : item.dot.includes('blue') ? 'text-blue-600' : item.dot.includes('amber') ? 'text-amber-600' : 'text-gray-500'}`}>
                  {item.label}
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── 回収タイミング行 ──────────────────────────
function RecoveryRow({
  dot, label, sub, ym, missingMsg,
}: {
  dot: string
  label: string
  sub?: string
  ym: string | null
  missingMsg?: string
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
        <div>
          <p className="text-sm font-medium text-gray-700">{label}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </div>
      {ym ? (
        <div className="text-right shrink-0 ml-4">
          <p className={`text-base font-bold ${dot.includes('emerald') ? 'text-emerald-600' : dot.includes('blue') ? 'text-blue-600' : dot.includes('amber') ? 'text-amber-600' : 'text-gray-700'}`}>
            {ymDisplay(ym)}
          </p>
          <p className="text-xs text-gray-400">{fromNowLabel(ym)}</p>
        </div>
      ) : (
        <p className="text-sm text-gray-400 ml-4">{missingMsg ?? '—'}</p>
      )}
    </div>
  )
}

// ── シミュレーション定数 ──────────────────────
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
  past:   { label: '完了',   cls: 'bg-gray-100 text-gray-500' },
  active: { label: '入居中', cls: 'bg-emerald-100 text-emerald-700' },
  future: { label: '予定',   cls: 'bg-blue-100 text-blue-700' },
}

// ── メインコンポーネント ───────────────────────
export default function RoomSimulationPanel({ room, actualOccupancy, recovery }: Props) {
  const [occupancy, setOccupancy] = useState(actualOccupancy > 0 ? nearestOpt(actualOccupancy) : 0.7)
  const [customPrice, setCustomPrice] = useState(room.current_price)
  const [showDetail, setShowDetail] = useState(false)

  // 計画回収月（ローカル保存: 運用開始からN ヶ月）
  const [plannedMonths, setPlannedMonths] = useState<number | null>(null)
  const [editingPlan, setEditingPlan] = useState(false)
  const [planInput, setPlanInput] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem(`plan_recovery_${room.id}`)
    if (stored) {
      const n = Number(stored)
      setPlannedMonths(n)
      setPlanInput(String(n))
    }
  }, [room.id])

  function savePlan() {
    const n = Number(planInput)
    if (!planInput || isNaN(n) || n <= 0) return
    setPlannedMonths(n)
    localStorage.setItem(`plan_recovery_${room.id}`, String(n))
    setEditingPlan(false)
  }

  function clearPlan() {
    setPlannedMonths(null)
    setPlanInput('')
    localStorage.removeItem(`plan_recovery_${room.id}`)
    setEditingPlan(false)
  }

  const contractStartYM = room.contract_start
    ? `${room.contract_start.slice(0, 4)}-${room.contract_start.slice(5, 7)}`
    : null

  // 計画回収月
  let plannedRecoveryYM: string | null = null
  if (contractStartYM && plannedMonths) {
    const [sy, sm] = contractStartYM.split('-').map(Number)
    const pd = new Date(sy, sm - 1 + plannedMonths, 1)
    plannedRecoveryYM = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}`
  }

  // 最短回収月（確定予約 or 実績ペースで早い方）
  const candidates = [recovery.confirmedRecoveryYM, recovery.actualPaceRecoveryYM].filter(Boolean) as string[]
  const earliestRecoveryYM = candidates.length > 0 ? candidates.sort()[0] : null

  // 計画比（確定予約ベース vs 計画）
  let speedInfo: { diff: number; pct: number } | null = null
  if (contractStartYM && plannedRecoveryYM && recovery.confirmedRecoveryYM) {
    const planMonths = toMonthsFromStart(contractStartYM, plannedRecoveryYM)
    const actualMonths = toMonthsFromStart(contractStartYM, recovery.confirmedRecoveryYM)
    if (planMonths > 0) {
      const diff = planMonths - actualMonths // +: 前倒し
      const pct = Math.abs(Math.round((diff / planMonths) * 100))
      speedInfo = { diff, pct }
    }
  }

  // タイムラインアイテム
  const nowYM = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()

  const tlItems: TLItem[] = []
  if (contractStartYM) {
    tlItems.push({ ym: contractStartYM, label: '開始', sub: contractStartYM.replace('-', '/'), dot: 'bg-gray-400' })
  }
  tlItems.push({ ym: nowYM, label: '現在', sub: nowYM.replace('-', '/'), dot: 'bg-blue-500', isNow: true })
  if (recovery.confirmedRecoveryYM) {
    tlItems.push({ ym: recovery.confirmedRecoveryYM, label: '確定予約', sub: recovery.confirmedRecoveryYM.replace('-', '/'), dot: 'bg-emerald-500' })
  }
  if (recovery.actualPaceRecoveryYM && recovery.actualPaceRecoveryYM !== recovery.confirmedRecoveryYM) {
    tlItems.push({ ym: recovery.actualPaceRecoveryYM, label: '実績ペース', sub: recovery.actualPaceRecoveryYM.replace('-', '/'), dot: 'bg-blue-400' })
  }
  if (plannedRecoveryYM) {
    tlItems.push({ ym: plannedRecoveryYM, label: '計画', sub: plannedRecoveryYM.replace('-', '/'), dot: 'bg-amber-400' })
  }

  const monthlyFixed = sumCosts(room.monthly_costs)
  const monthlyUtility = (room.utility_electricity_estimate || 0) + (room.utility_water_estimate || 0)
  const monthlyCost = monthlyFixed + monthlyUtility
  const isRecovered = recovery.remainingRecovery <= 0 && recovery.initialCost > 0

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

  const priceScenarios: { label: string; price: number; highlight?: boolean; custom?: boolean }[] = [
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

      {/* ══ 投資回収タイミング ══════════════════════ */}
      {recovery.initialCost > 0 && (
        <div className={`card ${isRecovered ? 'bg-emerald-50 border-emerald-200' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-bold text-gray-800">投資回収タイミング</h4>
            <div className="flex items-center gap-2">
              {recovery.operationMonths > 0 && (
                <span className="text-xs text-gray-400">運用{recovery.operationMonths}ヶ月目</span>
              )}
              {earliestRecoveryYM && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  fromNowMonths(earliestRecoveryYM) < 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  最短 {ymDisplay(earliestRecoveryYM)}
                </span>
              )}
            </div>
          </div>

          {/* 3指標の行 */}
          <div className="mb-2">
            <RecoveryRow
              dot="bg-emerald-500"
              label="確定予約ベース"
              sub="入っている予約がすべて完了した場合"
              ym={recovery.confirmedRecoveryYM}
              missingMsg="予約データ不足"
            />
            <RecoveryRow
              dot="bg-blue-400"
              label="実績ペース（過去3ヶ月平均）"
              sub={
                recovery.actualPaceMonthlyProfit !== null
                  ? `月平均利益 ${formatCurrency(Math.round(recovery.actualPaceMonthlyProfit))}`
                  : undefined
              }
              ym={recovery.actualPaceRecoveryYM}
              missingMsg={
                recovery.actualPaceMonthlyProfit !== null && recovery.actualPaceMonthlyProfit <= 0
                  ? '赤字のため回収不可'
                  : 'データ不足（3ヶ月未満）'
              }
            />

            {/* 計画行 */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-amber-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">計画</p>
                  {contractStartYM && plannedMonths && (
                    <p className="text-xs text-gray-400">運用開始から{plannedMonths}ヶ月</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                {plannedRecoveryYM ? (
                  <>
                    <div className="text-right">
                      <p className="text-base font-bold text-amber-600">{ymDisplay(plannedRecoveryYM)}</p>
                      <p className="text-xs text-gray-400">{fromNowLabel(plannedRecoveryYM)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setEditingPlan(true); setPlanInput(String(plannedMonths ?? '')) }}
                      className="text-xs text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      変更
                    </button>
                  </>
                ) : editingPlan ? null : (
                  <button
                    type="button"
                    onClick={() => setEditingPlan(true)}
                    className="text-xs text-blue-500 hover:text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1"
                  >
                    計画月を設定
                  </button>
                )}
              </div>
            </div>

            {editingPlan && (
              <div className="ml-5 mt-1 mb-2 flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2">
                <span className="text-xs text-gray-600 whitespace-nowrap">運用開始から</span>
                <input
                  type="number"
                  value={planInput}
                  onChange={e => setPlanInput(e.target.value)}
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center outline-none focus:border-amber-400"
                  placeholder="24"
                  min="1"
                />
                <span className="text-xs text-gray-600">ヶ月で回収</span>
                <button type="button" onClick={savePlan} className="btn-primary py-1 px-3 text-xs">保存</button>
                {plannedMonths && (
                  <button type="button" onClick={clearPlan} className="text-xs text-gray-400 hover:text-red-500">削除</button>
                )}
                <button type="button" onClick={() => setEditingPlan(false)} className="text-xs text-gray-400 hover:text-gray-600">キャンセル</button>
              </div>
            )}
          </div>

          {/* 計画比バッジ */}
          {speedInfo && (
            <div className={`inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-xl mb-4 ${
              speedInfo.diff > 0
                ? 'bg-emerald-100 text-emerald-700'
                : speedInfo.diff < 0
                ? 'bg-red-100 text-red-600'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {speedInfo.diff > 0
                ? `計画より ${speedInfo.diff}ヶ月 前倒し (+${speedInfo.pct}%)`
                : speedInfo.diff < 0
                ? `計画より ${-speedInfo.diff}ヶ月 遅延 (−${speedInfo.pct}%)`
                : '計画通り'
              }
            </div>
          )}

          {/* タイムライン */}
          {tlItems.length >= 2 && <RecoveryTimeline items={tlItems} />}

          {/* ── 4シナリオ比較テーブル ── */}
          {recovery.scenarios.length > 0 && (
            <div className="overflow-x-auto mt-2">
              <p className="text-xs text-gray-400 font-medium mb-2">各時点での回収状況</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="text-left pb-2 pr-4">シナリオ</th>
                    <th className="text-right pb-2 px-2">累積利益</th>
                    <th className="pb-2 px-2 min-w-[130px]">回収率</th>
                    <th className="text-right pb-2 pl-2">残回収 / 状態</th>
                  </tr>
                </thead>
                <tbody>
                  {recovery.scenarios.map((s, i) => {
                    const recovered = s.remainingRecovery <= 0
                    const pct = Math.min(100, Math.max(0, s.recoveryPct))
                    const isBase = i === 0
                    const confirmedWithin = recovery.confirmedRecoveryYM !== null
                      && recovery.confirmedRecoveryYM <= s.cutoffYM
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
                                className={`h-full rounded-full ${recovered || confirmedWithin ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-xs font-semibold w-9 text-right shrink-0 ${
                              recovered || confirmedWithin ? 'text-emerald-600'
                              : s.recoveryPct >= 80 ? 'text-blue-600'
                              : s.recoveryPct >= 50 ? 'text-amber-600'
                              : 'text-red-500'
                            }`}>
                              {s.recoveryPct}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2 pl-2 text-right text-xs font-semibold">
                          {confirmedWithin ? (
                            <span className="text-emerald-600">
                              {recovery.confirmedRecoveryYM
                                ? `${recovery.confirmedRecoveryYM.slice(0, 4)}/${parseInt(recovery.confirmedRecoveryYM.slice(5, 7))}月 回収 ✓`
                                : '回収済み ✓'
                              }
                            </span>
                          ) : recovered ? (
                            <span className="text-emerald-600">回収済み ✓</span>
                          ) : (
                            <span className="text-amber-700">{formatCurrency(s.remainingRecovery)}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="text-[11px] text-gray-400 mt-1.5">
                ※今月末まで = 進行中予約を日割り按分した確定収益ベース
              </p>
            </div>
          )}

          {/* 詳細内訳（トグル） */}
          <button
            type="button"
            onClick={() => setShowDetail(v => !v)}
            className="mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
          >
            <span>{showDetail ? '▲' : '▼'}</span>
            {showDetail ? '詳細を閉じる' : '収支内訳を確認する'}
          </button>

          {showDetail && (
            <div className="border-t border-gray-100 pt-3 mt-2">
              <p className="text-xs font-semibold text-gray-500 mb-2">累積利益の内訳（今月末まで日割りベース）</p>
              <div className="space-y-0.5 text-sm">
                <div className="flex justify-between text-gray-500 text-xs font-medium pt-1">
                  <span>【収入】</span>
                </div>
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
                <div className="flex justify-between text-gray-500 text-xs font-medium pt-1"><span>【支出】</span></div>
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
                  <span className="text-gray-600">光熱費<span className="text-xs text-gray-400 ml-1">（実績）</span></span>
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
          )}

          {!recovery.hasOperationData && (
            <p className="text-xs text-amber-600 mt-3 bg-amber-50 rounded-lg px-3 py-1.5">
              予約データがまだありません。運用開始後に累積利益が反映されます。
            </p>
          )}
        </div>
      )}

      {/* ══ 稼働率 × 価格シミュレーション ══════════ */}
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
              {priceScenarios.map(({ label, price, highlight, custom }) => {
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
                        <span className={`font-medium ${highlight ? 'text-blue-700' : 'text-gray-700'}`}>{label}</span>
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

      {/* ══ 逆算カード ════════════════════════════ */}
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
          <p className="font-semibold text-emerald-700">初期投資を回収済みです</p>
          <p className="text-sm text-emerald-600 mt-0.5">
            累積利益 {formatCurrency(recovery.accumulatedProfit)} で
            初期投資 {formatCurrency(recovery.initialCost)} を超えました
          </p>
          {recovery.confirmedRecoveryYM && (
            <p className="text-xs text-emerald-500 mt-1">{ymDisplay(recovery.confirmedRecoveryYM)} に回収完了</p>
          )}
        </div>
      )}
    </div>
  )
}
