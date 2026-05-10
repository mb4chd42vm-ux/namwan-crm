import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Namwan Loyalty',
  description: 'Namwan multi-branch loyalty membership system',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  )
}
