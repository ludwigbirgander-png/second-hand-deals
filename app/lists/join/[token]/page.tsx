'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-200 dark:border-zinc-700 border-t-zinc-600 dark:border-t-zinc-300 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="w-full max-w-sm text-center">
          <p className="text-sm text-red-500">{error}</p>
          <Link href="/" className="mt-4 inline-block text-sm text-zinc-500 dark:text-zinc-400 underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-200">
            Go to watchlist
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">You've been invited</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Join <span className="font-medium text-zinc-900 dark:text-zinc-100">{info?.list_name}</span> as a{' '}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{info?.role}</span>
          </p>
        </div>

        <button
          onClick={join}
          disabled={joining}
          className="w-full rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 py-2.5 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
        >
          {joining ? 'Joining…' : 'Join list'}
        </button>

        <Link href="/" className="block text-sm text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
          Cancel
        </Link>
      </div>
    </div>
  )
}
