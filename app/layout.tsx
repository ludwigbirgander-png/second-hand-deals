import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import './globals.css'

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Kompi',
  description: 'Find the best second-hand deals across Swedish marketplaces',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="en" className={`${geist.variable} antialiased`}>
      <body className="min-h-screen flex flex-col font-sans text-ink">
        {user && <AppHeader email={user.email ?? ''} />}
        <main className="flex-1 flex flex-col w-full">{children}</main>
      </body>
    </html>
  )
}
