import { useState } from 'react'
import { CalendarSync } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')

    let url
    let body

    if (mode === 'login') {
      url = '/api/auth/login/'
      body = { username, password }
    } else {
      // send browser tz if we can detect it; backend falls back to UTC
      const detectedTz = (() => {
        try {
          return Intl.DateTimeFormat().resolvedOptions().timeZone
        } catch {
          return undefined
        }
      })()
      url = '/api/auth/register/'
      body = { username, email, password, timezone: detectedTz }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
    } else {
      // App.jsx handles localStorage
      onAuth(data)
    }
  }

  return (
    <div className="mx-auto mt-20 max-w-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
          <CalendarSync className="size-5 text-[#1a2744]" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === 'login' ? 'Pick up where you left off' : 'Set up your account in just a few seconds'}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-white p-6">
        <form onSubmit={submit}>
          <div className="flex flex-col gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Enter your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
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
                />
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full">
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </div>
        </form>
      </div>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        {mode === 'login'
          ? <span>No account? <button className="text-foreground hover:underline font-medium cursor-pointer" onClick={() => setMode('register')}>Register</button></span>
          : <span>Have an account? <button className="text-foreground hover:underline font-medium cursor-pointer" onClick={() => setMode('login')}>Sign in</button></span>
        }
      </p>
    </div>
  )
}

export default AuthPage
