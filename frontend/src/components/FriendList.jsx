import { useState, useEffect, useRef } from 'react'
import { Users, Check, X } from 'lucide-react'
import axios from 'axios'
import s from './FriendList.css'

function FriendList({ user, visibleFriends = [], onVisibleFriendsChange = () => {} }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('requests')
  const [pendingRequests, setPendingRequests] = useState([])
  const [friends, setFriends] = useState([])
  const containerRef = useRef(null)

  useEffect(() => {
    if (!user || !open) return
    fetchPending()
    fetchFriends()
  }, [user, open])

  useEffect(() => {
    if (!user) return
    fetchPending()
    const interval = setInterval(fetchPending, 30000)
    return () => clearInterval(interval)
  }, [user])

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function fetchPending() {
    try {
      const res = await axios.get('/api/friends/requests/')
      setPendingRequests(res.data)
    } catch { /* ignore */ }
  }

  async function fetchFriends() {
    try {
      const res = await axios.get('/api/friends/')
      setFriends(res.data)
    } catch { /* ignore */ }
  }

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

function TriggerButton({ count, onClick }) {
  return (
    <button type="button" className={s.trigger} onClick={onClick}>
      <Users size={20} />
      {count > 0 && <span className={s.badge}>{count}</span>}
    </button>
  )
}

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

function Avatar({ letter }) {
  return <div className={s.avatar}>{letter[0].toUpperCase()}</div>
}

function EmptyState({ message }) {
  return <div className={s.empty}>{message}</div>
}

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

function FriendsTab({ friends, visibleFriends, onVisibleFriendsChange }) {
  if (friends.length === 0) return <EmptyState message="No friends yet" />

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