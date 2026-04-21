'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

export default function PendingPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setEmail(user.email ?? null)
    })
  }, [])

  async function handleCheckStatus() {
    setChecking(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: approval } = await supabase
      .from('user_approvals')
      .select('status')
      .eq('user_id', user.id)
      .single()

    if (approval?.status === 'approved') {
      router.push('/dashboard')
    } else {
      setChecking(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center">
            <Clock size={28} className="text-amber-600" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">承認待ちです</h1>
        <p className="text-sm text-gray-500 mb-6">
          管理者がアクセスを承認するまでお待ちください。<br />
          承認後、ダッシュボードにアクセスできます。
        </p>

        {email && (
          <div className="bg-slate-50 rounded-lg px-4 py-2 mb-6 text-sm text-slate-600">
            {email}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleCheckStatus}
            disabled={checking}
            className="btn-primary w-full justify-center py-2.5"
          >
            {checking ? '確認中...' : '承認状態を確認'}
          </button>
          <button
            onClick={handleLogout}
            className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ログアウト
          </button>
        </div>
      </div>
    </div>
  )
}
