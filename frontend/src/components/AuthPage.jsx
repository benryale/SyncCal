import { useState } from 'react'

function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')

    const url = mode === 'login'
      ? '/api/auth/login/'
      : '/api/auth/register/'

    const body = mode === 'login'
      ? { username, password }
      : { username, email, password }

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
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px' }}>
      <h2>{mode === 'login' ? 'Login' : 'Register'}</h2>

      <form onSubmit={submit}>
        <div>
          <input
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
        </div>

        {mode === 'register' && (
          <div>
            <input
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
        )}

        <div>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <button type="submit">
          {mode === 'login' ? 'Login' : 'Register'}
        </button>
      </form>

      <p>
        {mode === 'login'
          ? <span>No account? <a href="#" onClick={() => setMode('register')}>Register</a></span>
          : <span>Have an account? <a href="#" onClick={() => setMode('login')}>Login</a></span>
        }
      </p>
    </div>
  )
}

export default AuthPage