import { useState, useEffect } from 'react'
import AuthPage from './components/AuthPage'
import Calendar from './components/Calendar'
import LandingPage from './components/LandingPage'
import NavBar from './components/NavBar'
import { Toaster } from './components/ui/sonner'

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('landing');
  // remembers whether the user clicked Log in or Sign Up so the auth page opens in the right mode
  const [authMode, setAuthMode] = useState('login');
  const [visibleFriends, setVisibleFriends] = useState([]);

  // check localStorage on load so we stay logged in after a refresh
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUsername = localStorage.getItem('username');
    if (token) {
      setUser({ username: savedUsername || 'User' });
      setPage('calendar');
    }
  }, []);

  // clear out stored credentials on logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUser(null);
    setPage('landing');
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar
        user={user}
        onLogout={handleLogout}
        onLoginClick={() => { setAuthMode('login'); setPage('login'); }}
        onSignUpClick={() => { setAuthMode('register'); setPage('login'); }}
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
              setUser(data);
              if (data.username) localStorage.setItem('username', data.username);
              setPage('calendar');
            }}
          />
        </div>
      )}
      {page === 'calendar' && (
        <div className="px-6 py-6">
          <Calendar visibleFriends={visibleFriends} />
        </div>
      )}
      {/* global toast container for snackbar-style notifications */}
      <Toaster position="bottom-right" />
    </div>
  )
}

export default App;
