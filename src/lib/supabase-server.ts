import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * サーバーコンポーネント・Server Actions 用 Supabase クライアント。
 * Cookie からセッションを読み取り、認証済みユーザー情報を取得できる。
 */
export function createSupabaseServer() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // サーバーコンポーネントからは Cookie をセットできない場合がある（無視して OK）
          }
        },
      },
    }
  )
}
