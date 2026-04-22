import { useState, useEffect } from 'react'
import AuthPage from './components/AuthPage'
import Calendar from './components/Calendar'
import LandingPage from './components/LandingPage'
import NavBar from './components/NavBar'

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('landing');
  const [visibleFriends, setVisibleFriends] = useState([]);

  // check localStorage on load so we stay logged in after a refresh.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const savedId = localStorage.getItem('id');
      const savedUsername = localStorage.getItem('username');
      const savedTimezone = localStorage.getItem('timezone') || 'UTC';
      setUser({
        id: savedId ? Number(savedId) : null,
        username: savedUsername || 'User',
        timezone: savedTimezone,
      });
      setPage('calendar');
    }
  }, []);

  // clear out stored credentials on logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('id');
    localStorage.removeItem('username');
    localStorage.removeItem('timezone');
    setUser(null);
    setPage('landing');
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar
        user={user}
        onLogout={handleLogout}
        onLoginClick={() => setPage('login')}
        onLogoClick={() => setPage('landing')}
        visibleFriends={visibleFriends}
        onVisibleFriendsChange={setVisibleFriends}
      />
      {page === 'landing' && (
        <LandingPage onGetStarted={() => setPage('calendar')} />
      )}
      {page === 'login' && !user && (
        <div className="px-6 py-6">
          <AuthPage onAuth={(data) => {
            // server returns token + user fields + tz
            const tz = data.timezone || 'UTC';
            setUser({ id: data.id, username: data.username, timezone: tz });
            localStorage.setItem('token', data.token);
            if (data.id != null) localStorage.setItem('id', String(data.id));
            if (data.username) localStorage.setItem('username', data.username);
            localStorage.setItem('timezone', tz);
            setPage('calendar');
          }} />
        </div>
      )}
      {page === 'calendar' && (
        <div className="px-6 py-6">
          <Calendar visibleFriends={visibleFriends} user={user} />
        </div>
      )}
    </div>
  )
}

export default App;
