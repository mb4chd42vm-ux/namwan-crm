'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Star,
  Store, Settings, LogOut, UserCog, CreditCard, X,
  QrCode, Gift,
} from 'lucide-react'
import { logout } from '@/app/actions/auth'
import { useSidebar } from './SidebarContext'
import type { Role } from '@/lib/auth'

interface NavItem {
  href:     string
  label:    string
  icon:     React.ElementType
  minRole?: Role
  group?:   string
}

const NAV: NavItem[] = [
  { href: '/dashboard',          label: 'Dashboard', icon: LayoutDashboard, group: 'main' },
  { href: '/customers',          label: 'Members',   icon: Users,           group: 'main' },
  { href: '/points',             label: 'Points',    icon: Star,            group: 'main' },
  { href: '/points/qr/create',   label: 'QR Claim',  icon: QrCode,          group: 'main' },
  { href: '/points/redeem/scan', label: 'Redeem',    icon: Gift,            group: 'main' },
  { href: '/branches',           label: 'Branches',  icon: Store,    minRole: 'manager', group: 'manage' },
  { href: '/settings',           label: 'Settings',  icon: UserCog,  minRole: 'admin',   group: 'manage' },
]

const ROLE_RANK: Record<Role, number> = { staff: 0, manager: 1, admin: 2 }

function hasAccess(userRole: Role, minRole?: Role) {
  if (!minRole) return true
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole]
}

const ROLE_LABELS: Record<Role, string> = {
  admin:   'Administrator',
  manager: 'Manager',
  staff:   'Staff',
}

const ROLE_BADGE: Record<Role, string> = {
  admin:   'bg-brand-100 text-brand-700',
  manager: 'bg-sand-200 text-cocoa-700',
  staff:   'bg-cream-300 text-cocoa-600',
}

interface SidebarUser {
  name:  string
  email: string
  role:  Role
}

export default function Sidebar({ user }: { user: SidebarUser }) {
  const path = usePathname()
  const { isOpen, close } = useSidebar()

  const visibleNav = NAV.filter(item => hasAccess(user.role, item.minRole))
  const mainNav    = visibleNav.filter(i => i.group === 'main')
  const manageNav  = visibleNav.filter(i => i.group === 'manage')
  const initial    = user.name.charAt(0).toUpperCase()

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-cocoa-950/40 backdrop-blur-sm lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside className={[
        'fixed inset-y-0 left-0 z-50 flex h-screen w-72 flex-col',
        'bg-cream-100 border-r border-cream-300',
        'transition-transform duration-300 ease-in-out',
        isOpen ? 'translate-x-0 shadow-2xl shadow-cocoa-950/20' : '-translate-x-full',
        'lg:relative lg:w-64 lg:translate-x-0 lg:shadow-none',
      ].join(' ')}>

        {/* ── Logo ── */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-cream-300">
          <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-700 shadow-md shadow-brand-900/30">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
              <path d="M3.5 18.5L7 14l4 2-1.5 4H3.5zm17-13L17 9.5l-2-4 1.5-4.5 4 4.5zM12 13l-5-2.5 7.5-7.5L17 8 12 13z"/>
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-cocoa-900 leading-none tracking-tight">Namwan Loyalty</p>
            <p className="text-[10px] text-cocoa-500 mt-0.5 tracking-wide uppercase font-medium">
              {user.role === 'admin' ? 'Admin' : user.role === 'manager' ? 'Manager' : 'Staff'} Portal
            </p>
          </div>
          <button
            onClick={close}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-cocoa-400 hover:bg-cream-300 transition-colors lg:hidden"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 px-4 py-5 overflow-y-auto space-y-5">

          {/* Main nav */}
          <div>
            <p className="px-2 pb-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-cocoa-400">
              Menu
            </p>
            <div className="space-y-0.5">
              {mainNav.map(({ href, label, icon: Icon }) => {
                const active = path === href || path.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={close}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150 ${
                      active
                        ? 'bg-white text-brand-700 shadow-sm shadow-cocoa-900/8'
                        : 'text-cocoa-600 hover:bg-white/70 hover:text-cocoa-900'
                    }`}
                  >
                    <Icon
                      size={15}
                      className={active ? 'text-brand-600' : 'text-cocoa-400 group-hover:text-cocoa-600'}
                    />
                    {label}
                    {active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Manage nav (manager/admin only) */}
          {manageNav.length > 0 && (
            <div>
              <p className="px-2 pb-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-cocoa-400">
                Manage
              </p>
              <div className="space-y-0.5">
                {manageNav.map(({ href, label, icon: Icon }) => {
                  const active = path === href || path.startsWith(href + '/')
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={close}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150 ${
                        active
                          ? 'bg-white text-brand-700 shadow-sm shadow-cocoa-900/8'
                          : 'text-cocoa-600 hover:bg-white/70 hover:text-cocoa-900'
                      }`}
                    >
                      <Icon
                        size={15}
                        className={active ? 'text-brand-600' : 'text-cocoa-400 group-hover:text-cocoa-600'}
                      />
                      {label}
                      {active && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </nav>

        {/* ── Bottom ── */}
        <div className="border-t border-cream-300 px-4 py-4 space-y-1">
          {/* User strip */}
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 mb-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-700 text-[12px] font-bold text-white shadow-sm">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-cocoa-900 leading-none">{user.name}</p>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${ROLE_BADGE[user.role]}`}>
                {user.role}
              </span>
            </div>
          </div>

          <Link
            href="/member"
            target="_blank"
            onClick={close}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium text-cocoa-500 hover:bg-white/70 hover:text-cocoa-800 transition-colors"
          >
            <CreditCard size={14} className="text-cocoa-400" />
            Member Portal ↗
          </Link>

          <Link
            href="/settings"
            onClick={close}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium text-cocoa-500 hover:bg-white/70 hover:text-cocoa-800 transition-colors"
          >
            <Settings size={14} className="text-cocoa-400" />
            Settings
          </Link>

          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium text-cocoa-500 hover:bg-brand-50 hover:text-brand-700 transition-colors"
            >
              <LogOut size={14} className="text-cocoa-400" />
              Sign Out
            </button>
          </form>
        </div>

      </aside>
    </>
  )
}
