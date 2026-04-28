import { useState, useEffect } from 'react'
import AuthPage from './components/AuthPage'
import Calendar from './components/Calendar'
import LandingPage from './components/LandingPage'
import ProfilePage from './components/ProfilePage'
import NavBar from './components/NavBar'
import { Toaster } from './components/ui/sonner'
import { WebSocketProvider } from './context/WebSocketContext'
import { toast } from 'sonner'

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

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser)
    if (updatedUser.timezone) localStorage.setItem('timezone', updatedUser.timezone)
  }

  const handleAuth = (data, isNewAccount = false) => {
    const tz = data.timezone || 'UTC'
    setUser({ id: data.id, username: data.username, timezone: tz })
    localStorage.setItem('token', data.token)
    if (data.id != null) localStorage.setItem('id', String(data.id))
    if (data.username) localStorage.setItem('username', data.username)
    localStorage.setItem('timezone', tz)

    if (isNewAccount) {
      // Clear the per-user onboarding flag so new users always see the tour
      localStorage.removeItem(`synccal_onboarded_${data.id}`)
      toast.success(`Welcome to SyncCal, ${data.username}! 🎉`)
    }

    setPage('calendar')
  }

  return (
    <WebSocketProvider>
      <div className="min-h-screen bg-background">
        <NavBar
          user={user}
          onLogout={handleLogout}
          onLoginClick={() => { setAuthMode('login'); setPage('login') }}
          onSignUpClick={() => { setAuthMode('register'); setPage('login') }}
          onLogoClick={() => setPage(user ? 'calendar' : 'landing')}
          onProfileClick={() => setPage('profile')}
          visibleFriends={visibleFriends}
          onVisibleFriendsChange={setVisibleFriends}
        />

        {page === 'landing' && (
          <LandingPage onGetStarted={() => user ? setPage('calendar') : setPage('login')} />
        )}

        {page === 'login' && !user && (
          <div className="px-6 py-6">
            <AuthPage
              initialMode={authMode}
              onAuth={(data) => handleAuth(data, authMode === 'register')}
            />
          </div>
        )}

        {page === 'calendar' && user && (
          <div className="px-6 py-6">
            <Calendar visibleFriends={visibleFriends} user={user} />
          </div>
        )}

        {page === 'profile' && user && (
          <ProfilePage user={user} onUserUpdate={handleUserUpdate} />
        )}

        <Toaster position="bottom-right" />
      </div>
    </WebSocketProvider>
  )
}

export default App
