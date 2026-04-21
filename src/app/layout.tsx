import type { Metadata } from 'next'
import './globals.css'
import { Suspense } from 'react'
import NavigationProgress from '@/components/NavigationProgress'

export const metadata: Metadata = {
  title: 'マンスリー管理ダッシュボード',
  description: 'マンスリーマンション管理システム',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <Suspense>
          <NavigationProgress />
        </Suspense>
        {children}
      </body>
    </html>
  )
}
