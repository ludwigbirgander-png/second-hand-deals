'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AuthShell } from '@/components/AuthShell'
import { Input } from '@/components/ui/Form'
import { Button } from '@/components/ui/Button'

const MIN_LENGTH = 6

/** Reached from the reset email via /auth/callback, which has already signed the user in. */
export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mismatch = confirm.length > 0 && confirm !== password ? 'Passwords don’t match' : null
  const valid = password.length >= MIN_LENGTH && password === confirm

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setSaving(true)
    setError(null)
    const { error } = await createClient().auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }
    window.location.replace('/watchlist')
  }

  return (
    <AuthShell subtitle="Choose a new password">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="New password"
          type="password"
          required
          autoComplete="new-password"
          minLength={MIN_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={`${MIN_LENGTH}+ characters`}
        />
        <Input
          label="Repeat new password"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch}
        />
        {error && <p role="alert" className="m-0 text-[13px] text-signal-deep">{error}</p>}
        <Button type="submit" block disabled={saving || !valid} className="mt-2">{saving ? 'Saving…' : 'Save password'}</Button>
      </form>
    </AuthShell>
  )
}
