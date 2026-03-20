import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import AdminNav from '@/components/AdminNav'
import Providers from '@/app/providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Akiba Dashboard',
  description: 'Akiba Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-gray-50 pb-10">
            <AdminNav />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  )
}
