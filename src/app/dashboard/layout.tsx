import Sidebar from '@/components/Sidebar'
import { createSupabaseServer } from '@/lib/supabase-server'

const ADMIN_EMAIL = 'kom.kim126@gmail.com'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex min-h-screen">
      <Sidebar userEmail={user?.email} isAdmin={user?.email === ADMIN_EMAIL} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
