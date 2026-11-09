'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthShell } from '@/components/AuthShell'
import { Button, buttonClass } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { signInHref } from '@/lib/auth/next'

export default function JoinListPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const [info, setInfo] = useState<{ list_name: string; role: string } | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // The invite preview is public; whether you're signed in decides the buttons
    Promise.all([
      fetch(`/api/lists/join/${token}`).then((r) => r.json()),
      createClient().auth.getUser().then(({ data }) => !!data.user).catch(() => false),
    ])
      .then(([data, isSignedIn]) => {
        if (data.error) setError(data.error)
        else setInfo(data)
        setSignedIn(isSignedIn)
        setLoading(false)
      })
      .catch(() => { setError('Could not load the invite'); setLoading(false) })
  }, [token])

  async function join() {
    setJoining(true)
    const res = await fetch(`/api/lists/join/${token}`, { method: 'POST' })
    // Signed out in the meantime: show the sign-in buttons again
    if (res.status === 401) {
      setSignedIn(false)
      setJoining(false)
      return
    }
    const data = await res.json().catch(() => ({ error: 'Couldn’t join the list. Try again.' }))
    if (data.error) {
      setError(data.error)
      setJoining(false)
      return
    }
    router.push('/watchlist')
  }

  const here = `/lists/join/${token}`

  if (loading) {
    return (
      <AuthShell>
        <span className="block w-8 h-8 rounded-full border-2 border-shade border-t-ink animate-k-spin" aria-label="Loading" />
      </AuthShell>
    )
  }

  if (error) {
    return (
      <AuthShell subtitle="This invite didn’t work">
        <p role="alert" className="m-0 text-[15px] text-signal-deep">{error}</p>
        <Link href={signedIn ? '/watchlist' : '/login'} className={`${buttonClass({ variant: 'secondary' })} mt-6 no-underline`}>
          {signedIn ? 'Go to watchlist' : 'Go to Kompi'}
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell subtitle="You’ve been invited">
      <p className="m-0 text-[17px] text-ink-2">
        Join <strong className="font-medium text-ink">{info?.list_name}</strong> as {/^[aeiou]/i.test(info?.role ?? '') ? 'an' : 'a'}{' '}
        <strong className="font-medium text-ink">{info?.role}</strong>.
      </p>
      {signedIn ? (
        <div className="flex flex-col gap-2 mt-8">
          <Button block onClick={join} disabled={joining}>{joining ? 'Joining…' : 'Join list'}</Button>
          <Link href="/watchlist" className={`${buttonClass({ variant: 'ghost', block: true })} no-underline`}>Cancel</Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mt-8">
          <p className="m-0 mb-2 text-[14px] text-muted">Sign in or create a free account to join. You’ll come straight back here.</p>
          <Link href={signInHref('/login', here)} className={`${buttonClass({ block: true })} no-underline`}>Sign in to join</Link>
          <Link href={signInHref('/signup', here)} className={`${buttonClass({ variant: 'secondary', block: true })} no-underline`}>Create an account</Link>
        </div>
      )}
    </AuthShell>
  )
}
