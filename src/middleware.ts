import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ADMIN_EMAIL = 'kom.kim126@gmail.com'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // 未ログイン: /dashboard または /pending → /login へ
  if (!user) {
    if (pathname.startsWith('/dashboard') || pathname === '/pending') {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // ログイン済み: 承認状態を確認
  const { data: approval } = await supabase
    .from('user_approvals')
    .select('status')
    .eq('user_id', user.id)
    .single()

  const status = approval?.status ?? 'pending'
  const isApproved = status === 'approved'

  // /login → 状態に応じてリダイレクト
  if (pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = isApproved ? '/dashboard' : '/pending'
    return NextResponse.redirect(url)
  }

  // /dashboard 系: 承認済みのみ通過
  if (pathname.startsWith('/dashboard')) {
    if (!isApproved) {
      const url = request.nextUrl.clone()
      url.pathname = '/pending'
      return NextResponse.redirect(url)
    }
    // /dashboard/admin は管理者のみ
    if (pathname.startsWith('/dashboard/admin') && user.email !== ADMIN_EMAIL) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // /pending: 承認済みならダッシュボードへ
  if (pathname === '/pending' && isApproved) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/pending'],
}
