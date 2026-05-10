'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, ShoppingBag, Star,
  Store, Megaphone, Settings, LogOut, UserCog, CreditCard,
} from 'lucide-react'
import { logout } from '@/app/actions/auth'
import type { Role } from '@/lib/auth'

interface NavItem {
  href:      string
  label:     string
  icon:      React.ElementType
  minRole?:  Role   // minimum role required; omit = all roles
}

const NAV: NavItem[] = [
  { href: '/dashboard',       label: 'Dashboard', icon: LayoutDashboard },
  { href: '/customers',       label: 'Customers',  icon: Users },
  { href: '/purchases',       label: 'Purchases',  icon: ShoppingBag },
  { href: '/points',          label: 'Points',     icon: Star },
  { href: '/branches',        label: 'Branches',   icon: Store,     minRole: 'manager' },
  { href: '/campaigns',       label: 'Campaigns',  icon: Megaphone, minRole: 'manager' },
  { href: '/settings/staff',  label: 'Staff',      icon: UserCog,   minRole: 'admin'   },
]

const ROLE_RANK: Record<Role, number> = { staff: 0, manager: 1, admin: 2 }

function hasAccess(userRole: Role, minRole?: Role) {
  if (!minRole) return true
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole]
}

const ROLE_LABELS: Record<Role, string> = {
  admin:   'Admin',
  manager: 'Manager',
  staff:   'Staff',
}

const ROLE_COLORS: Record<Role, string> = {
  admin:   'bg-brand-100 text-brand-700',
  manager: 'bg-blue-50 text-blue-700',
  staff:   'bg-gray-100 text-gray-600',
}

interface SidebarUser {
  name:  string
  email: string
  role:  Role
}

export default function Sidebar({ user }: { user: SidebarUser }) {
  const path = usePathname()

  const visibleNav = NAV.filter(item => hasAccess(user.role, item.minRole))
  const initial    = user.name.charAt(0).toUpperCase()

  return (
    <aside className="flex h-screen w-60 flex-col bg-white border-r border-gray-100 shadow-[1px_0_0_0_#f3f4f6]">

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-md shadow-brand-200">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
            <path d="M3.5 18.5L7 14l4 2-1.5 4H3.5zm17-13L17 9.5l-2-4 1.5-4.5 4 4.5zM12 13l-5-2.5 7.5-7.5L17 8 12 13z"/>
          </svg>
        </div>
        <div>
          <p className="text-[13px] font-bold text-gray-900 leading-none">Namwan CRM</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{ROLE_LABELS[user.role]} Portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          Navigation
        </p>
        {visibleNav.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all ${
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon
                size={16}
                className={active ? 'text-brand-600' : 'text-gray-400 group-hover:text-gray-600'}
              />
              {label}
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-gray-100 px-3 py-3 space-y-0.5">
        {/* User profile strip */}
        <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 mb-1">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-gray-800 leading-none">{user.name}</p>
            <span className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${ROLE_COLORS[user.role]}`}>
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        </div>

        <Link
          href="/member"
          target="_blank"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          <CreditCard size={15} /> Member Portal ↗
        </Link>

        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          <Settings size={15} /> Settings
        </Link>

        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={15} /> Sign Out
          </button>
        </form>
      </div>

    </aside>
  )
}
