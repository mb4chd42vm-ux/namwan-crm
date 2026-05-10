'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  Star, Coffee, Gift, Phone, Loader2, AlertTriangle,
  ShoppingBag, ChevronRight, ArrowLeft, CheckCircle,
} from 'lucide-react'
import { useLiff, type LiffProfile } from '@/hooks/useLiff'

// ── Types ────────────────────────────────────────────────────────────────────

interface Customer {
  id:             string
  name:           string
  phone:          string
  line_id:        string
  picture_url:    string | null
  total_points:   number
  total_spending: number
  visit_count:    number
  last_visit_at:  string | null
  segment:        string
  home_branch_id: string | null
  is_active:      boolean
}

interface Tx {
  id:            string
  type:          string
  points:        number
  balance_after: number
  note:          string | null
  created_at:    string
  branches:      { name: string; color_hex: string } | null
}

interface Purchase {
  id:             string
  purchased_at:   string
  total_amount:   number
  points_earned:  number
  drink_quantity: number
  branches:       { name: string; color_hex: string } | null
  purchase_items: { name: string; quantity: number; unit_price: number }[] | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SEGMENT_INFO: Record<string, { label: string; color: string; bg: string }> = {
  vip:       { label: 'VIP',       color: 'text-amber-700',   bg: 'bg-amber-100'   },
  returning: { label: 'Returning', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  new:       { label: 'New',       color: 'text-blue-700',    bg: 'bg-blue-100'    },
  inactive:  { label: 'Inactive',  color: 'text-gray-500',    bg: 'bg-gray-100'    },
}

const TX_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  earn:   { label: 'Earn',   color: 'text-emerald-700', bg: 'bg-emerald-100' },
  redeem: { label: 'Redeem', color: 'text-red-700',     bg: 'bg-red-100'     },
  adjust: { label: 'Adjust', color: 'text-blue-700',    bg: 'bg-blue-100'    },
  expire: { label: 'Expire', color: 'text-gray-500',    bg: 'bg-gray-100'    },
}

function fmt(n: number) { return n.toLocaleString() }
function thb(n: number) { return `฿${Math.round(n).toLocaleString()}` }

// ── View: Loading ─────────────────────────────────────────────────────────────

function LoadingView({ message = 'Loading…' }: { message?: string }) {
  return (
    <FullScreen>
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={36} className="text-brand-400 animate-spin" />
        <p className="text-sm text-white/70">{message}</p>
      </div>
    </FullScreen>
  )
}

// ── View: Error ───────────────────────────────────────────────────────────────

function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <FullScreen>
      <div className="flex flex-col items-center gap-5 text-center px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
          <AlertTriangle size={28} className="text-red-300" />
        </div>
        <div>
          <p className="text-lg font-bold text-white">Something went wrong</p>
          <p className="text-sm text-white/60 mt-1">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-2xl bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
          >
            Try again
          </button>
        )}
      </div>
    </FullScreen>
  )
}

// ── View: Open in LINE prompt ─────────────────────────────────────────────────

function NotLoggedInView({ onLogin }: { onLogin: () => void }) {
  return (
    <FullScreen>
      <div className="flex flex-col items-center gap-6 text-center px-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10">
          <Star size={36} className="text-amber-300 fill-amber-300" />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">Namwan Loyalty</p>
          <p className="text-sm text-white/60 mt-2">Sign in with LINE to view your membership card, points balance, and purchase history.</p>
        </div>
        <button
          onClick={onLogin}
          className="flex items-center gap-3 rounded-2xl bg-[#06C755] px-8 py-4 text-base font-bold text-white shadow-lg active:scale-95 transition-transform"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white"><path d="M12 2C6.48 2 2 6.16 2 11.25c0 4.58 3.87 8.4 9.08 9.12.35.07.84.23.96.52.11.26.07.67.03.94l-.15.91c-.05.26-.22 1.03.9.56 1.12-.47 6.05-3.56 8.25-6.1C22.66 15.01 22 13.2 22 11.25 22 6.16 17.52 2 12 2z"/></svg>
          Log in with LINE
        </button>
        <p className="text-xs text-white/40">Your loyalty points are safe and secure</p>
      </div>
    </FullScreen>
  )
}

// ── View: Register (link phone to LINE) ───────────────────────────────────────

function RegisterView({
  profile,
  onLinked,
}: {
  profile: LiffProfile
  onLinked: (customer: Customer) => void
}) {
  const [phone, setPhone]   = useState('')
  const [isPending, start]  = useTransition()
  const [error, setError]   = useState<string | null>(null)
  const [step, setStep]     = useState<'form' | 'success'>('form')

  async function submit() {
    const trimmed = phone.trim()
    if (trimmed.length < 8) { setError('Enter a valid phone number (at least 8 digits)'); return }

    setError(null)
    start(async () => {
      try {
        const res = await fetch('/api/liff/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            line_id:      profile.userId,
            display_name: profile.displayName,
            picture_url:  profile.pictureUrl,
            phone:        trimmed,
          }),
        })
        const data = await res.json()

        if (data.status === 'already_linked') {
          setError('This phone number is already linked to a different LINE account.')
          return
        }

        if (!res.ok || !data.customer) {
          setError(data.error ?? 'Registration failed. Please try again.')
          return
        }

        onLinked(data.customer as Customer)
      } catch {
        setError('Connection error. Please try again.')
      }
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 flex flex-col">
      <Header />
      <div className="flex-1 bg-[#f8f7f5] rounded-t-3xl px-5 pt-7 pb-10 space-y-5">
        {/* LINE profile header */}
        <div className="flex items-center gap-3">
          {profile.pictureUrl ? (
            <img src={profile.pictureUrl} alt={profile.displayName} className="h-14 w-14 rounded-full object-cover ring-2 ring-white shadow-md" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-2xl font-bold text-white shadow-md">
              {profile.displayName.charAt(0)}
            </div>
          )}
          <div>
            <p className="text-lg font-bold text-gray-900">{profile.displayName}</p>
            <p className="text-sm text-gray-500">Linked via LINE</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-gray-100 p-5 shadow-sm space-y-4">
          <div>
            <p className="text-base font-bold text-gray-900">Link your account</p>
            <p className="text-sm text-gray-500 mt-1">Enter your phone number to find your existing account or create a new one.</p>
          </div>

          <div className="relative">
            <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={e => { setPhone(e.target.value); setError(null) }}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="0812345678"
              autoFocus
              className="w-full h-14 pl-11 pr-4 rounded-2xl border border-gray-200 text-lg font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={submit}
            disabled={isPending || phone.trim().length < 8}
            className="w-full h-14 rounded-2xl bg-brand-600 text-base font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-brand-700"
          >
            {isPending
              ? <><Loader2 size={18} className="animate-spin" /> Linking…</>
              : <>Continue <ChevronRight size={18} /></>
            }
          </button>
        </div>

        {/* Info */}
        <div className="rounded-2xl bg-white border border-gray-100 p-5 shadow-sm space-y-3">
          <p className="text-sm font-semibold text-gray-900">How it works</p>
          {[
            { icon: Coffee, text: '1 drink = 1 point', color: 'text-amber-600', bg: 'bg-amber-50' },
            { icon: Star,   text: '10 points = 1 free drink', color: 'text-brand-600', bg: 'bg-brand-50' },
            { icon: Gift,   text: 'Points shared across all branches', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map(({ icon: Icon, text, color, bg }) => (
            <div key={text} className="flex items-center gap-3">
              <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${bg}`}>
                <Icon size={16} className={color} />
              </div>
              <p className="text-sm text-gray-700">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── View: Member Card ─────────────────────────────────────────────────────────

function MemberView({
  customer,
  txs,
  purchases,
}: {
  customer:  Customer
  txs:       Tx[]
  purchases: Purchase[]
}) {
  const [tab, setTab] = useState<'points' | 'purchases'>('points')

  const progress      = ((customer.total_points % 10) / 10) * 100
  const drinksToFree  = Math.max(0, 10 - (customer.total_points % 10))
  const freeDrinks    = Math.floor(customer.total_points / 10)
  const seg           = SEGMENT_INFO[customer.segment] ?? SEGMENT_INFO['new']

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 flex flex-col">
      <Header />

      {/* Points card hero */}
      <div className="px-5 pb-7 space-y-4">
        {/* Profile + segment */}
        <div className="flex items-center gap-3">
          {customer.picture_url ? (
            <img src={customer.picture_url} alt={customer.name} className="h-12 w-12 rounded-full object-cover ring-2 ring-white/30 shadow" />
          ) : (
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-xl font-bold text-white">
              {customer.name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-white truncate">Hi, {customer.name.split(' ')[0]}!</p>
            <p className="text-xs text-white/60">{customer.phone}</p>
          </div>
          <span className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-bold ${seg.bg} ${seg.color}`}>
            {seg.label}
          </span>
        </div>

        {/* Points balance */}
        <div className="rounded-3xl bg-white/10 backdrop-blur border border-white/10 p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wide">Points Balance</p>
              <p className="text-6xl font-black text-white mt-1 leading-none">{fmt(customer.total_points)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/50">Free drinks</p>
              <p className="text-3xl font-black text-amber-300">{freeDrinks}</p>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>Progress to next free drink</span>
              <span className="font-semibold text-white">{10 - drinksToFree}/10</span>
            </div>
            <div className="h-3 rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-300 transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-white/50">
              {drinksToFree === 0
                ? '🎉 You have a free drink ready! Show to staff.'
                : `${drinksToFree} more drink${drinksToFree !== 1 ? 's' : ''} to earn a free one`}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Visits',    value: fmt(customer.visit_count) },
            { label: 'Spent',     value: thb(customer.total_spending) },
            { label: 'Free Drinks', value: fmt(freeDrinks) },
          ].map(s => (
            <div key={s.label} className="rounded-2xl bg-white/10 backdrop-blur border border-white/10 px-3 py-3 text-center">
              <p className="text-[10px] text-white/50 uppercase tracking-wide">{s.label}</p>
              <p className="text-lg font-bold text-white mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* History panel */}
      <div className="flex-1 bg-[#f8f7f5] rounded-t-3xl overflow-hidden flex flex-col">
        {/* Tab bar */}
        <div className="flex border-b border-gray-100 bg-white">
          {([
            { id: 'points',    label: 'Points History',   icon: Star },
            { id: 'purchases', label: 'Purchases',         icon: ShoppingBag },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
          {tab === 'points' && (
            txs.length === 0 ? (
              <EmptyState icon={Star} message="No points history yet" />
            ) : (
              txs.map(tx => {
                const style = TX_STYLE[tx.type] ?? TX_STYLE['adjust']
                const branch = tx.branches
                return (
                  <div key={tx.id} className="flex items-center gap-3 rounded-2xl bg-white border border-gray-100 px-4 py-3.5 shadow-sm">
                    <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.bg} ${style.color}`}>
                      {style.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 truncate">{tx.note ?? '—'}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(tx.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                        {branch && ` · ${branch.name.split(' ')[0]}`}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold ${tx.points > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {tx.points > 0 ? '+' : ''}{tx.points}
                      </p>
                      <p className="text-[10px] text-gray-400">{fmt(tx.balance_after)} bal</p>
                    </div>
                  </div>
                )
              })
            )
          )}

          {tab === 'purchases' && (
            purchases.length === 0 ? (
              <EmptyState icon={ShoppingBag} message="No purchases yet" />
            ) : (
              purchases.map(p => {
                const branch = p.branches
                const items  = p.purchase_items ?? []
                return (
                  <div key={p.id} className="rounded-2xl bg-white border border-gray-100 px-4 py-4 shadow-sm space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {branch && (
                            <span className="rounded-md px-2 py-0.5 text-[9px] font-bold text-white flex-shrink-0"
                              style={{ background: branch.color_hex }}>
                              {branch.name.split(' ')[0]}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {new Date(p.purchased_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        {items.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {items.map((item, i) => (
                              <span key={i} className="rounded-lg bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                                {item.name} ×{item.quantity}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-gray-900">{thb(Number(p.total_amount))}</p>
                        <p className="text-[10px] text-emerald-600">+{p.points_earned ?? 0} pts</p>
                      </div>
                    </div>
                  </div>
                )
              })
            )
          )}
        </div>
      </div>
    </div>
  )
}

// ── Small shared components ───────────────────────────────────────────────────

function Header() {
  return (
    <div className="flex items-center gap-3 px-5 pt-12 pb-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
        <Star size={20} className="text-amber-300 fill-amber-300" />
      </div>
      <div>
        <p className="text-base font-bold text-white leading-none">Namwan Loyalty</p>
        <p className="text-xs text-white/50 mt-0.5">Your membership card</p>
      </div>
    </div>
  )
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 flex flex-col items-center justify-center">
      {children}
    </div>
  )
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3">
      <Icon size={32} className="text-gray-200" />
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  )
}

// ── Root Page ─────────────────────────────────────────────────────────────────

type AppState =
  | { phase: 'liff_loading' }
  | { phase: 'liff_error'; message: string }
  | { phase: 'liff_not_logged_in'; login: () => void }
  | { phase: 'fetching_customer'; profile: LiffProfile }
  | { phase: 'needs_registration'; profile: LiffProfile }
  | { phase: 'member'; profile: LiffProfile; customer: Customer; txs: Tx[]; purchases: Purchase[] }
  | { phase: 'error'; message: string; profile?: LiffProfile }

export default function MemberPage() {
  const liff = useLiff(true) // forceLogin = true → triggers LINE OAuth if needed

  const [state, setState] = useState<AppState>({ phase: 'liff_loading' })

  // ── React to LIFF state changes ───────────────────────────────────────────
  useEffect(() => {
    if (liff.status === 'loading' || liff.status === 'unavailable') {
      setState({ phase: 'liff_loading' })
      return
    }

    if (liff.status === 'error') {
      setState({ phase: 'liff_error', message: liff.message })
      return
    }

    if (liff.status === 'not_logged_in') {
      setState({ phase: 'liff_not_logged_in', login: liff.login })
      return
    }

    if (liff.status === 'ready') {
      // Fetch customer data
      setState({ phase: 'fetching_customer', profile: liff.profile })
      fetchMember(liff.profile)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liff.status])

  async function fetchMember(profile: LiffProfile) {
    try {
      const res  = await fetch('/api/liff/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line_id:      profile.userId,
          display_name: profile.displayName,
          picture_url:  profile.pictureUrl,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setState({ phase: 'error', message: data.error ?? 'Failed to load account', profile })
        return
      }

      if (!data.found) {
        setState({ phase: 'needs_registration', profile })
        return
      }

      setState({
        phase:     'member',
        profile,
        customer:  data.customer  as Customer,
        txs:       data.txs       as Tx[],
        purchases: data.purchases as Purchase[],
      })
    } catch {
      setState({ phase: 'error', message: 'Connection error. Please try again.', profile })
    }
  }

  function handleLinked(customer: Customer) {
    if (state.phase !== 'needs_registration') return
    setState({
      phase:     'member',
      profile:   state.profile,
      customer,
      txs:       [],
      purchases: [],
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  switch (state.phase) {
    case 'liff_loading':
    case 'fetching_customer':
      return <LoadingView message={state.phase === 'liff_loading' ? 'Connecting to LINE…' : 'Loading your account…'} />

    case 'liff_error':
      return <ErrorView message={state.message} />

    case 'liff_not_logged_in':
      return <NotLoggedInView onLogin={state.login} />

    case 'needs_registration':
      return <RegisterView profile={state.profile} onLinked={handleLinked} />

    case 'error':
      return (
        <ErrorView
          message={state.message}
          onRetry={state.profile ? () => {
            setState({ phase: 'fetching_customer', profile: state.profile! })
            fetchMember(state.profile!)
          } : undefined}
        />
      )

    case 'member':
      return <MemberView customer={state.customer} txs={state.txs} purchases={state.purchases} />
  }
}
