import Sidebar from '@/components/Sidebar'
import { createSupabaseServer } from '@/lib/supabase-server'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex min-h-screen">
      <Sidebar userEmail={user?.email} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
