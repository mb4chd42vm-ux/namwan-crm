import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Namwan Loyalty',
  description: 'Namwan multi-branch loyalty membership system',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/logo/namwan-logo.png', type: 'image/png', sizes: '192x192' },
      { url: '/logo/namwan-logo-32.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [
      { url: '/logo/namwan-logo.png', sizes: '180x180' },
    ],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  )
}
