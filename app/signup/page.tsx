'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signupAction } from '@/app/actions'

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
      window.location.replace('/')
      return
    }

    setDone(true)
    setLoading(false)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Check your email</h1>
          <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
            We sent a confirmation link to <span className="text-zinc-700 dark:text-zinc-300">{email}</span>.
            Click it to activate your account.
          </p>
          <Link href="/login" className="mt-6 inline-block text-sm text-zinc-500 dark:text-zinc-400 underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Create account</h1>
          <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">Compy</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-sm outline-none focus:border-zinc-400 dark:focus:border-zinc-500 bg-white dark:bg-zinc-800 transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-zinc-500 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-sm outline-none focus:border-zinc-400 dark:focus:border-zinc-500 bg-white dark:bg-zinc-800 transition-colors"
              placeholder="6+ characters"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 py-2.5 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
          Already have an account?{' '}
          <Link href="/login" className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-2 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
