import type { Metadata } from 'next'
import { Figtree } from 'next/font/google'
import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import './globals.css'

const figtree = Figtree({ variable: '--font-figtree', subsets: ['latin'], weight: ['400', '500', '600', '700'] })

export const metadata: Metadata = {
  title: 'Kompi',
  description: 'Find the best second-hand deals across Swedish marketplaces',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="en" className={`${figtree.variable} antialiased`}>
      <body className="min-h-screen flex flex-col font-sans text-ink">
        {user && <AppHeader email={user.email ?? ''} />}
        <main className="flex-1 flex flex-col w-full">{children}</main>
      </body>
    </html>
  )
}
