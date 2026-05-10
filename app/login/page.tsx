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
      <div className="hidden lg:flex lg:w-5/12 flex-col justify-between bg-gradient-to-br from-brand-700 to-brand-900 p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
              <path d="M3.5 18.5L7 14l4 2-1.5 4H3.5zm17-13L17 9.5l-2-4 1.5-4.5 4 4.5zM12 13l-5-2.5 7.5-7.5L17 8 12 13z"/>
            </svg>
          </div>
          <div>
            <p className="font-bold text-lg leading-none">Namwan CRM</p>
            <p className="text-[11px] text-brand-200">Customer Management Platform</p>
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Bakery &<br/>Brunch CRM
          </h1>
          <p className="text-brand-200 text-sm leading-relaxed mb-8">
            Manage multiple branches, track customer loyalty points, analyse purchase
            history and grow repeat business — all in one premium dashboard.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['3',      'Branches'],
              ['25 THB', '= 1 Point'],
              ['4',      'Segments'],
              ['∞',      'Shared Points'],
            ].map(([v, l]) => (
              <div key={l} className="rounded-xl bg-white/10 p-4">
                <p className="text-2xl font-bold">{v}</p>
                <p className="text-xs text-brand-200 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-brand-300">© 2025 Namwan · All rights reserved</p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 items-center justify-center bg-[#f8f7f5] p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 shadow-md lg:hidden">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
              <path d="M3.5 18.5L7 14l4 2-1.5 4H3.5zm17-13L17 9.5l-2-4 1.5-4.5 4 4.5zM12 13l-5-2.5 7.5-7.5L17 8 12 13z"/>
            </svg>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="mt-1 text-sm text-gray-500">Sign in to your staff account</p>
          </div>

          <LoginForm error={error} />

          <p className="mt-6 text-center text-xs text-gray-400">
            Contact your administrator for access.
          </p>
        </div>
      </div>

    </div>
  )
}
