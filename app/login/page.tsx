import LoginForm from '@/components/auth/LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const error  = params.error ?? null

  return (
    <div className="flex min-h-screen">

      {/* ── Left brand panel ── */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-[46%] flex-col justify-between bg-brand-800 p-12 relative overflow-hidden">

        {/* Subtle texture overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />

        {/* Top warm gradient blob */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-brand-900/50 blur-3xl" />

        <div className="relative">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                <path d="M3.5 18.5L7 14l4 2-1.5 4H3.5zm17-13L17 9.5l-2-4 1.5-4.5 4 4.5zM12 13l-5-2.5 7.5-7.5L17 8 12 13z"/>
              </svg>
            </div>
            <div>
              <p className="font-bold text-[15px] text-white leading-none">Namwan</p>
              <p className="text-[11px] text-white/50 mt-0.5">Loyalty Platform</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-5">
            Staff Portal
          </p>
          <h1 className="text-[42px] font-bold text-white leading-[1.1] tracking-tight mb-5">
            Crafted for<br/>
            <span className="text-white/60">every cup.</span>
          </h1>
          <p className="text-white/50 text-[14px] leading-relaxed mb-10 max-w-xs">
            Manage your loyalty programme, track member visits, and grow repeat business — all from one warm place.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['1 drink', '= 1 point'],
              ['10 points', '= free drink'],
              ['All branches', 'shared points'],
              ['Real-time', 'QR claims'],
            ].map(([v, l]) => (
              <div key={l} className="rounded-xl bg-white/8 border border-white/10 p-4">
                <p className="text-[15px] font-bold text-white">{v}</p>
                <p className="text-[11px] text-white/40 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] text-white/25">© 2025 Namwan · All rights reserved</p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 items-center justify-center bg-cream-100 p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="mb-8 lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-700 shadow-lg shadow-brand-900/30 mb-5">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                <path d="M3.5 18.5L7 14l4 2-1.5 4H3.5zm17-13L17 9.5l-2-4 1.5-4.5 4 4.5zM12 13l-5-2.5 7.5-7.5L17 8 12 13z"/>
              </svg>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-cocoa-400 mb-1">Namwan Loyalty</p>
          </div>

          <div className="mb-9">
            <h2 className="text-[26px] font-bold text-cocoa-900 tracking-tight">Welcome back</h2>
            <p className="mt-1.5 text-[13px] text-cocoa-500">Sign in to your staff account</p>
          </div>

          <LoginForm error={error} />

          <p className="mt-8 text-center text-[12px] text-cocoa-400">
            Need access? Contact your administrator.
          </p>
        </div>
      </div>

    </div>
  )
}
