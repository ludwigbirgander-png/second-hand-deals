'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signupAction } from '@/app/actions'
import { AuthShell } from '@/components/AuthShell'
import { Input } from '@/components/ui/Form'
import { Button, buttonClass } from '@/components/ui/Button'

const linkClass = 'text-ink underline underline-offset-[3px] decoration-line-dashed hover:decoration-ink'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData()
    formData.set('email', email)
    formData.set('password', password)

    const result = await signupAction(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    if (result?.sessionCreated) {
      window.location.replace('/watchlist')
      return
    }

    setDone(true)
    setLoading(false)
  }

  if (done) {
    return (
      <AuthShell subtitle="Check your email">
        <p className="m-0 text-[15px] text-ink-2">
          We sent a confirmation link to <strong className="font-medium text-ink">{email}</strong>. Click it to activate your account.
        </p>
        <Link href="/login" className={`${buttonClass({ variant: 'secondary' })} mt-6 no-underline`}>Back to sign in</Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell subtitle="Create your account">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <Input label="Password" type="password" required autoComplete="new-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6+ characters" />
        {error && <p role="alert" className="m-0 text-[13px] text-signal-deep">{error}</p>}
        <Button type="submit" block disabled={loading} className="mt-2">{loading ? 'Creating account…' : 'Create account'}</Button>
      </form>
      <p className="mt-6 mb-0 text-center text-[14px] text-muted">
        Already have an account? <Link href="/login" className={linkClass}>Sign in</Link>
      </p>
    </AuthShell>
  )
}
