import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import { UserProvider } from '@/components/layout/UserContext'
import { SidebarProvider } from '@/components/layout/SidebarContext'
import type { Role } from '@/lib/auth'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession()

  if (!session) {
    redirect('/login')
  }

  const user = {
    name:  session.profile?.name  ?? session.email.split('@')[0],
    email: session.profile?.email ?? session.email,
    role:  (session.profile?.role ?? 'staff') as Role,
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-[#f8f7f5]">
        <Sidebar user={user} />
        <UserProvider user={user}>
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            {children}
          </div>
        </UserProvider>
      </div>
    </SidebarProvider>
  )
}
