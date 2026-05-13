import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import Link from 'next/link'
import { NavUser } from '@/components/NavUser'
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
    <html lang="sv" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <header className="bg-white border-b border-zinc-200">
          <div className="max-w-4xl mx-auto px-4 py-5 flex items-center gap-3">
            <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-900 hover:text-zinc-600 transition-colors">
              Compy
            </Link>
            {user && (
              <>
                <span className="hidden md:block text-sm text-zinc-400">Find the best second-hand deals</span>
                <NavUser email={user.email ?? ''} />
              </>
            )}
          </div>
        </header>
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
