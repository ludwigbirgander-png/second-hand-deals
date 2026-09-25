'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthShell } from '@/components/AuthShell'
import { Button, buttonClass } from '@/components/ui/Button'

export default function JoinListPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const [info, setInfo] = useState<{ list_name: string; role: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/lists/join/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setInfo(data)
        setLoading(false)
      })
      .catch(() => { setError('Could not load the invite'); setLoading(false) })
  }, [token])

  async function join() {
    setJoining(true)
    const res = await fetch(`/api/lists/join/${token}`, { method: 'POST' })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
      setJoining(false)
      return
    }
    router.push('/watchlist')
  }

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
        <Link href="/watchlist" className={`${buttonClass({ variant: 'secondary' })} mt-6 no-underline`}>Go to watchlist</Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell subtitle="You’ve been invited">
      <p className="m-0 text-[17px] text-ink-2">
        Join <strong className="font-medium text-ink">{info?.list_name}</strong> as {info?.role === 'admin' ? 'an' : 'a'}{' '}
        <strong className="font-medium text-ink">{info?.role}</strong>.
      </p>
      <div className="flex flex-col gap-2 mt-8">
        <Button block onClick={join} disabled={joining}>{joining ? 'Joining…' : 'Join list'}</Button>
        <Link href="/watchlist" className={`${buttonClass({ variant: 'ghost', block: true })} no-underline`}>Cancel</Link>
      </div>
    </AuthShell>
  )
}
