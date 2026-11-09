'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { safeNextPath, DEFAULT_AFTER_SIGN_IN } from '@/lib/auth/next'

export async function loginAction(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) return { error: error.message }
  return { ok: true }
}

export async function signupAction(formData: FormData) {
  const supabase = await createClient()

  // After confirming their email, bring people back to where they started (e.g. an
  // invite). Built from this request's own origin, and only for same-site paths.
  const next = safeNextPath(formData.get('next') as string | null)
  const origin = (await headers()).get('origin')
  const emailRedirectTo = origin && next !== DEFAULT_AFTER_SIGN_IN
    ? `${origin}/auth/callback?next=${encodeURIComponent(next)}`
    : undefined

  const { data, error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  })
  if (error) return { error: error.message }
  if (data.user) {
    await supabase.from('profiles').upsert({ id: data.user.id }, { onConflict: 'id' })
  }
  return { ok: true, sessionCreated: !!data.session }
}
