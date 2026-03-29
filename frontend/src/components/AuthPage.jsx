import { useState } from 'react'
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
      url = '/api/auth/register/'
      body = { username, email, password }
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
      onAuth(data)
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm rounded-lg border border-border p-8">
      <h2 className="text-xl font-semibold text-foreground mb-6">
        {mode === 'login' ? 'Login' : 'Register'}
      </h2>

      <form onSubmit={submit}>
        <div className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>

          {mode === 'register' && (
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                placeholder="Email"
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
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full">
            {mode === 'login' ? 'Login' : 'Register'}
          </Button>
        </div>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        {mode === 'login'
          ? <span>No account? <button className="text-foreground hover:underline font-medium" onClick={() => setMode('register')}>Register</button></span>
          : <span>Have an account? <button className="text-foreground hover:underline font-medium" onClick={() => setMode('login')}>Login</button></span>
        }
      </p>
    </div>
  )
}

export default AuthPage
