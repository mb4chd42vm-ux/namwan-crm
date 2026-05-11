'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import {
  Star, Coffee, Gift, Phone, Loader2, AlertTriangle,
  ShoppingBag, CheckCircle, QrCode, Clock,
  User, MapPin, Heart, Megaphone, Wheat, Sparkles,
} from 'lucide-react'
import { useLiff, type LiffProfile } from '@/hooks/useLiff'
import ProvinceSelector, { type LocationValue } from '@/components/location/ProvinceSelector'
import { useLanguage } from '@/components/i18n/LanguageProvider'
import LangToggle from '@/components/i18n/LangToggle'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Branch {
  id:        string
  name:      string
  color_hex: string
}

interface Customer {
  id:               string
  name:             string
  phone:            string
  line_id:          string
  picture_url:      string | null
  total_points:     number
  total_spending:   number
  visit_count:      number
  last_visit_at:    string | null
  segment:          string
  home_branch_id:   string | null
  is_active:        boolean
  profile_completed?: boolean
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

// ── Constants ─────────────────────────────────────────────────────────────────

const POINTS_PER_DRINK = 10

const SEGMENT_INFO: Record<string, { label: string; color: string; bg: string }> = {
  top_fans:       { label: 'Top Fan',        color: 'text-amber-800',  bg: 'bg-amber-100'   },
  loyal:          { label: 'Loyal',          color: 'text-purple-800', bg: 'bg-purple-100'  },
  high_potential: { label: 'Rising Star',    color: 'text-blue-800',   bg: 'bg-blue-100'    },
  new_member:     { label: 'New Member',     color: 'text-emerald-800',bg: 'bg-emerald-100' },
  active:         { label: 'Member',         color: 'text-cocoa-800',  bg: 'bg-cream-300'   },
  inactive:       { label: 'We miss you',    color: 'text-cocoa-500',  bg: 'bg-cream-200'   },
  // legacy
  vip:            { label: 'VIP',            color: 'text-amber-800',  bg: 'bg-amber-100'   },
  returning:      { label: 'Returning',      color: 'text-emerald-800',bg: 'bg-emerald-100' },
  new:            { label: 'New Member',     color: 'text-blue-800',   bg: 'bg-blue-100'    },
}

const TX_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  earn:   { label: 'Earned',   color: 'text-emerald-800', bg: 'bg-emerald-50 border border-emerald-100' },
  redeem: { label: 'Redeemed', color: 'text-brand-700',   bg: 'bg-brand-50 border border-brand-100'    },
  adjust: { label: 'Adjusted', color: 'text-cocoa-700',   bg: 'bg-cream-200 border border-cream-300'   },
  expire: { label: 'Expired',  color: 'text-cocoa-500',   bg: 'bg-cream-100 border border-cream-200'   },
}

function fmt(n: number) { return n.toLocaleString() }
function thb(n: number) { return `฿${Math.round(n).toLocaleString()}` }

// ── Shell ─────────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-900 flex flex-col"
      style={{ background: 'linear-gradient(160deg, #44100B 0%, #6A1810 40%, #8A2418 100%)' }}>
      {children}
    </div>
  )
}

function AppHeader() {
  return (
    <div className="flex items-center gap-3 px-5 pt-14 pb-5 flex-shrink-0">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
        <Wheat size={18} className="text-sand-300 fill-sand-300/40" />
      </div>
      <div className="flex-1">
        <p className="text-[15px] font-bold text-white leading-none tracking-tight">Namwan</p>
        <p className="text-[10px] text-white/40 mt-0.5 uppercase tracking-widest">Loyalty</p>
      </div>
      <LangToggle dark />
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonView() {
  return (
    <Shell>
      <AppHeader />
      <div className="px-5 pb-8 space-y-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-white/15" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-28 rounded-full bg-white/15" />
            <div className="h-3 w-20 rounded-full bg-white/10" />
          </div>
        </div>
        <div className="rounded-3xl bg-white/8 border border-white/10 p-6 space-y-5">
          <div className="space-y-2">
            <div className="h-3 w-20 rounded-full bg-white/15" />
            <div className="h-14 w-36 rounded-xl bg-white/15" />
          </div>
          <div className="h-2 rounded-full bg-white/10" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map(i => <div key={i} className="rounded-2xl bg-white/8 h-16" />)}
        </div>
      </div>
      <div className="flex-1 bg-cream-100 rounded-t-3xl flex items-center justify-center">
        <Loader2 size={20} className="text-cream-400 animate-spin" />
      </div>
    </Shell>
  )
}

// ── Open in LINE ──────────────────────────────────────────────────────────────

function OpenInLineView({
  onOpenInLine,
  onBrowserLogin,
}: {
  onOpenInLine:   () => void
  onBrowserLogin: () => void
}) {
  return (
    <Shell>
      <div className="flex-1 flex flex-col items-center justify-center px-7 text-center gap-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/12 border border-white/15">
          <Wheat size={36} className="text-sand-300" />
        </div>
        <div className="space-y-3">
          <p className="text-3xl font-bold text-white tracking-tight">Namwan</p>
          <p className="text-[13px] text-white/50 leading-relaxed max-w-xs">
            Open this page in LINE to view your points balance and membership card.
          </p>
        </div>
        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={onOpenInLine}
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-[#06C755] h-14 text-[15px] font-bold text-white shadow-lg active:scale-[0.97] transition-transform"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden>
              <path d="M12 2C6.48 2 2 6.16 2 11.25c0 4.58 3.87 8.4 9.08 9.12.35.07.84.23.96.52.11.26.07.67.03.94l-.15.91c-.05.26-.22 1.03.9.56 1.12-.47 6.05-3.56 8.25-6.1C22.66 15.01 22 13.2 22 11.25 22 6.16 17.52 2 12 2z"/>
            </svg>
            Open in LINE
          </button>
          <button
            onClick={onBrowserLogin}
            className="w-full rounded-2xl bg-white/10 border border-white/15 h-12 text-[13px] font-medium text-white/60 active:scale-[0.97] transition-all"
          >
            Continue in browser
          </button>
        </div>

        {/* How it works */}
        <div className="w-full max-w-xs rounded-2xl bg-white/8 border border-white/10 p-5 text-left space-y-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30">How it works</p>
          {[
            { icon: Coffee, text: '1 drink = 1 point' },
            { icon: Star,   text: '10 points = 1 free drink' },
            { icon: Gift,   text: 'Points shared across all branches' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <Icon size={14} className="text-sand-300 flex-shrink-0" />
              <p className="text-[13px] text-white/60">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  )
}

// ── Error view ────────────────────────────────────────────────────────────────

function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useLanguage()
  return (
    <Shell>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-7">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
          <AlertTriangle size={28} className="text-white/60" />
        </div>
        <div className="space-y-2">
          <p className="text-xl font-bold text-white">{t.errors.generic}</p>
          <p className="text-[13px] text-white/40 leading-relaxed">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-xl bg-white/12 border border-white/15 px-8 py-3 text-[13px] font-semibold text-white active:scale-[0.97] transition-all"
          >
            {t.member.retry}
          </button>
        )}
      </div>
    </Shell>
  )
}

// ── Registration ──────────────────────────────────────────────────────────────

function RegisterView({
  profile,
  onLinked,
}: {
  profile:  LiffProfile
  onLinked: (customer: Customer) => void
}) {
  const [step,      setStep]      = useState<1 | 2>(1)
  const [isPending, start]        = useTransition()
  const [error,     setError]     = useState<string | null>(null)
  const [branches,  setBranches]  = useState<Branch[]>([])

  const [phone,            setPhone]            = useState('')
  const [birthday,         setBirthday]         = useState('')
  const [gender,           setGender]           = useState('')
  const [location,         setLocation]         = useState<LocationValue | null>(null)
  const [favoriteBranchId, setFavoriteBranchId] = useState('')
  const [discoveredFrom,   setDiscoveredFrom]   = useState('')
  const [marketingConsent, setMarketingConsent] = useState(false)

  useEffect(() => {
    fetch('/api/branches')
      .then(r => r.json())
      .then(d => setBranches(d.branches ?? []))
      .catch(() => {})
  }, [])

  async function submit(e?: React.MouseEvent) {
    e?.preventDefault()
    e?.stopPropagation()
    if (step === 1) {
      if (phone.trim().length < 8) { setError('Enter a valid phone number'); return }
      setStep(2)
      setError(null)
      return
    }

    setError(null)
    start(async () => {
      try {
        const res  = await fetch('/api/liff/register', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            line_id:            profile.userId,
            display_name:       profile.displayName,
            picture_url:        profile.pictureUrl,
            phone:              phone.trim(),
            birthday:           birthday              || undefined,
            gender:             gender                || undefined,
            area_or_province:   location?.province    || undefined,
            region:             location?.regionId    || undefined,
            favorite_branch_id: favoriteBranchId      || undefined,
            discovered_from:    discoveredFrom        || undefined,
            marketing_consent:  marketingConsent,
          }),
        })
        const data = await res.json()

        if (data.status === 'already_linked') {
          setError('This phone is already linked to a different LINE account.')
          setStep(1)
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
    <Shell>
      <AppHeader />
      <div className="flex-1 bg-cream-100 rounded-t-[28px] px-5 pt-7 pb-10 space-y-5 overflow-y-auto">

        {/* Profile row */}
        <div className="flex items-center gap-3">
          {profile.pictureUrl ? (
            <img src={profile.pictureUrl} alt={profile.displayName}
              className="h-14 w-14 rounded-full object-cover ring-2 ring-cream-300 shadow-md" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-2xl font-bold text-white shadow-md">
              {profile.displayName.charAt(0)}
            </div>
          )}
          <div>
            <p className="text-[17px] font-bold text-cocoa-900">{profile.displayName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <svg viewBox="0 0 24 24" className="h-3 w-3 fill-[#06C755]">
                <path d="M12 2C6.48 2 2 6.16 2 11.25c0 4.58 3.87 8.4 9.08 9.12.35.07.84.23.96.52.11.26.07.67.03.94l-.15.91c-.05.26-.22 1.03.9.56 1.12-.47 6.05-3.56 8.25-6.1C22.66 15.01 22 13.2 22 11.25 22 6.16 17.52 2 12 2z"/>
              </svg>
              <span className="text-[11px] text-[#06C755] font-semibold">Signed in with LINE</span>
            </div>
          </div>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-2">
          {[1, 2].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              step >= s ? 'bg-brand-600' : 'bg-cream-300'
            }`} />
          ))}
        </div>

        {/* Step 1 — phone */}
        {step === 1 && (
          <div className="rounded-3xl bg-white border border-cream-200 p-6 shadow-sm space-y-5">
            <div>
              <p className="text-[18px] font-bold text-cocoa-900">Join Namwan</p>
              <p className="text-[13px] text-cocoa-500 mt-1 leading-relaxed">
                Enter your phone number to find or create your loyalty account.
              </p>
            </div>
            <div className="relative">
              <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-cocoa-400" />
              <input
                type="tel" inputMode="numeric"
                value={phone}
                onChange={e => { setPhone(e.target.value); setError(null) }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
                placeholder="0812345678"
                autoFocus
                className="w-full h-14 pl-11 pr-4 rounded-2xl border border-cream-300 bg-cream-50 text-[17px] font-medium text-cocoa-900 placeholder:text-cocoa-300 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-all"
              />
            </div>
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl bg-brand-50 border border-brand-100 px-4 py-3">
                <AlertTriangle size={14} className="text-brand-500 flex-shrink-0 mt-0.5" />
                <p className="text-[13px] text-brand-700">{error}</p>
              </div>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={phone.trim().length < 8}
              className="w-full h-14 rounded-2xl bg-brand-700 text-[15px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-800 active:scale-[0.98] transition-all shadow-md shadow-brand-900/20"
            >
              Continue →
            </button>

            {/* Perks */}
            <div className="pt-2 border-t border-cream-200 space-y-3">
              {[
                { icon: Coffee, text: '1 drink = 1 point' },
                { icon: Star,   text: '10 points = 1 free drink' },
                { icon: Gift,   text: 'Points shared across all branches' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50">
                    <Icon size={14} className="text-brand-600" />
                  </div>
                  <p className="text-[13px] text-cocoa-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 — profile details */}
        {step === 2 && (
          <div className="rounded-3xl bg-white border border-cream-200 p-6 shadow-sm space-y-5">
            <div>
              <p className="text-[18px] font-bold text-cocoa-900">Tell us about you</p>
              <p className="text-[13px] text-cocoa-500 mt-1">All fields are optional — skip anything you prefer not to share.</p>
            </div>

            {/* Birthday */}
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-cocoa-500 uppercase tracking-widest mb-2">
                <Heart size={10} /> Birthday
              </label>
              <input
                type="date"
                value={birthday}
                onChange={e => setBirthday(e.target.value)}
                className="w-full h-11 rounded-xl border border-cream-300 bg-cream-50 px-4 text-[14px] text-cocoa-900 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-all"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-cocoa-500 uppercase tracking-widest mb-2">
                <User size={10} /> Gender
              </label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: 'male',              label: 'Male' },
                  { value: 'female',            label: 'Female' },
                  { value: 'other',             label: 'Other' },
                  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGender(g => g === opt.value ? '' : opt.value)}
                    className={`rounded-xl border px-4 py-2 text-[12px] font-semibold transition-all ${
                      gender === opt.value
                        ? 'bg-brand-700 border-brand-700 text-white shadow-sm'
                        : 'border-cream-300 text-cocoa-600 bg-white hover:border-cream-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Province */}
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-cocoa-500 uppercase tracking-widest mb-2">
                <MapPin size={10} /> Province
              </label>
              <ProvinceSelector value={location} onChange={setLocation} />
            </div>

            {/* Favourite branch */}
            {branches.length > 0 && (
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-cocoa-500 uppercase tracking-widest mb-2">
                  <Star size={10} /> Favourite Branch
                </label>
                <div className="flex gap-2 flex-wrap">
                  {branches.map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setFavoriteBranchId(id => id === b.id ? '' : b.id)}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-all ${
                        favoriteBranchId === b.id
                          ? 'border-transparent text-white shadow-sm'
                          : 'border-cream-300 text-cocoa-600 bg-white'
                      }`}
                      style={favoriteBranchId === b.id ? { background: b.color_hex } : {}}
                    >
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ background: favoriteBranchId === b.id ? 'rgba(255,255,255,0.6)' : b.color_hex }}
                      />
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* How did you hear */}
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-cocoa-500 uppercase tracking-widest mb-2">
                <Megaphone size={10} /> How did you hear about us?
              </label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: 'social_media', label: 'Social Media' },
                  { value: 'friend',       label: 'Friend'       },
                  { value: 'walk_in',      label: 'Walk-in'      },
                  { value: 'other',        label: 'Other'        },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDiscoveredFrom(d => d === opt.value ? '' : opt.value)}
                    className={`rounded-xl border px-4 py-2 text-[12px] font-semibold transition-all ${
                      discoveredFrom === opt.value
                        ? 'bg-brand-700 border-brand-700 text-white shadow-sm'
                        : 'border-cream-300 text-cocoa-600 bg-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Marketing consent */}
            <button
              type="button"
              onClick={e => { e.preventDefault(); setMarketingConsent(v => !v) }}
              className="flex items-start gap-3 text-left w-full p-4 rounded-xl bg-cream-50 border border-cream-200 active:scale-[0.99] transition-all"
            >
              <div className={`mt-0.5 flex-shrink-0 h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                marketingConsent ? 'bg-brand-700 border-brand-700' : 'bg-white border-cream-300'
              }`}>
                {marketingConsent && <CheckCircle size={11} className="text-white" />}
              </div>
              <span className="text-[13px] text-cocoa-600 leading-snug">
                I agree to receive promotions and special offers from Namwan
              </span>
            </button>

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl bg-brand-50 border border-brand-100 px-4 py-3">
                <AlertTriangle size={14} className="text-brand-500 flex-shrink-0 mt-0.5" />
                <p className="text-[13px] text-brand-700">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={e => { e.preventDefault(); setStep(1); setError(null) }}
                disabled={isPending}
                className="flex-1 h-12 rounded-2xl border border-cream-300 bg-cream-50 text-[13px] font-semibold text-cocoa-700 hover:bg-cream-100 transition-colors disabled:opacity-50"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isPending}
                className="flex-1 h-12 rounded-2xl bg-brand-700 text-[13px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-brand-800 active:scale-[0.98] transition-all shadow-md shadow-brand-900/20"
              >
                {isPending
                  ? <><Loader2 size={15} className="animate-spin" /> Joining…</>
                  : 'Join Namwan →'
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}

// ── Redeem QR overlay ─────────────────────────────────────────────────────────

interface RedeemQR {
  token:      string
  redeemUrl:  string
  expiresAt:  string
  qrSvg:      string
}

function RedeemQRView({
  redeemQR,
  customer,
  onClose,
}: {
  redeemQR: RedeemQR
  customer: Customer
  onClose:  () => void
}) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const diff = new Date(redeemQR.expiresAt).getTime() - Date.now()
    return Math.max(0, Math.floor(diff / 1000))
  })

  useEffect(() => {
    if (secondsLeft <= 0) return
    const id = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(id); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [secondsLeft])

  const mins    = Math.floor(secondsLeft / 60)
  const secs    = secondsLeft % 60
  const expired = secondsLeft === 0

  return (
    <div className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'linear-gradient(160deg, #44100B 0%, #6A1810 40%, #8A2418 100%)' }}>
      <AppHeader />
      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-10 gap-7">

        {/* Instruction */}
        <div className="text-center space-y-1.5">
          <p className="text-[22px] font-bold text-white tracking-tight">Show this to staff</p>
          <p className="text-[13px] text-white/50">They'll scan to confirm your free drink</p>
        </div>

        {/* QR card */}
        <div className="w-full max-w-[300px] rounded-3xl bg-white p-6 shadow-2xl shadow-brand-950/50 space-y-5">
          {/* QR code */}
          <div
            className="w-full aspect-square rounded-2xl overflow-hidden bg-white"
            dangerouslySetInnerHTML={{ __html: redeemQR.qrSvg }}
          />

          {/* Timer */}
          <div className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 ${
            expired
              ? 'bg-brand-50 border border-brand-200'
              : 'bg-sand-100 border border-sand-200'
          }`}>
            <Clock size={13} className={expired ? 'text-brand-500' : 'text-cocoa-500'} />
            <span className={`text-[13px] font-bold tabular-nums ${expired ? 'text-brand-700' : 'text-cocoa-700'}`}>
              {expired
                ? 'QR Expired'
                : `${mins}:${secs.toString().padStart(2, '0')} remaining`
              }
            </span>
          </div>

          {/* Member info */}
          <div className="text-center pb-1">
            <p className="text-[14px] font-bold text-cocoa-900">{customer.name}</p>
            <p className="text-[11px] text-cocoa-400 mt-0.5">Redeem 1 Free Drink · −{POINTS_PER_DRINK} pts</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="rounded-2xl bg-white/10 border border-white/15 px-10 py-3.5 text-[13px] font-semibold text-white/60 active:scale-[0.97] transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Member card view ──────────────────────────────────────────────────────────

function MemberView({
  customer: initialCustomer,
  txs:      initialTxs,
  purchases,
}: {
  customer:  Customer
  txs:       Tx[]
  purchases: Purchase[]
}) {
  const { t } = useLanguage()
  const [tab,      setTab]      = useState<'points' | 'purchases'>('points')
  const [customer, setCustomer] = useState(initialCustomer)
  const [txs,      setTxs]      = useState(initialTxs)

  const [redeemState, setRedeemState] = useState<'idle' | 'pending' | 'error'>('idle')
  const [redeemError, setRedeemError] = useState<string | null>(null)
  const [redeemQR,    setRedeemQR]    = useState<RedeemQR | null>(null)

  const canRedeem = customer.total_points >= POINTS_PER_DRINK

  async function handleRedeem() {
    setRedeemState('pending')
    setRedeemError(null)
    try {
      const res  = await fetch('/api/redeem', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ line_id: customer.line_id }),
      })
      const data = await res.json()

      if (!res.ok) {
        setRedeemState('error')
        setRedeemError(data.error ?? 'Could not create redemption request')
        return
      }

      const qrRes = await fetch(`/api/qr?url=${encodeURIComponent(data.redeem_url)}`)
      const qrSvg = qrRes.ok ? await qrRes.text() : ''

      setRedeemQR({
        token:     data.token,
        redeemUrl: data.redeem_url,
        expiresAt: data.expires_at,
        qrSvg,
      })
      setRedeemState('idle')
    } catch {
      setRedeemState('error')
      setRedeemError('Connection error. Please try again.')
    }
  }

  const progress     = ((customer.total_points % 10) / 10) * 100
  const drinksToFree = Math.max(0, 10 - (customer.total_points % 10))
  const freeDrinks   = Math.floor(customer.total_points / 10)
  const seg          = SEGMENT_INFO[customer.segment] ?? SEGMENT_INFO['active']

  if (redeemQR) {
    return (
      <RedeemQRView
        redeemQR={redeemQR}
        customer={customer}
        onClose={() => setRedeemQR(null)}
      />
    )
  }

  return (
    <Shell>
      <AppHeader />

      {/* ── Hero ── */}
      <div className="px-5 pb-7 space-y-4 flex-shrink-0">

        {/* Profile row */}
        <div className="flex items-center gap-3">
          {customer.picture_url ? (
            <img src={customer.picture_url} alt={customer.name}
              className="h-12 w-12 rounded-full object-cover ring-2 ring-white/25 flex-shrink-0" />
          ) : (
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-[20px] font-bold text-white">
              {customer.name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[18px] font-bold text-white truncate tracking-tight">
              {t.member.greeting(customer.name.split(' ')[0])}
            </p>
            <p className="text-[11px] text-white/40 truncate">{customer.phone}</p>
          </div>
          <span className={`flex-shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${seg.bg} ${seg.color}`}>
            {seg.label}
          </span>
        </div>

        {/* Points card */}
        <div className="rounded-3xl bg-white/10 border border-white/12 p-5 space-y-4"
          style={{ backdropFilter: 'blur(12px)' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.15em] mb-1">
                {t.member.points}
              </p>
              <p className="text-[64px] font-black text-white leading-none tracking-tight">
                {fmt(customer.total_points)}
              </p>
            </div>
            {freeDrinks > 0 && (
              <div className="text-right">
                <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">{t.qrClaim.pointsLabel(freeDrinks)}</p>
                <div className="flex items-center gap-1.5 justify-end">
                  <Sparkles size={16} className="text-sand-300" />
                  <p className="text-[32px] font-black text-sand-300 leading-none">{freeDrinks}</p>
                </div>
              </div>
            )}
          </div>

          {/* Progress to next drink */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-white/50">
              <span>{t.member.nextReward}</span>
              <span className="font-bold text-white/70">{t.member.progressLabel(10 - drinksToFree, 10)}</span>
            </div>
            <div className="h-2 rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #F5C842, #E8A020)',
                }}
              />
            </div>
            <p className="text-[11px] text-white/40">
              {drinksToFree === 0
                ? t.member.redeemHint
                : t.member.notEnoughPoints}
            </p>
          </div>
        </div>

        {/* Redeem button */}
        <div className="space-y-2">
          <button
            onClick={handleRedeem}
            disabled={!canRedeem || redeemState === 'pending'}
            className="w-full h-14 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-all shadow-xl"
            style={canRedeem ? {
              background: 'linear-gradient(135deg, #F5C842, #E8A020)',
              color: '#3D2200',
              boxShadow: '0 8px 24px rgba(232, 160, 32, 0.35)',
            } : {
              background: 'rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            {redeemState === 'pending' ? (
              <><Loader2 size={17} className="animate-spin" /> {t.redeem.scanning}</>
            ) : canRedeem ? (
              <><QrCode size={17} /> {t.member.redeemButton} <span className="opacity-60 text-[13px] font-medium">· 10 pts</span></>
            ) : (
              <>{t.member.notEnoughPoints}</>
            )}
          </button>
          {redeemState === 'error' && redeemError && (
            <p className="text-[12px] text-white/50 text-center">{redeemError}</p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t.member.visitsLabel,       value: fmt(customer.visit_count) },
            { label: t.memberDetail.fields.totalVisits, value: thb(customer.total_spending) },
            { label: t.member.pointsSuffix,      value: fmt(freeDrinks) },
          ].map(s => (
            <div key={s.label} className="rounded-2xl bg-white/8 border border-white/10 px-2 py-3 text-center">
              <p className="text-[9px] text-white/40 uppercase tracking-widest">{s.label}</p>
              <p className="text-[15px] font-bold text-white mt-0.5 truncate">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── History panel ── */}
      <div className="flex-1 bg-cream-100 rounded-t-[28px] overflow-hidden flex flex-col min-h-0">
        {/* Tabs */}
        <div className="flex border-b border-cream-200 bg-white flex-shrink-0">
          {([
            { id: 'points',    label: 'Points History', icon: Star        },
            { id: 'purchases', label: 'Purchases',      icon: ShoppingBag },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-4 text-[13px] font-semibold border-b-2 transition-all ${
                tab === t.id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-cocoa-400 hover:text-cocoa-700'
              }`}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
          {tab === 'points' && (
            txs.length === 0
              ? <EmptyState icon={Star} message="No points history yet" />
              : txs.map(tx => {
                  const style = TX_STYLE[tx.type] ?? TX_STYLE['adjust']
                  return (
                    <div key={tx.id} className="flex items-center gap-3 rounded-2xl bg-white border border-cream-200 px-4 py-3.5">
                      <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${style.bg} ${style.color}`}>
                        {style.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-cocoa-800 truncate font-medium">{tx.note ?? '—'}</p>
                        <p className="text-[11px] text-cocoa-400 mt-0.5">
                          {new Date(tx.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                          {tx.branches && ` · ${tx.branches.name.split(' ')[0]}`}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-[14px] font-bold ${tx.points > 0 ? 'text-emerald-700' : 'text-brand-600'}`}>
                          {tx.points > 0 ? '+' : ''}{tx.points}
                        </p>
                        <p className="text-[10px] text-cocoa-400">{fmt(tx.balance_after)} bal</p>
                      </div>
                    </div>
                  )
                })
          )}

          {tab === 'purchases' && (
            purchases.length === 0
              ? <EmptyState icon={ShoppingBag} message="No purchases yet" />
              : purchases.map(p => {
                  const items = p.purchase_items ?? []
                  return (
                    <div key={p.id} className="rounded-2xl bg-white border border-cream-200 px-4 py-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {p.branches && (
                              <span className="rounded-lg px-2 py-0.5 text-[10px] font-bold text-white flex-shrink-0"
                                style={{ background: p.branches.color_hex }}>
                                {p.branches.name.split(' ')[0]}
                              </span>
                            )}
                            <span className="text-[11px] text-cocoa-400">
                              {new Date(p.purchased_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          {items.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {items.map((item, i) => (
                                <span key={i} className="rounded-lg bg-cream-100 border border-cream-200 px-2 py-0.5 text-[11px] text-cocoa-600">
                                  {item.name} ×{item.quantity}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[14px] font-bold text-cocoa-900">{thb(Number(p.total_amount))}</p>
                          <p className="text-[11px] text-emerald-600 font-semibold">+{p.points_earned ?? 0} pts</p>
                        </div>
                      </div>
                    </div>
                  )
                })
          )}
        </div>
      </div>
    </Shell>
  )
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cream-200">
        <Icon size={24} className="text-cream-500" />
      </div>
      <p className="text-[13px] text-cocoa-400">{message}</p>
    </div>
  )
}

// ── App state machine ─────────────────────────────────────────────────────────

type AppPhase =
  | { phase: 'loading' }
  | { phase: 'not_logged_in' }
  | { phase: 'fetching_customer'; profile: LiffProfile }
  | { phase: 'needs_registration'; profile: LiffProfile }
  | { phase: 'member'; customer: Customer; txs: Tx[]; purchases: Purchase[] }
  | { phase: 'error'; message: string; retry?: () => void }

// ── Root ──────────────────────────────────────────────────────────────────────

export default function MemberPage() {
  const liff = useLiff()
  const { t } = useLanguage()
  const [app, setApp] = useState<AppPhase>({ phase: 'loading' })

  const fetchMemberRef = useRef<((p: LiffProfile) => void) | null>(null)

  async function fetchMember(profile: LiffProfile) {
    try {
      const res  = await fetch('/api/liff/me', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          line_id:      profile.userId,
          display_name: profile.displayName,
          picture_url:  profile.pictureUrl,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setApp({ phase: 'error', message: data.error ?? 'Failed to load account' })
        return
      }

      if (!data.found) {
        setApp({ phase: 'needs_registration', profile })
        return
      }

      setApp({
        phase:     'member',
        customer:  data.customer,
        txs:       data.txs       ?? [],
        purchases: data.purchases ?? [],
      })
    } catch {
      setApp({
        phase:   'error',
        message: 'Connection error. Please try again.',
        retry:   () => fetchMember(profile),
      })
    }
  }

  fetchMemberRef.current = fetchMember

  useEffect(() => {
    if (liff.status === 'loading' || liff.status === 'unavailable') {
      setApp({ phase: 'loading' })
      return
    }
    if (liff.status === 'error') {
      setApp({ phase: 'error', message: liff.error ?? 'LIFF error' })
      return
    }
    if (liff.status === 'not_logged_in') {
      setApp({ phase: 'not_logged_in' })
      return
    }
    if (liff.status === 'ready' && liff.profile) {
      setApp({ phase: 'fetching_customer', profile: liff.profile })
      fetchMemberRef.current?.(liff.profile)
    }
  }, [liff.status, liff.error, liff.profile])

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID

  switch (app.phase) {
    case 'loading':
    case 'fetching_customer':
      return <SkeletonView />

    case 'not_logged_in':
      return (
        <OpenInLineView
          onOpenInLine={() => {
            if (liffId) window.location.href = `https://liff.line.me/${liffId}`
          }}
          onBrowserLogin={liff.login}
        />
      )

    case 'needs_registration':
      return (
        <RegisterView
          profile={app.profile}
          onLinked={customer =>
            setApp({ phase: 'member', customer, txs: [], purchases: [] })
          }
        />
      )

    case 'error':
      return <ErrorView message={app.message} onRetry={app.retry} />

    case 'member':
      return <MemberView customer={app.customer} txs={app.txs} purchases={app.purchases} />
  }
}
