import { useState, useEffect } from 'react'
import { Box } from '@chakra-ui/react'
import AuthPage from './components/AuthPage'
import Calendar from './components/Calendar'
import NavBar from './components/NavBar'

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('calendar');
  const [visibleFriends, setVisibleFriends] = useState([]);
  // Check memory the moment the app loads to see if we have a logged in user (e.g. after refresh)
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUsername = localStorage.getItem('username');
    if (token) {
      setUser({ username: savedUsername || 'User' });
      setPage('calendar');
    }
  }, []);

  //properly handle logout now 
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUser(null);
    setPage('calendar');
  }
  return (
    <Box minH="100vh" bg="gray.50">
      <NavBar 
        user={user} 
        onLogout={handleLogout} 
        onLoginClick={() => setPage('login')}
        visibleFriends={visibleFriends}
        onVisibleFriendsChange={setVisibleFriends}
      />
      <Box p="6">
        {page === 'login' && !user && (
          <AuthPage onAuth={(data) => { 
            setUser(data); 
            // save the username to memory so the NavBar can remember it on refresh!
            if (data.username) localStorage.setItem('username', data.username);
            setPage('calendar'); 
          }} />
        )}
        {page === 'calendar' && <Calendar visibleFriends={visibleFriends} />}
      </Box>
    </Box>
  )
}

export default App;