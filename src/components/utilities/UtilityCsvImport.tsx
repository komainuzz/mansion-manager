'use client'

import { useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import type { Room } from '@/types'

interface Props {
  rooms: Room[]
  yearMonth: string
}

interface CsvRow {
  buildingName: string
  roomNumber: string
  electricity: number | null
  water: number | null
  memo: string
  matchedRoomId: string | null
  error: string | null
}

const TEMPLATE = `建物名,部屋番号,電気代,水道代,メモ
グランドヒルズ,101,8000,3000,
グランドヒルズ,102,9500,2800,点検あり`

function parseCSV(text: string, rooms: Room[]): CsvRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  // skip header
  const dataLines = lines[0].includes('建物名') || lines[0].includes('building') ? lines.slice(1) : lines
  return dataLines.filter(l => l.trim()).map(line => {
    const cols = line.split(',')
    const buildingName = (cols[0] ?? '').trim()
    const roomNumber = (cols[1] ?? '').trim()
    const electricityRaw = (cols[2] ?? '').trim()
    const waterRaw = (cols[3] ?? '').trim()
    const memo = (cols[4] ?? '').trim()

    const electricity = electricityRaw !== '' ? Number(electricityRaw) : null
    const water = waterRaw !== '' ? Number(waterRaw) : null

    let matchedRoomId: string | null = null
    let error: string | null = null

    if (!buildingName) {
      error = '建物名が空です'
    } else {
      const match = rooms.find(r =>
        r.building_name === buildingName &&
        (r.room_number ?? '') === roomNumber
      )
      if (match) {
        matchedRoomId = match.id
      } else {
        error = '部屋が見つかりません'
      }
    }

    if (electricity !== null && isNaN(electricity)) error = '電気代が数値ではありません'
    if (water !== null && isNaN(water)) error = '水道代が数値ではありません'

    return { buildingName, roomNumber, electricity, water, memo, matchedRoomId, error }
  })
}

function downloadTemplate(rooms: Room[]) {
  const header = '建物名,部屋番号,電気代,水道代,メモ'
  const rows = rooms.map(r => `${r.building_name},${r.room_number ?? ''},,,`)
  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'utility_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function UtilityCsvImport({ rooms, yearMonth }: Props) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<CsvRow[]>([])
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setRows(parseCSV(text, rooms))
      setDone(false)
    }
    reader.readAsText(file, 'UTF-8')
  }

  const validRows = rows.filter(r => r.matchedRoomId && !r.error)
  const errorRows = rows.filter(r => r.error)

  async function handleSave() {
    if (validRows.length === 0) return
    setSaving(true)
    const payload = validRows.map(r => ({
      room_id: r.matchedRoomId!,
      year_month: yearMonth,
      electricity: r.electricity,
      water: r.water,
      memo: r.memo || null,
      updated_at: new Date().toISOString(),
    }))
    await supabase.from('utility_costs').upsert(payload, { onConflict: 'room_id,year_month' })
    setSaving(false)
    setDone(true)
    router.refresh()
  }

  function handleClose() {
    setOpen(false)
    setRows([])
    setDone(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary py-1.5 px-3 text-sm">
        CSVインポート
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={handleClose}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-semibold text-gray-900">光熱費 CSVインポート</h3>
                <p className="text-xs text-gray-500 mt-0.5">{yearMonth.replace('-', '年')}月分</p>
              </div>
              <button type="button" onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
                <p className="font-medium text-gray-700">CSVフォーマット</p>
                <pre className="text-xs text-gray-500 font-mono whitespace-pre-wrap">{TEMPLATE}</pre>
                <button
                  type="button"
                  onClick={() => downloadTemplate(rooms)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  テンプレートをダウンロード（部屋一覧入り）
                </button>
              </div>

              <div>
                <label className="label">CSVファイルを選択</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFile}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>

              {rows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-600">全{rows.length}行</span>
                    <span className="text-emerald-600 font-medium">有効: {validRows.length}件</span>
                    {errorRows.length > 0 && (
                      <span className="text-red-500 font-medium">エラー: {errorRows.length}件</span>
                    )}
                  </div>

                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="table-th">建物名</th>
                          <th className="table-th">部屋番号</th>
                          <th className="table-th text-right">電気代</th>
                          <th className="table-th text-right">水道代</th>
                          <th className="table-th">状態</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i} className={row.error ? 'bg-red-50' : 'hover:bg-gray-50'}>
                            <td className="table-td">{row.buildingName}</td>
                            <td className="table-td">{row.roomNumber || '—'}</td>
                            <td className="table-td text-right">
                              {row.electricity != null ? row.electricity.toLocaleString() + '円' : '—'}
                            </td>
                            <td className="table-td text-right">
                              {row.water != null ? row.water.toLocaleString() + '円' : '—'}
                            </td>
                            <td className="table-td">
                              {row.error ? (
                                <span className="text-xs text-red-500">{row.error}</span>
                              ) : (
                                <span className="text-xs text-emerald-600 font-medium">OK</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {done && (
                <p className="text-sm text-emerald-600 font-medium">{validRows.length}件を保存しました</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-2 shrink-0">
              {!done && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={validRows.length === 0 || saving}
                  className="btn-primary flex-1 justify-center disabled:opacity-40"
                >
                  {saving ? '保存中...' : `${validRows.length}件を保存`}
                </button>
              )}
              <button type="button" onClick={handleClose} className="btn-secondary">
                {done ? '閉じる' : 'キャンセル'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
