import { useState } from 'react';
import AuthPage from './components/AuthPage';
import Calendar from './components/Calendar';

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('calendar');

  return (
    <div style={{ padding: '20px' }}>
      <h1>SyncCal</h1>
      <nav style={{ marginBottom: '20px' }}>
        <button onClick={() => setPage('calendar')} style={{ marginRight: '10px' }}>Calendar</button>
        <button onClick={() => setPage('login')}>Login</button>
      </nav>

      {/* Render the selected component */}
      {page === 'calendar' && <Calendar />}
      {page === 'login' && <AuthPage onAuth={(data) => {
        setUser(data);
        setPage('calendar');
      }} />}
    </div>
  );
}

export default App;