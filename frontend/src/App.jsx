import { useState } from 'react'
import { Box } from '@chakra-ui/react'
import AuthPage from './components/AuthPage'
import Calendar from './components/Calendar'
import NavBar from './components/NavBar'

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('calendar');

  return (
    <Box minH="100vh" bg="gray.50">
      <NavBar user={user} onLogout={() => { setUser(null); setPage('calendar') }} onLoginClick={() => setPage('login')}
/>
      <Box p="6">
        {page === 'login' && !user && (
          <AuthPage onAuth={(data) => { setUser(data); setPage('calendar') }} />
        )}
        {page === 'calendar' && <Calendar />}
      </Box>
    </Box>
  )
}

export default App;