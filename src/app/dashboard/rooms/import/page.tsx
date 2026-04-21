'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Upload, Download, ArrowLeft, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'

const TEMPLATE_HEADERS = [
  '建物名',
  '部屋番号',
  '郵便番号',
  '住所',
  '契約開始日',
  '最寄駅',
  '最寄駅までの時間(分)',
  '管理会社',
  '管理会社の連絡先',
  '鍵の場所',
  'ポスト番号',
  '駐車場(true/false)',
  'WiFi(true/false)',
  '電気',
  '電気温水器',
  'ガス',
  '設備・特徴',
  '掲載価格_基本',
  '掲載価格_ロング',
  '掲載価格_キャンペーン',
  '月次_家賃',
  '月次_管理費',
  '月次_共益費',
  '初期_家具',
  '初期_契約費用',
]

const TEMPLATE_EXAMPLE = [
  '渋谷マンション',
  '201',
  '150-0002',
  '東京都渋谷区渋谷1-2-3',
  '2024-01-01',
  '渋谷駅',
  '5',
  '○○不動産',
  '03-1234-5678',
  'キーボックス・玄関右',
  '1234',
  'false',
  'true',
  '東京電力 30A',
  '○○製 200L',
  '東京ガス',
  '洗濯機 エアコン IH',
  '150000',
  '130000',
  '120000',
  '100000',
  '10000',
  '5000',
  '500000',
  '200000',
]

interface ParsedRoom {
  building_name: string
  room_number: string | null
  postal_code: string | null
  nearest_station: string | null
  nearest_station_minutes: number | null
  address: string | null
  contract_start: string | null
  management_company: string | null
  management_company_contact: string | null
  key_location: string | null
  mailbox_code: string | null
  has_parking: boolean
  has_wifi: boolean
  electricity: string | null
  water_heater: string | null
  gas: string | null
  features: string | null
  current_price: number
  price_long: number
  price_campaign: number
  monthly_costs: Record<string, number>
  initial_costs: Record<string, number>
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

/** 各種日付フォーマットを YYYY-MM-DD に正規化する */
function normalizeDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null

  // YYYY-MM-DD または YYYY/MM/DD（ゼロパディングあり）
  if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(s)) {
    return s.replace(/\//g, '-')
  }
  // YYYY/M/D または YYYY-M-D（Excelが出力するゼロなし形式）
  const m1 = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (m1) {
    return `${m1[1]}-${m1[2].padStart(2, '0')}-${m1[3].padStart(2, '0')}`
  }
  // M/D/YYYY（米国形式）
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m2) {
    return `${m2[3]}-${m2[1].padStart(2, '0')}-${m2[2].padStart(2, '0')}`
  }
  return null
}

function downloadTemplate() {
  const bom = '﻿'
  const content = [TEMPLATE_HEADERS, TEMPLATE_EXAMPLE].map(row => row.join(',')).join('\n')
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '部屋登録テンプレート.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function RoomsImportPage() {
  const [rows, setRows] = useState<ParsedRoom[]>([])
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

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
      const all = parseCSV(text)
      if (all.length < 2) return
      const [header, ...dataRows] = all
      const col = (name: string) => header.findIndex(h => h.replace(/[\s　]/g, '') === name.replace(/[\s　]/g, ''))

      const parsed = dataRows.map((cols, i): ParsedRoom => {
        const lineNum = i + 2
        const get = (name: string) => { const idx = col(name); return idx >= 0 ? cols[idx] ?? '' : '' }

        const name = get('建物名')
        if (!name) return err(lineNum, '建物名が空です')

        const contractStartRaw = get('契約開始日')
        const contractStart = contractStartRaw ? normalizeDate(contractStartRaw) : null

        const stationMin = get('最寄駅までの時間(分)')
        const monthly_costs: Record<string, number> = {}
        if (parseNum(get('月次_家賃')))    monthly_costs['家賃']  = parseNum(get('月次_家賃'))
        if (parseNum(get('月次_管理費')))  monthly_costs['管理費'] = parseNum(get('月次_管理費'))
        if (parseNum(get('月次_共益費')))  monthly_costs['共益費'] = parseNum(get('月次_共益費'))

        const initial_costs: Record<string, number> = {}
        if (parseNum(get('初期_家具')))    initial_costs['家具']    = parseNum(get('初期_家具'))
        if (parseNum(get('初期_契約費用'))) initial_costs['契約費用'] = parseNum(get('初期_契約費用'))

        return {
          building_name: name,
          room_number: get('部屋番号') || null,
          postal_code: get('郵便番号') || null,
          nearest_station: get('最寄駅') || null,
          nearest_station_minutes: stationMin ? Number(stationMin) : null,
          address: get('住所') || null,
          contract_start: contractStart || null,
          management_company: get('管理会社') || null,
          management_company_contact: get('管理会社の連絡先') || null,
          key_location: get('鍵の場所') || null,
          mailbox_code: get('ポスト番号') || null,
          has_parking: get('駐車場(true/false)').toLowerCase() === 'true',
          has_wifi: get('WiFi(true/false)').toLowerCase() === 'true',
          electricity: get('電気') || null,
          water_heater: get('電気温水器') || null,
          gas: get('ガス') || null,
          features: get('設備・特徴') || null,
          current_price: parseNum(get('掲載価格_基本')),
          price_long: parseNum(get('掲載価格_ロング')),
          price_campaign: parseNum(get('掲載価格_キャンペーン')),
          monthly_costs,
          initial_costs,
        }
      })
      setRows(parsed)
      setDone(false)
      setImportError(null)
    }
    reader.readAsText(file, 'UTF-8')
  }

  function err(line: number, msg: string): ParsedRoom {
    return {
      building_name: '', room_number: null, postal_code: null, nearest_station: null, nearest_station_minutes: null,
      address: null, contract_start: null, management_company: null, management_company_contact: null,
      key_location: null, mailbox_code: null, has_parking: false, has_wifi: false,
      electricity: null, water_heater: null, gas: null, features: null,
      current_price: 0, price_long: 0, price_campaign: 0, monthly_costs: {}, initial_costs: {},
      _error: `行 ${line}: ${msg}`,
    }
  }

  const validRows = rows.filter(r => !r._error)
  const errorRows = rows.filter(r => r._error)

  async function handleImport() {
    if (validRows.length === 0) return
    setImporting(true)
    setImportError(null)

    const { error } = await supabase.from('rooms').insert(
      validRows.map(({ _error: _e, ...r }) => r)
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
        <Link href="/dashboard/rooms" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">部屋 CSV一括登録</h2>
          <p className="text-sm text-gray-500 mt-0.5">CSVファイルで複数の部屋をまとめて登録できます</p>
        </div>
      </div>

      {/* テンプレート案内 */}
      <div className="card bg-blue-50 border border-blue-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="font-semibold text-blue-900 mb-2">CSVテンプレート列一覧</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {TEMPLATE_HEADERS.map((h, i) => (
                <span key={h} className={`text-xs px-2 py-0.5 rounded font-mono ${i === 0 ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'}`}>
                  {h}{i === 0 ? ' *' : ''}
                </span>
              ))}
            </div>
            <p className="text-xs text-blue-600">
              * 建物名のみ必須　／　駐車場・WiFi は true / false で入力　／　日付は YYYY-MM-DD 形式
            </p>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shrink-0"
          >
            <Download size={14} />
            テンプレートをDL
          </button>
        </div>
      </div>

      {/* ファイル選択 */}
      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
        <Upload size={24} className="text-gray-400 mb-2" />
        <span className="text-sm text-gray-500">CSVファイルをクリックして選択</span>
        <span className="text-xs text-gray-400 mt-1">.csv 形式（UTF-8 推奨）</span>
        <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
      </label>

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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="table-th">部屋名</th>
                    <th className="table-th">契約開始日</th>
                    <th className="table-th">最寄駅</th>
                    <th className="table-th">管理会社</th>
                    <th className="table-th">駐車場</th>
                    <th className="table-th">WiFi</th>
                    <th className="table-th">基本価格</th>
                    <th className="table-th">月次固定費</th>
                  </tr>
                </thead>
                <tbody>
                  {validRows.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="table-td font-medium">{r.building_name}{r.room_number ? ` ${r.room_number}` : ''}</td>
                      <td className="table-td text-gray-500">{r.contract_start ?? '—'}</td>
                      <td className="table-td text-gray-500">
                        {r.nearest_station
                          ? `${r.nearest_station}${r.nearest_station_minutes != null ? `(${r.nearest_station_minutes}分)` : ''}`
                          : '—'}
                      </td>
                      <td className="table-td text-gray-500">{r.management_company ?? '—'}</td>
                      <td className="table-td text-gray-500">{r.has_parking ? 'あり' : 'なし'}</td>
                      <td className="table-td text-gray-500">{r.has_wifi ? 'あり' : 'なし'}</td>
                      <td className="table-td text-blue-600 font-semibold">{r.current_price ? r.current_price.toLocaleString() + '円' : '—'}</td>
                      <td className="table-td text-gray-500">
                        {Object.keys(r.monthly_costs).length > 0
                          ? Object.values(r.monthly_costs).reduce((a, b) => a + b, 0).toLocaleString() + '円'
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {importError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {importError}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleImport} disabled={importing} className="btn-primary">
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
          <p className="font-semibold text-emerald-800 mb-1">{validRows.length} 件の部屋を登録しました</p>
          <p className="text-sm text-emerald-600 mb-5">詳細項目は各部屋の編集画面から追加できます</p>
          <Link href="/dashboard/rooms" className="btn-primary">部屋一覧に戻る</Link>
        </div>
      )}
    </div>
  )
}
