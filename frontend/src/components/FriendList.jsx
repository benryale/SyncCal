import { useState, useEffect, useRef } from 'react'
import { Users, Check, X } from 'lucide-react'
import axios from 'axios'
import s from './FriendList.css'

// Main friends dropdown component used in the navbar.
// - Shows pending friend requests
// - Shows current friends
// - Lets user toggle which friends' events are visible on calendar
function FriendList({ user, visibleFriends = [], onVisibleFriendsChange = () => {} }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('requests')
  const [pendingRequests, setPendingRequests] = useState([])
  const [friends, setFriends] = useState([])
  const containerRef = useRef(null)

  // When the dropdown opens (and user is logged in), load both requests and friends.
  useEffect(() => {
    if (!user || !open) return
    fetchPending()
    fetchFriends()
  }, [user, open])

  // Poll pending requests every 30 seconds so badge count stays fresh.
  useEffect(() => {
    if (!user) return
    fetchPending()
    const interval = setInterval(fetchPending, 30000)
    return () => clearInterval(interval)
  }, [user])

  // Close dropdown when user clicks outside of the FriendList area.
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Fetch incoming (pending) friend requests for the current user.
  async function fetchPending() {
    try {
      const res = await axios.get('/api/friends/requests/')
      setPendingRequests(res.data)
    } catch { /* ignore */ }
  }

  // Fetch the accepted friends list for the current user.
  async function fetchFriends() {
    try {
      const res = await axios.get('/api/friends/')
      setFriends(res.data)
    } catch { /* ignore */ }
  }

  // Accept or decline one friend request, then update local UI state.
  async function respond(requestId, action) {
    try {
      await axios.post(`/api/friends/request/${requestId}/respond/`, { action })
      setPendingRequests(prev => prev.filter(r => r.id !== requestId))
      if (action === 'accept') fetchFriends()
    } catch { /* ignore */ }
  }

  if (!user) return null

  return (
    <div ref={containerRef} className={s.wrapper}>
      <TriggerButton count={pendingRequests.length} onClick={() => setOpen(prev => !prev)} />

      {open && (
        <div className={s.dropdown}>
          <TabBar tab={tab} setTab={setTab} pendingCount={pendingRequests.length} friendCount={friends.length} />
          <div className={s.scrollArea}>
            {tab === 'requests' && <RequestsTab requests={pendingRequests} onRespond={respond} />}
            {tab === 'friends' && <FriendsTab friends={friends} visibleFriends={visibleFriends} onVisibleFriendsChange={onVisibleFriendsChange} />}
          </div>
        </div>
      )}
    </div>
  )
}

// Small icon button that opens/closes the friend dropdown.
// Shows a red badge if there are pending requests.
function TriggerButton({ count, onClick }) {
  return (
    <button type="button" className={s.trigger} onClick={onClick}>
      <Users size={20} />
      {count > 0 && <span className={s.badge}>{count}</span>}
    </button>
  )
}

// Top tab bar used to switch between Requests and Friends views.
function TabBar({ tab, setTab, pendingCount, friendCount }) {
  const tabClass = (key) => `${s.tab} ${tab === key ? s.active : ''}`

  return (
    <div className={s.tabBar}>
      <button type="button" className={tabClass('requests')} onClick={() => setTab('requests')}>
        Requests {pendingCount > 0 && `(${pendingCount})`}
      </button>
      <button type="button" className={tabClass('friends')} onClick={() => setTab('friends')}>
        Friends {friendCount > 0 && `(${friendCount})`}
      </button>
    </div>
  )
}

// Circular user initial avatar used in both list types.
function Avatar({ letter }) {
  return <div className={s.avatar}>{letter[0].toUpperCase()}</div>
}

// Reusable empty-state row when there is no data to show.
function EmptyState({ message }) {
  return <div className={s.empty}>{message}</div>
}

// Requests tab content:
// - shows all pending requests
// - provides accept/decline actions
function RequestsTab({ requests, onRespond }) {
  if (requests.length === 0) return <EmptyState message="No pending requests" />

  return requests.map(req => (
    <div key={req.id} className={s.row}>
      <Avatar letter={req.from_username} />
      <div style={{ flex: 1 }}>
        <p className={s.name}>{req.from_username}</p>
        <p className={s.subtitle}>wants to be your friend</p>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button type="button" className={s.acceptBtn} onClick={() => onRespond(req.id, 'accept')}>
          <Check size={14} />
        </button>
        <button type="button" className={s.declineBtn} onClick={() => onRespond(req.id, 'decline')}>
          <X size={14} />
        </button>
      </div>
    </div>
  ))
}

// Friends tab content:
// - shows accepted friends
// - checkbox toggles whether each friend's events are visible
function FriendsTab({ friends, visibleFriends, onVisibleFriendsChange }) {
  if (friends.length === 0) return <EmptyState message="No friends yet" />

  // Toggle one friend id in the visible friends list.
  function toggle(id, checked) {
    if (checked) onVisibleFriendsChange([...visibleFriends, id])
    else onVisibleFriendsChange(visibleFriends.filter(fid => fid !== id))
  }

  return friends.map(f => (
    <div key={f.id} className={s.row}>
      <input type="checkbox" checked={visibleFriends.includes(f.id)} onChange={e => toggle(f.id, e.target.checked)} className={s.checkbox} />
      <Avatar letter={f.username} />
      <p className={s.name}>{f.username}</p>
    </div>
  ))
}

export default FriendList