import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import { UserProvider } from '@/components/layout/UserContext'
import { SidebarProvider } from '@/components/layout/SidebarContext'
import type { Role } from '@/lib/auth'

// Force every render to re-run session logic — prevents stale cached role
export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession()

  if (!session) {
    redirect('/login')
  }

  if (!session.profile) {
    // Profile missing means staff_profiles has no row for this auth user, or the query
    // failed (often because SUPABASE_SERVICE_ROLE_KEY is not set in .env.local).
    // getStaffProfile() already logs the specific reason above.
    console.error(
      `[layout] session.profile is null for user ${session.userId} — role will appear as Staff. ` +
      `Check server logs above for the specific cause.`,
    )
  }

  const user = {
    name:  session.profile?.name  ?? session.email.split('@')[0],
    email: session.profile?.email ?? session.email,
    // Never silently default — if profile loaded, use its role; otherwise keep 'staff' but it's now logged
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
