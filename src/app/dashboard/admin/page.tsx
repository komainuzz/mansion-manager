import { createSupabaseServer } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { approveUser, rejectUser } from './actions'

const ADMIN_EMAIL = 'kom.kim126@gmail.com'

const STATUS_LABEL: Record<string, string> = {
  pending: '承認待ち',
  approved: '承認済み',
  rejected: '拒否済み',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

export default async function AdminPage() {
  const supabase = createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect('/dashboard')
  }

  const { data: approvals } = await supabase
    .from('user_approvals')
    .select('*')
    .neq('email', ADMIN_EMAIL)
    .order('created_at', { ascending: false })

  const pending = approvals?.filter(a => a.status === 'pending') ?? []
  const others = approvals?.filter(a => a.status !== 'pending') ?? []

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">ユーザー承認管理</h1>

      {pending.length === 0 && others.length === 0 && (
        <p className="text-gray-500 text-sm">アクセス申請はありません。</p>
      )}

      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            承認待ち ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map(approval => (
              <div
                key={approval.user_id}
                className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  {approval.avatar_url ? (
                    <img
                      src={approval.avatar_url}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-sm font-medium">
                      {(approval.display_name ?? approval.email)[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{approval.display_name ?? approval.email}</p>
                    <p className="text-xs text-gray-500">{approval.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <form action={approveUser.bind(null, approval.user_id)}>
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                    >
                      承認
                    </button>
                  </form>
                  <form action={rejectUser.bind(null, approval.user_id)}>
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                    >
                      拒否
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            過去の申請
          </h2>
          <div className="space-y-2">
            {others.map(approval => (
              <div
                key={approval.user_id}
                className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {approval.avatar_url ? (
                    <img
                      src={approval.avatar_url}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-sm">
                      {(approval.display_name ?? approval.email)[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-800">{approval.display_name ?? approval.email}</p>
                    <p className="text-xs text-gray-400">{approval.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLOR[approval.status]}`}>
                    {STATUS_LABEL[approval.status]}
                  </span>
                  {approval.status === 'rejected' && (
                    <form action={approveUser.bind(null, approval.user_id)}>
                      <button
                        type="submit"
                        className="text-xs text-green-600 hover:text-green-800 transition-colors"
                      >
                        承認に変更
                      </button>
                    </form>
                  )}
                  {approval.status === 'approved' && (
                    <form action={rejectUser.bind(null, approval.user_id)}>
                      <button
                        type="submit"
                        className="text-xs text-red-500 hover:text-red-700 transition-colors"
                      >
                        取り消し
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
