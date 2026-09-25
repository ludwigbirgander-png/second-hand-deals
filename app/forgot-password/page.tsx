'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AuthShell } from '@/components/AuthShell'
import { Input } from '@/components/ui/Form'
import { Button, buttonClass } from '@/components/ui/Button'

export default function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = use(searchParams)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(null)
    // The link comes back through /auth/callback, which signs you in and opens /reset-password
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    setSending(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  if (sent) {
    return (
      <AuthShell subtitle="Check your email">
        <p className="m-0 text-[15px] text-ink-2">
          If there’s an account for <strong className="font-medium text-ink">{email.trim()}</strong>, we’ve sent a link to choose a new password.
          Open it in this browser.
        </p>
        <Link href="/login" className={`${buttonClass({ variant: 'secondary' })} mt-6 no-underline`}>Back to sign in</Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell subtitle="Reset your password">
      {expired && (
        <p role="alert" className="m-0 mb-5 text-[14px] text-signal-deep">That reset link has expired or was already used. Request a new one.</p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        {error && <p role="alert" className="m-0 text-[13px] text-signal-deep">{error}</p>}
        <Button type="submit" block disabled={sending || !email.trim()} className="mt-2">{sending ? 'Sending…' : 'Send reset link'}</Button>
      </form>
      <p className="mt-6 mb-0 text-center text-[14px] text-muted">
        Remembered it? <Link href="/login" className="text-ink underline underline-offset-[3px] decoration-line-dashed hover:decoration-ink">Sign in</Link>
      </p>
    </AuthShell>
  )
}
