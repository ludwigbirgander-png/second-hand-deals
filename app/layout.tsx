import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import Link from 'next/link'
import { NavUser } from '@/components/NavUser'
import { ThemeProvider } from '@/components/ThemeProvider'
import { createClient } from '@/lib/supabase/server'
import './globals.css'

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Compy',
  description: 'Find the best second-hand deals across Swedish marketplaces',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="sv" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme:dark)').matches;if(t==='dark'||((!t||t==='system')&&d)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
        }} />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors">
        <ThemeProvider>
          <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
            <div className="max-w-4xl mx-auto px-4 py-5 flex items-center gap-3">
              <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                Compy
              </Link>
              {user && (
                <>
                  <span className="hidden md:block text-sm text-zinc-400 dark:text-zinc-500">Find the best second-hand deals</span>
                  <NavUser email={user.email ?? ''} />
                </>
              )}
            </div>
          </header>
          <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  )
}
