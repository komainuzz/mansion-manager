'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Upload, Download, ArrowLeft, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import type { Room } from '@/types'
import { roomDisplayName } from '@/lib/utils'

const TEMPLATE_HEADERS = [
  '建物名',
  '部屋番号',
  'ゲスト名',
  'チェックイン',
  'チェックイン時間',
  'チェックアウト',
  'チェックアウト時間',
  '延長',
  '宿泊料',
  '清掃料(ゲスト負担)',
  '清掃費用(実費)',
  'メモ',
]

const TEMPLATE_EXAMPLE = [
  '渋谷マンション',
  '201',
  '山田 太郎',
  '2024-03-01',
  '午後',
  '2024-03-31',
  '午前',
  'FALSE',
  '150000',
  '5000',
  '3000',
  '特記事項など',
]

interface ParsedReservation {
  room_id: string
  room_name: string
  guest_name: string
  check_in: string
  check_in_time: string
  check_out: string
  check_out_time: string
  is_extension: boolean
  room_fee: number
  cleaning_fee: number
  cleaning_cost: number
  checklist: { label: string; checked: boolean }[]
  memo: string | null
  _error?: string
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  let cols: string[] = []
  let current = ''
  let inQuote = false

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '"') {
      if (inQuote && s[i + 1] === '"') { current += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      cols.push(current.trim()); current = ''
    } else if (ch === '\n' && !inQuote) {
      cols.push(current.trim()); current = ''
      if (cols.some(c => c !== '')) rows.push(cols)
      cols = []
    } else {
      current += ch
    }
  }
  cols.push(current.trim())
  if (cols.some(c => c !== '')) rows.push(cols)
  return rows
}

function parseNum(s: string): number {
  return Number(s.replace(/[¥￥,\s]/g, '')) || 0
}

function normalizeDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(s)) return s.replace(/\//g, '-')
  const m1 = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (m1) return `${m1[1]}-${m1[2].padStart(2, '0')}-${m1[3].padStart(2, '0')}`
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m2) return `${m2[3]}-${m2[1].padStart(2, '0')}-${m2[2].padStart(2, '0')}`
  return null
}

function downloadTemplate(rooms: Room[]) {
  const bom = '﻿'
  const roomNote = rooms.length > 0
    ? `\n\n# 登録済みの部屋名一覧:\n${rooms.map(r => `# ${roomDisplayName(r)}`).join('\n')}`
    : ''
  const content = [TEMPLATE_HEADERS, TEMPLATE_EXAMPLE].map(row => row.join(',')).join('\n') + roomNote
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '予約登録テンプレート.csv'
  a.click()
  URL.revokeObjectURL(url)
}

const DEFAULT_CHECKLIST = [
  { label: '鍵の返却', checked: false },
  { label: '室内清掃完了', checked: false },
  { label: '備品・家電確認', checked: false },
  { label: '退去精算完了', checked: false },
]

export default function ReservationsImportPage() {
  const router = useRouter()
  const [rooms, setRooms] = useState<Room[]>([])
  const [rows, setRows] = useState<ParsedReservation[]>([])
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    supabase.from('rooms').select('id, building_name, room_number').order('building_name').then(({ data }) => {
      if (data) setRooms(data as unknown as Room[])
    })
  }, [])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      // # で始まる行はコメントとして除外
      const filtered = text.split('\n').filter(l => !l.trim().startsWith('#')).join('\n')
      const all = parseCSV(filtered)
      if (all.length < 2) return
      const [header, ...dataRows] = all
      const normalize = (s: string) => s.replace(/[\s()（）/]/g, '')
      const idx = (col: string) => header.findIndex(h => normalize(h) === normalize(col))

      const iBuildingName  = idx('建物名')
      const iRoomNumber    = idx('部屋番号')
      const iGuest         = idx('ゲスト名')
      const iCheckIn       = idx('チェックイン')
      const iCheckInTime   = idx('チェックイン時間')
      const iCheckOut      = idx('チェックアウト')
      const iCheckOutTime  = idx('チェックアウト時間')
      const iIsExtension   = idx('延長')
      const iRoomFee       = idx('宿泊料')
      const iCleanFee      = idx('清掃料ゲスト負担')
      const iCleanCost     = idx('清掃費用実費')
      const iMemo          = idx('メモ')

      const roomNameMap = Object.fromEntries(rooms.map(r => [roomDisplayName(r), r.id]))

      const parsed = dataRows.map((cols, i): ParsedReservation => {
        const lineNum = i + 2
        const buildingName = iBuildingName >= 0 ? cols[iBuildingName] : ''
        if (!buildingName) return makeError(lineNum, '建物名が空です')
        const roomNumber = iRoomNumber >= 0 ? cols[iRoomNumber] : ''
        const roomName = roomNumber ? `${buildingName} ${roomNumber}` : buildingName

        const roomId = roomNameMap[roomName]
        if (!roomId) return makeError(lineNum, `部屋「${roomName}」が見つかりません`)

        const guestName = iGuest >= 0 ? cols[iGuest] : ''
        if (!guestName) return makeError(lineNum, 'ゲスト名が空です')

        const checkIn = normalizeDate(iCheckIn >= 0 ? cols[iCheckIn] : '')
        const checkOut = normalizeDate(iCheckOut >= 0 ? cols[iCheckOut] : '')
        if (!checkIn) return makeError(lineNum, `チェックインの日付を認識できません（YYYY-MM-DD 形式で入力）`)
        if (!checkOut) return makeError(lineNum, `チェックアウトの日付を認識できません（YYYY-MM-DD 形式で入力）`)
        if (checkOut <= checkIn) return makeError(lineNum, 'チェックアウトはチェックインより後の日付にしてください')

        return {
          room_id: roomId,
          room_name: roomName,
          guest_name: guestName,
          check_in: checkIn,
          check_in_time: iCheckInTime >= 0 && cols[iCheckInTime] ? cols[iCheckInTime] : '午後',
          check_out: checkOut,
          check_out_time: iCheckOutTime >= 0 && cols[iCheckOutTime] ? cols[iCheckOutTime] : '午前',
          is_extension: iIsExtension >= 0 ? cols[iIsExtension]?.toLowerCase() === 'true' : false,
          room_fee: iRoomFee >= 0 ? parseNum(cols[iRoomFee] ?? '') : 0,
          cleaning_fee: iCleanFee >= 0 ? parseNum(cols[iCleanFee] ?? '') : 0,
          cleaning_cost: iCleanCost >= 0 ? parseNum(cols[iCleanCost] ?? '') : 0,
          checklist: DEFAULT_CHECKLIST,
          memo: iMemo >= 0 && cols[iMemo] ? cols[iMemo] : null,
        }
      })
      setRows(parsed)
      setDone(false)
      setImportError(null)
    }
    reader.readAsText(file, 'UTF-8')
  }

  function makeError(line: number, msg: string): ParsedReservation {
    return { room_id: '', room_name: '', guest_name: '', check_in: '', check_in_time: '午後', check_out: '', check_out_time: '午前', is_extension: false, room_fee: 0, cleaning_fee: 0, cleaning_cost: 0, checklist: [], memo: null, _error: `行 ${line}: ${msg}` }
  }

  const validRows = rows.filter(r => !r._error)
  const errorRows = rows.filter(r => r._error)

  async function handleImport() {
    if (validRows.length === 0) return
    setImporting(true)
    setImportError(null)

    const { error } = await supabase.from('reservations').insert(
      validRows.map(({ _error: _e, room_name: _n, ...r }) => r)
    )

    if (error) {
      setImportError(error.message)
      setImporting(false)
      return
    }
    setDone(true)
    setImporting(false)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/reservations" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">予約 CSV一括登録</h2>
          <p className="text-sm text-gray-500 mt-0.5">CSVファイルで複数の予約をまとめて登録できます</p>
        </div>
      </div>

      {/* テンプレート */}
      <div className="card bg-blue-50 border border-blue-100">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-blue-900 mb-1">CSVテンプレート</p>
            <p className="text-sm text-blue-700 mb-3">
              以下の列順でCSVを作成してください。1行目はヘッダー行です。
            </p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {TEMPLATE_HEADERS.map((h, i) => (
                <span key={h} className={`text-xs px-2 py-1 rounded font-mono ${i < 5 ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'}`}>
                  {h}{i < 5 ? ' *' : ''}
                </span>
              ))}
            </div>
            <p className="text-xs text-blue-600">
              * 必須項目　／　建物名・部屋番号は部屋管理の登録内容と一致させてください（テンプレートDLで一覧確認できます）　／　チェックイン/アウト時間は「午前」「午後」　／　延長は TRUE / FALSE
            </p>
          </div>
          <button
            onClick={() => downloadTemplate(rooms)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shrink-0 ml-4"
          >
            <Download size={14} />
            テンプレートをDL
          </button>
        </div>
      </div>

      {/* ファイル選択 */}
      <div>
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
          <Upload size={24} className="text-gray-400 mb-2" />
          <span className="text-sm text-gray-500">CSVファイルをクリックして選択</span>
          <span className="text-xs text-gray-400 mt-1">.csv 形式（UTF-8 または Shift-JIS）</span>
          <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </label>
      </div>

      {/* エラー行 */}
      {errorRows.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
          <p className="text-sm font-semibold text-red-700 mb-2">以下の行はスキップされます</p>
          {errorRows.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-red-600">
              <XCircle size={14} />
              {r._error}
            </div>
          ))}
        </div>
      )}

      {/* プレビュー */}
      {validRows.length > 0 && !done && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700">{validRows.length} 件のプレビュー</p>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th">部屋名</th>
                  <th className="table-th">ゲスト名</th>
                  <th className="table-th">チェックイン</th>
                  <th className="table-th">チェックアウト</th>
                  <th className="table-th">延長</th>
                  <th className="table-th">宿泊料</th>
                  <th className="table-th">清掃料</th>
                </tr>
              </thead>
              <tbody>
                {validRows.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="table-td font-medium">{r.room_name}</td>
                    <td className="table-td">{r.guest_name}</td>
                    <td className="table-td text-gray-500">{r.check_in} {r.check_in_time}</td>
                    <td className="table-td text-gray-500">{r.check_out} {r.check_out_time}</td>
                    <td className="table-td">
                      {r.is_extension && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">延長</span>
                      )}
                    </td>
                    <td className="table-td text-emerald-600 font-semibold">{r.room_fee.toLocaleString()}円</td>
                    <td className="table-td text-gray-500">{r.cleaning_fee.toLocaleString()}円</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {importError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {importError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={importing}
              className="btn-primary"
            >
              {importing ? '登録中...' : `${validRows.length} 件を一括登録する`}
            </button>
            <button onClick={() => setRows([])} className="btn-secondary">キャンセル</button>
          </div>
        </div>
      )}

      {/* 完了 */}
      {done && (
        <div className="card bg-emerald-50 border border-emerald-200 text-center py-10">
          <div className="flex justify-center mb-3">
            <CheckCircle size={40} className="text-emerald-500" />
          </div>
          <p className="font-semibold text-emerald-800 mb-1">{validRows.length} 件の予約を登録しました</p>
          <div className="flex gap-3 justify-center mt-5">
            <Link href="/dashboard/reservations" className="btn-primary">予約一覧に戻る</Link>
            <button onClick={() => { setRows([]); setDone(false) }} className="btn-secondary">続けて登録</button>
          </div>
        </div>
      )}
    </div>
  )
}
