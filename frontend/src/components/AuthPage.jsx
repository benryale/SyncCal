import { useEffect, useState } from 'react'
import { CalendarSync, Eye, EyeOff, CheckCircle, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function AuthPage({ onAuth, initialMode = 'login' }) {
  const [mode, setMode]                       = useState(initialMode)
  const [username, setUsername]               = useState('')
  const [email, setEmail]                     = useState('')
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError]                     = useState('')
  const [loading, setLoading]                 = useState(false)
  const [showPassword, setShowPassword]       = useState(false)
  const [showConfirm, setShowConfirm]         = useState(false)
  const [registered, setRegistered]           = useState(false)

  useEffect(() => {
    setMode(initialMode)
    setError('')
    setRegistered(false)
  }, [initialMode])

  // auto-switch to login 2.5 seconds after successful registration
  useEffect(() => {
    if (!registered) return
    const t = setTimeout(() => {
      setRegistered(false)
      setMode('login')
      setPassword('')
      setConfirmPassword('')
      setEmail('')
      setError('')
    }, 2500)
    return () => clearTimeout(t)
  }, [registered])

  const switchMode = (next) => {
    setMode(next)
    setError('')
    setUsername('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirm(false)
    setRegistered(false)
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (mode === 'register' && password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const detectedTz = (() => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone }
      catch { return undefined }
    })()

    const url  = mode === 'login' ? '/api/auth/login/' : '/api/auth/register/'
    const body = mode === 'login'
      ? { username, password }
      : { username, email, password, timezone: detectedTz }

    try {
      const res  = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      let data
      try {
        data = await res.json()
      } catch {
        setError('Server returned an unexpected response. Make sure the backend is running.')
        return
      }

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
      } else if (mode === 'register') {
        setRegistered(true)
      } else {
        onAuth(data)
      }
    } catch (err) {
      // fetch() itself throws only on network-level failure (server not running)
      setError('Cannot reach the server. Make sure the backend is running on port 8000.')
    } finally {
      setLoading(false)
    }
  }

  // ── success banner ───────────────────────────────────────────────────── //
  if (registered) {
    return (
      <div className="mx-auto mt-20 max-w-sm">
        <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
            <CheckCircle className="size-6 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-lg font-semibold text-green-800 dark:text-green-300">
            Account created successfully!
          </h2>
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            Taking you to sign in…
          </p>
          {/* progress bar */}
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-green-200 dark:bg-green-800">
            <div
              className="h-full rounded-full bg-green-500"
              style={{ animation: 'growWidth 2.5s linear forwards' }}
            />
          </div>
        </div>
        <style>{`
          @keyframes growWidth {
            from { width: 0%; }
            to   { width: 100%; }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="mx-auto mt-20 max-w-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
          <CalendarSync className="size-5 text-[#1a2744] dark:text-slate-100" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === 'login' ? 'Pick up where you left off' : 'Set up your account in just a few seconds'}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <form onSubmit={submit}>
          <div className="flex flex-col gap-4">

            <div className="grid gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Enter your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            {mode === 'register' && (
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div className="grid gap-1.5">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {confirmPassword && (
                  <p className={`text-xs ${password === confirmPassword ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? <><LoaderCircle className="size-4 animate-spin mr-2" />{mode === 'login' ? 'Signing in…' : 'Creating account…'}</>
                : mode === 'login' ? 'Sign in' : 'Create account'
              }
            </Button>
          </div>
        </form>
      </div>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        {mode === 'login'
          ? <span>No account?{' '}
              <button className="font-medium text-foreground hover:underline cursor-pointer" onClick={() => switchMode('register')}>
                Register
              </button>
            </span>
          : <span>Have an account?{' '}
              <button className="font-medium text-foreground hover:underline cursor-pointer" onClick={() => switchMode('login')}>
                Sign in
              </button>
            </span>
        }
      </p>
    </div>
  )
}

export default AuthPage
