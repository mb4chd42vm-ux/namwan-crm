'use client'

import { useRouter, usePathname } from 'next/navigation'
import { LogOut, ChevronDown, Menu } from 'lucide-react'
import { useUser, type Role } from '@/components/layout/UserContext'
import { logout } from '@/app/actions/auth'
import { useSidebar } from '@/components/layout/SidebarContext'
import { useState, useRef, useEffect } from 'react'

interface BranchOption { id: string; name: string }

interface Props {
  title:         string
  subtitle?:     string
  branches?:     BranchOption[]
  activeBranch?: string | null
}

const ROLE_LABELS: Record<Role, string> = {
  admin:   'Admin',
  manager: 'Manager',
  staff:   'Staff',
}

const ROLE_BADGE: Record<Role, string> = {
  admin:   'bg-brand-100 text-brand-700',
  manager: 'bg-sand-200 text-cocoa-700',
  staff:   'bg-cream-300 text-cocoa-600',
}

const ROLE_AVATAR: Record<Role, string> = {
  admin:   'bg-brand-700',
  manager: 'bg-cocoa-600',
  staff:   'bg-cocoa-400',
}

export default function Topbar({ title, subtitle, branches = [], activeBranch }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const user     = useUser()
  const { toggle } = useSidebar()

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  function selectBranch(id: string | null) {
    if (id === null) router.push(pathname)
    else router.push(`${pathname}?branch=${id}`)
  }

  const initial    = user?.name.charAt(0).toUpperCase() ?? '?'
  const roleLabel  = user ? ROLE_LABELS[user.role] : ''
  const roleBadge  = user ? ROLE_BADGE[user.role]  : ''
  const roleAvatar = user ? ROLE_AVATAR[user.role]  : 'bg-cocoa-400'

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-cream-300 bg-cream-100/90 backdrop-blur-md px-4 sm:px-6">

      {/* Hamburger — mobile only */}
      <button
        onClick={toggle}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-cocoa-500 hover:bg-cream-200 transition-colors lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {/* Page title */}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[16px] font-semibold text-cocoa-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-[11px] text-cocoa-400 mt-0.5">{subtitle}</p>}
      </div>

      {/* Branch filter pills */}
      {branches.length > 0 && (
        <div className="hidden md:flex items-center gap-1 rounded-xl bg-cream-200 p-1">
          <button
            onClick={() => selectBranch(null)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              !activeBranch
                ? 'bg-white text-cocoa-900 shadow-sm'
                : 'text-cocoa-500 hover:text-cocoa-800'
            }`}
          >
            All
          </button>
          {branches.map(b => (
            <button
              key={b.id}
              onClick={() => selectBranch(b.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeBranch === b.id
                  ? 'bg-white text-cocoa-900 shadow-sm'
                  : 'text-cocoa-500 hover:text-cocoa-800'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* User menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="flex items-center gap-2.5 rounded-xl border border-cream-300 bg-white px-3 py-2 hover:border-cream-400 hover:shadow-sm transition-all"
        >
          <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${roleAvatar}`}>
            {initial}
          </div>
          <div className="hidden sm:block text-left">
            <span className="block text-[12px] font-semibold text-cocoa-900 leading-none max-w-[120px] truncate">
              {user?.name ?? 'Staff'}
            </span>
            <span className="block text-[10px] text-cocoa-400 mt-0.5">{roleLabel}</span>
          </div>
          <ChevronDown size={12} className={`text-cocoa-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-cream-300 bg-white shadow-xl shadow-cocoa-900/10 overflow-hidden z-50">
            {/* User info */}
            <div className="px-4 py-4 border-b border-cream-200">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white ${roleAvatar}`}>
                  {initial}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-cocoa-900 truncate">{user?.name}</p>
                  <p className="text-[10px] text-cocoa-400 truncate mt-0.5">{user?.email}</p>
                </div>
              </div>
              <span className={`mt-3 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${roleBadge}`}>
                {roleLabel}
              </span>
            </div>

            {/* Sign out */}
            <form action={logout}>
              <button
                type="submit"
                className="w-full flex items-center gap-3 px-4 py-3.5 text-[13px] font-medium text-brand-600 hover:bg-brand-50 transition-colors"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  )
}
