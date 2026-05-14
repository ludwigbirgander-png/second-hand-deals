'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: 'system',
  setTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system')

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      setThemeState(stored)
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement

    function apply() {
      if (theme === 'dark') {
        root.classList.add('dark')
      } else if (theme === 'light') {
        root.classList.remove('dark')
      } else {
        root.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches)
      }
    }

    apply()

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [theme])

  function setTheme(t: Theme) {
    setThemeState(t)
    localStorage.setItem('theme', t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
