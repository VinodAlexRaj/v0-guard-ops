import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect to login if not authenticated
  if (!user && request.nextUrl.pathname.startsWith('/manager') || request.nextUrl.pathname.startsWith('/supervisor')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Redirect to appropriate dashboard based on user role
  if (user && request.nextUrl.pathname === '/') {
    const role = user.user_metadata?.role || 'supervisor'
    const url = request.nextUrl.clone()
    if (role === 'manager') {
      url.pathname = '/manager/overview'
    } else {
      url.pathname = '/supervisor/overview'
    }
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
