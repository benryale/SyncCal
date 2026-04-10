import { useState } from 'react'
import AuthPage from './components/AuthPage'
import Calendar from './components/Calendar'
import LandingPage from './components/LandingPage'
import NavBar from './components/NavBar'

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('landing');

  return (
    <div className="min-h-screen bg-background">
      <NavBar
        user={user}
        onLogout={() => { setUser(null); setPage('landing') }}
        onLoginClick={() => setPage('login')}
        onLogoClick={() => setPage('landing')}
      />
      {page === 'landing' && (
        <LandingPage onGetStarted={() => setPage('calendar')} />
      )}
      {page === 'login' && !user && (
        <div className="px-6 py-6">
          <AuthPage onAuth={(data) => { setUser(data); setPage('calendar') }} />
        </div>
      )}
      {page === 'calendar' && <div className="px-6 py-6"><Calendar /></div>}
    </div>
  )
}

export default App;
