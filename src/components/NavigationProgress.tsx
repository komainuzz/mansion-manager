'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevKey = useRef(`${pathname}?${searchParams}`)

  useEffect(() => {
    const key = `${pathname}?${searchParams}`
    if (key === prevKey.current) return
    prevKey.current = key

    // 遷移完了 → バーを100%にしてフェードアウト
    setProgress(100)
    setTimeout(() => setVisible(false), 300)
    if (timerRef.current) clearInterval(timerRef.current)
  }, [pathname, searchParams])

  useEffect(() => {
    // リンククリックを検知してバーを開始
    function handleClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest('a')
      if (!target) return
      const href = target.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return

      setProgress(10)
      setVisible(true)

      let p = 10
      timerRef.current = setInterval(() => {
        // 85% まで徐々に進む（実際の完了は pathname 変化で検知）
        p = p < 85 ? p + (85 - p) * 0.12 : p
        setProgress(p)
      }, 120)
    }

    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  if (!visible) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-transparent pointer-events-none">
      <div
        className="h-full bg-blue-500 transition-all duration-200 ease-out"
        style={{ width: `${progress}%`, opacity: progress >= 100 ? 0 : 1 }}
      />
    </div>
  )
}
