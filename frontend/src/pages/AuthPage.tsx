import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { FieldError, Logo, SeatStrip, Sep, SkillChips } from '../components/ui'
import { useAuth } from '../lib/auth'

// A public demo shows its demo account on the sign-in page (set both on the host; unset hides the card).
const DEMO_EMAIL = (import.meta.env.VITE_DEMO_EMAIL as string | undefined)?.trim()
const DEMO_PASSWORD = (import.meta.env.VITE_DEMO_PASSWORD as string | undefined)?.trim()

/** Sign in and sign up share one screen: what CampusConnect is on the left, the form on the right. */
export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, login, register } = useAuth()
  const location = useLocation()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    void run(() => (mode === 'login' ? login(email, password) : register(fullName, email, password)))
  }

  function tryDemo() {
    setEmail(DEMO_EMAIL!)
    setPassword(DEMO_PASSWORD!)
    void run(() => login(DEMO_EMAIL!, DEMO_PASSWORD!))
  }

  const isLogin = mode === 'login'
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <section className="flex flex-col justify-between gap-12 bg-ground px-6 py-8 sm:px-12 lg:py-12">
        <Logo />
        <div className="max-w-[560px]">
          <h1 className="font-serif text-[44px] leading-[1.02] tracking-[-0.02em] sm:text-[60px]">
            Find the people to build it with.
          </h1>
          <p className="mt-6 max-w-[460px] text-[17px] leading-7">
            CampusConnect matches students by skill, gives every project team a chat and a task board, and keeps
            what your campus learns in one searchable hub.
          </p>
        </div>
        {/* A real piece of the product: a project as it appears in the list, with its open seats. */}
        <div data-ui className="max-w-[560px] rounded-[22px] border border-line bg-raised p-5" aria-label="Example project listing">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold">Bike-share dock tracker</p>
            <span className="pill pill-positive">Recruiting</span>
          </div>
          <p className="mt-1 text-muted">Hardware/IoT
            <Sep />
            started by a second-year in Electronics</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <SeatStrip
              members={[
                { id: 11, name: 'Anbu' },
                { id: 23, name: 'Kumaran' },
              ]}
              max={4}
            />
            <SkillChips skills={['esp32', 'react', 'postgres']} have={new Set(['react'])} />
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center border-line bg-surface px-6 py-12 lg:border-l">
        <form onSubmit={submit} className="w-full max-w-[380px]" noValidate>
          <h2 className="text-2xl font-semibold">{isLogin ? 'Sign in' : 'Create your account'}</h2>
          <p className="mt-1 text-muted">
            {isLogin ? 'New here? ' : 'Already have an account? '}
            <Link to={isLogin ? '/register' : '/login'} className="btn-text">
              {isLogin ? 'Create an account' : 'Sign in'}
            </Link>
          </p>

          <div className="mt-8 flex flex-col gap-4">
            {!isLogin && (
              <div>
                <label className="field-label" htmlFor="fullName">
                  Full name
                </label>
                <input id="fullName" className="field" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
            )}
            <div>
              <label className="field-label" htmlFor="email">
                University email
              </label>
              <input id="email" type="email" className="field" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="field"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
                minLength={isLogin ? undefined : 8}
                aria-describedby={isLogin ? undefined : 'password-rule'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {!isLogin && (
                <p id="password-rule" className="mt-1.5 text-[13px] text-muted">
                  At least 8 characters.
                </p>
              )}
            </div>
          </div>
          <FieldError error={error} />
          <button type="submit" className="btn btn-primary mt-6 w-full" disabled={busy}>
            {busy ? 'One moment…' : isLogin ? 'Sign in' : 'Create account'}
          </button>

          {isLogin && DEMO_EMAIL && DEMO_PASSWORD && (
            <div className="mt-8 rounded-2xl border border-line bg-raised p-4">
              <p className="font-medium">Just looking around?</p>
              <p className="mt-1 text-[13px] text-muted">Sign in as a demo student with a team, tasks and requests to answer.</p>
              <button type="button" className="btn btn-secondary mt-3 w-full" disabled={busy} onClick={tryDemo}>
                Try the demo
              </button>
              <p className="mt-2.5 text-[13px] text-muted">
                {DEMO_EMAIL}
                <Sep />
                {DEMO_PASSWORD}
              </p>
            </div>
          )}
        </form>
      </section>
    </div>
  )
}
