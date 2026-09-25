import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Only same-site paths, never protocol-relative URLs like //evil.example
  const nextParam = searchParams.get('next')
  const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/watchlist'
  const isReset = next === '/reset-password'

  if (code) {
    const cookieStore = await cookies()
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '') ?? ''
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ''
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, { ...options, path: options?.path || '/' })
          ),
      },
    })
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error && isReset) return NextResponse.redirect(`${origin}/forgot-password?expired=1`)
  } else if (isReset) {
    return NextResponse.redirect(`${origin}/forgot-password?expired=1`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
