'use client'

import { useRouter, usePathname } from 'next/navigation'
import { LogOut, ChevronDown, Search } from 'lucide-react'
import { useUser, type Role } from '@/components/layout/UserContext'
import { logout } from '@/app/actions/auth'
import { useState, useRef, useEffect } from 'react'

interface BranchOption { id: string; name: string }

interface Props {
  title:        string
  subtitle?:    string
  branches?:    BranchOption[]
  activeBranch?: string | null
}

const ROLE_LABELS: Record<Role, string> = {
  admin:   'Admin',
  manager: 'Manager',
  staff:   'Staff',
}

const ROLE_COLORS: Record<Role, string> = {
  admin:   'bg-brand-600',
  manager: 'bg-blue-600',
  staff:   'bg-gray-500',
}

export default function Topbar({ title, subtitle, branches = [], activeBranch }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const user     = useUser()

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click
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

  const initial   = user?.name.charAt(0).toUpperCase() ?? '?'
  const roleLabel = user ? ROLE_LABELS[user.role] : ''
  const roleColor = user ? ROLE_COLORS[user.role] : 'bg-gray-400'

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-gray-100 bg-white/80 backdrop-blur px-6">

      {/* Page title */}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-[11px] text-gray-400">{subtitle}</p>}
      </div>

      {/* Branch filter pills */}
      {branches.length > 0 && (
        <div className="hidden md:flex items-center gap-1 rounded-xl bg-gray-100 p-1">
          <button
            onClick={() => selectBranch(null)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              !activeBranch ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            All
          </button>
          {branches.map(b => (
            <button
              key={b.id}
              onClick={() => selectBranch(b.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeBranch === b.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Right controls */}
      <div className="flex items-center gap-2">
        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
          <Search size={15} />
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1.5 hover:bg-gray-100 transition-colors"
          >
            <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${roleColor}`}>
              {initial}
            </div>
            <div className="hidden sm:block text-left">
              <span className="block text-xs font-semibold text-gray-800 leading-none max-w-[120px] truncate">
                {user?.name ?? 'Staff'}
              </span>
              <span className="block text-[9px] text-gray-400 mt-0.5">{roleLabel}</span>
            </div>
            <ChevronDown size={11} className={`text-gray-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-gray-100 bg-white shadow-xl overflow-hidden z-50">
              {/* User info header */}
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-xs font-semibold text-gray-900 truncate">{user?.name}</p>
                <p className="text-[10px] text-gray-400 truncate mt-0.5">{user?.email}</p>
                <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white ${roleColor}`}>
                  {roleLabel}
                </span>
              </div>

              {/* Logout */}
              <form action={logout}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={13} />
                  Sign Out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
