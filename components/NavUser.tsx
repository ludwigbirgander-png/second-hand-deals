'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme, type Theme } from '@/components/ThemeProvider'

function SunIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function MonitorIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}

const THEME_OPTIONS: { value: Theme; icon: React.ReactNode; label: string }[] = [
  { value: 'light',  icon: <SunIcon />,     label: 'Light'  },
  { value: 'system', icon: <MonitorIcon />, label: 'System' },
  { value: 'dark',   icon: <MoonIcon />,    label: 'Dark'   },
]

export function NavUser({ email }: { email: string }) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="ml-auto flex items-center gap-4">
      <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5 gap-0.5">
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            title={opt.label}
            aria-label={`${opt.label} mode`}
            className={`p-1.5 rounded-md transition-colors ${
              theme === opt.value
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {opt.icon}
          </button>
        ))}
      </div>

      <span className="hidden sm:block text-sm text-zinc-400 dark:text-zinc-500 truncate max-w-[180px]">{email}</span>
      <button
        onClick={signOut}
        className="text-sm text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
      >
        Sign out
      </button>
    </div>
  )
}
