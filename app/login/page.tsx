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
      <div className="hidden lg:flex lg:w-5/12 xl:w-[46%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: '#FF2B00' }}>

        {/* Subtle dot texture */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '28px 28px',
          }}
        />

        {/* Warm glow blobs */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full blur-3xl" style={{ background: 'rgba(0,0,0,0.12)' }} />

        <div className="relative">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 overflow-hidden">
              <img
                src="/logo/namwan-logo.png"
                alt="Namwan"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="font-bold text-[16px] text-white leading-none">Namwan Loyalty</p>
              <p className="text-[11px] text-white/55 mt-0.5">Staff Portal</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <h1 className="text-[44px] font-bold text-white leading-[1.05] tracking-tight mb-5">
            Crafted for<br/>
            <span className="text-white/60">every cup.</span>
          </h1>
          <p className="text-white/55 text-[14px] leading-relaxed mb-10 max-w-xs">
            Manage your loyalty programme, track member visits, and grow repeat business — all from one warm place.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['1 drink', '= 1 point'],
              ['10 points', '= free drink'],
              ['All branches', 'shared points'],
              ['Real-time', 'QR claims'],
            ].map(([v, l]) => (
              <div key={l} className="rounded-2xl bg-white/12 border border-white/15 p-4">
                <p className="text-[15px] font-bold text-white">{v}</p>
                <p className="text-[11px] text-white/45 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] text-white/30">© 2025 Namwan · All rights reserved</p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 items-center justify-center bg-cream-100 p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="mb-8 lg:hidden flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl overflow-hidden shadow-xl mb-5"
              style={{ background: '#FF2B00' }}>
              <img
                src="/logo/namwan-logo.png"
                alt="Namwan"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-cocoa-400">Namwan Loyalty</p>
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
