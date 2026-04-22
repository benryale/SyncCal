import { useState } from 'react'
import { CalendarSync } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import './AuthPage.css'

// Authentication screen used for both login and registration.
// Parent provides `onAuth(data)` to store user/app state after success.
function AuthPage({ onAuth }) {
  // `mode` controls which form variant to show.
  const [mode, setMode] = useState('login')

  // Form field state.
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Server/client error message shown under inputs.
  const [error, setError] = useState('')

  // boolean for conditional UI and API payload selection.
  const isLogin = mode === 'login'

  // Handles submit for both login and registration.
  // Chooses endpoint/body by current mode, then forwards success data via `onAuth`.
  const submit = async (e) => {
    e.preventDefault()
    setError('')

    // Use one handler for both routes.
    const url = isLogin ? '/api/auth/login/' : '/api/auth/register/'
    const body = isLogin ? { username, password } : { username, email, password }

    // Send JSON credentials to backend auth endpoints.
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })

    // Backend returns either `{ error }` or auth payload (`token`, user data).
    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
    } else {
      // Persist token locally so subsequent API requests can authenticate.
      localStorage.setItem('token', data.token)
      onAuth(data)
    }
  }

  return (
    <div className="auth-container">
      <Header isLogin={isLogin} />

      <div className="auth-card">
        <form onSubmit={submit}>
          <div className="auth-fields">
            <div className="auth-field">
              <Label htmlFor="username">Username</Label>
              <Input id="username" placeholder="Enter your username" value={username} onChange={e => setUsername(e.target.value)} />
            </div>

            {!isLogin && (
              <div className="auth-field">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            )}

            <div className="auth-field">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
            </div>

            {error && <p className="auth-error">{error}</p>}

            <Button type="submit" className="auth-submit">
              {isLogin ? 'Sign in' : 'Create account'}
            </Button>
          </div>
        </form>
      </div>

      <Footer isLogin={isLogin} onSwitch={() => setMode(isLogin ? 'register' : 'login')} />
    </div>
  )
}

// Top logo + heading copy for login/register mode.
function Header({ isLogin }) {
  return (
    <div className="auth-header">
      <div className="auth-logo">
        <CalendarSync className="auth-logo-icon" />
      </div>
      <h2 className="auth-title">
        {isLogin ? 'Welcome back' : 'Create your account'}
      </h2>
      <p className="auth-subtitle">
        {isLogin ? 'Pick up where you left off' : 'Set up your account in just a few seconds'}
      </p>
    </div>
  )
}

// Bottom switcher that toggles between login and register modes.
function Footer({ isLogin, onSwitch }) {
  return (
    <p className="auth-footer">
      {isLogin ? 'No account? ' : 'Have an account? '}
      <button type="button" className="auth-switch-btn" onClick={onSwitch}>
        {isLogin ? 'Register' : 'Sign in'}
      </button>
    </p>
  )
}

export default AuthPage
