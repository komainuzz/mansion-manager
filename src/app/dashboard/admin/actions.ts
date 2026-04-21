'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

const ADMIN_EMAIL = 'kom.kim126@gmail.com'

async function assertAdmin() {
  const supabase = createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    throw new Error('Unauthorized')
  }
  return supabase
}

export async function approveUser(userId: string) {
  const supabase = await assertAdmin()
  await supabase
    .from('user_approvals')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
  revalidatePath('/dashboard/admin')
}

export async function rejectUser(userId: string) {
  const supabase = await assertAdmin()
  await supabase
    .from('user_approvals')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
  revalidatePath('/dashboard/admin')
}
