'use client'

import { useRouter } from 'next/navigation'

interface Props {
  currentYM: string
}

export default function UtilityMonthNav({ currentYM }: Props) {
  const router = useRouter()

  function navigate(offset: number) {
    const [y, m] = currentYM.split('-').map(Number)
    const d = new Date(y, m - 1 + offset, 1)
    const newYM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    router.push(`/dashboard/utilities?ym=${newYM}`)
  }

  const [year, month] = currentYM.split('-')

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => navigate(-1)} className="btn-secondary py-1.5 px-3 text-sm">← 前月</button>
      <span className="font-semibold text-gray-900 min-w-[90px] text-center">
        {year}年{parseInt(month)}月
      </span>
      <button type="button" onClick={() => navigate(1)} className="btn-secondary py-1.5 px-3 text-sm">翌月 →</button>
    </div>
  )
}
