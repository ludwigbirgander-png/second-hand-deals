'use server'

import { createClient } from '@/lib/supabase/server'

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
  const { data, error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) return { error: error.message }
  return { ok: true, sessionCreated: !!data.session }
}
