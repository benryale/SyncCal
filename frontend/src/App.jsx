import { useState } from 'react'
import AuthPage from './components/AuthPage'
import Calendar from './components/Calendar'
import NavBar from './components/NavBar'

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('calendar');

  return (
    <div className="min-h-screen bg-background">
      <NavBar user={user} onLogout={() => { setUser(null); setPage('calendar') }} onLoginClick={() => setPage('login')} />
      <div className="px-6 py-6">
        {page === 'login' && !user && (
          <AuthPage onAuth={(data) => { setUser(data); setPage('calendar') }} />
        )}
        {page === 'calendar' && <Calendar />}
      </div>
    </div>
  )
}

export default App;
