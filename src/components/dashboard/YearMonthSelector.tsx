'use client'

import { useRouter } from 'next/navigation'

interface Props {
  ym: string      // "YYYY-MM"
  years: number[] // available years
}

export default function YearMonthSelector({ ym, years }: Props) {
  const router = useRouter()
  const selYear = parseInt(ym.slice(0, 4))
  const selMonth = parseInt(ym.slice(5, 7))

  function go(y: number, m: number) {
    router.push(`/dashboard?ym=${y}-${String(m).padStart(2, '0')}`)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        {years.map(y => (
          <button
            key={y}
            onClick={() => go(y, selMonth)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              y === selYear
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {y}年
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
          <button
            key={m}
            onClick={() => go(selYear, m)}
            className={`w-11 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              m === selMonth
                ? 'bg-blue-600 text-white'
                : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {m}月
          </button>
        ))}
      </div>
    </div>
  )
}
