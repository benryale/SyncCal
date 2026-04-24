/**
 * App.jsx — wraps the app in WebSocketProvider so every component
 * can subscribe to real-time messages via useWebSocket().
 * The WebSocket connection opens after login and reconnects on logout/login.
 */
import { useState, useEffect } from 'react'
import AuthPage from './components/AuthPage'
import Calendar from './components/Calendar'
import LandingPage from './components/LandingPage'
import NavBar from './components/NavBar'
import { Toaster } from './components/ui/sonner'
import { WebSocketProvider } from './context/WebSocketContext'

function App() {
  const [user, setUser]                     = useState(null)
  const [page, setPage]                     = useState('landing')
  const [authMode, setAuthMode]             = useState('login')
  const [visibleFriends, setVisibleFriends] = useState([])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      setUser({
        id:       Number(localStorage.getItem('id')) || null,
        username: localStorage.getItem('username') || 'User',
        timezone: localStorage.getItem('timezone') || 'UTC',
      })
      setPage('calendar')
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('id')
    localStorage.removeItem('username')
    localStorage.removeItem('timezone')
    setUser(null)
    setPage('landing')
  }

  return (
    // WebSocketProvider wraps everything so NavBar + Calendar + FriendList
    // all share ONE WebSocket connection.
    <WebSocketProvider>
      <div className="min-h-screen bg-background">
        <NavBar
          user={user}
          onLogout={handleLogout}
          onLoginClick={() => { setAuthMode('login'); setPage('login') }}
          onSignUpClick={() => { setAuthMode('register'); setPage('login') }}
          onLogoClick={() => setPage('landing')}
          visibleFriends={visibleFriends}
          onVisibleFriendsChange={setVisibleFriends}
        />

        {page === 'landing' && (
          <LandingPage onGetStarted={() => setPage('calendar')} />
        )}

        {page === 'login' && !user && (
          <div className="px-6 py-6">
            <AuthPage
              initialMode={authMode}
              onAuth={(data) => {
                const tz = data.timezone || 'UTC'
                setUser({ id: data.id, username: data.username, timezone: tz })
                localStorage.setItem('token', data.token)
                if (data.id != null) localStorage.setItem('id', String(data.id))
                if (data.username) localStorage.setItem('username', data.username)
                localStorage.setItem('timezone', tz)
                setPage('calendar')
              }}
            />
          </div>
        )}

        {page === 'calendar' && (
          <div className="px-6 py-6">
            <Calendar visibleFriends={visibleFriends} user={user} />
          </div>
        )}

        <Toaster position="bottom-right" />
      </div>
    </WebSocketProvider>
  )
}

export default App
