'use client'

import { useState } from 'react'
import Link from 'next/link'
import { loginAction } from '@/app/actions'
import { AuthShell } from '@/components/AuthShell'
import { Input } from '@/components/ui/Form'
import { Button } from '@/components/ui/Button'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData()
    formData.set('email', email)
    formData.set('password', password)

    const result = await loginAction(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      window.location.replace('/watchlist')
    }
  }

  return (
    <AuthShell subtitle="Sign in to continue">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <Input label="Password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        {error && <p role="alert" className="m-0 text-[13px] text-signal-deep">{error}</p>}
        <Button type="submit" block disabled={loading} className="mt-2">{loading ? 'Signing in…' : 'Sign in'}</Button>
      </form>
      <p className="mt-6 mb-0 text-center text-[14px] text-muted">
        No account? <Link href="/signup" className="text-ink underline underline-offset-[3px] decoration-line-dashed hover:decoration-ink">Create one</Link>
      </p>
    </AuthShell>
  )
}
