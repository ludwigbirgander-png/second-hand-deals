'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function NavUser({ email }: { email: string }) {
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="ml-auto flex items-center gap-4">
      <span className="hidden sm:block text-sm text-zinc-400 truncate max-w-[180px]">{email}</span>
      <button
        onClick={signOut}
        className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
      >
        Sign out
      </button>
    </div>
  )
}
