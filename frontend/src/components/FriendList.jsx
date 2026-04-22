import { useState, useEffect, useRef } from 'react'
import { Users, Check, X } from 'lucide-react'
import axios from 'axios'

const styles = {
  wrapper: 'relative',
  trigger: 'relative flex items-center rounded-md p-1 hover:bg-muted cursor-pointer',
  badge: 'absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white',
  dropdown: 'absolute right-0 top-[calc(100%+8px)] z-50 w-[300px] overflow-hidden rounded-lg border border-border bg-white shadow-lg',
  tabBar: 'flex border-b border-border',
  tabBase: 'flex-1 cursor-pointer border-b-2 bg-transparent py-2 text-sm',
  tabActive: 'border-blue-600 font-semibold text-blue-600',
  tabInactive: 'border-transparent font-normal text-muted-foreground',
  scrollArea: 'max-h-72 overflow-y-auto',
  empty: 'px-4 py-6 text-center text-sm text-muted-foreground',
  row: 'flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50',
  avatar: 'flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700',
  name: 'text-sm font-medium text-foreground',
  subtitle: 'text-xs text-muted-foreground',
  acceptBtn: 'rounded-md bg-green-500 px-2 py-1 text-white hover:bg-green-600 cursor-pointer',
  declineBtn: 'rounded-md bg-red-500 px-2 py-1 text-white hover:bg-red-600 cursor-pointer',
  checkbox: 'h-4 w-4 cursor-pointer',
}

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
    <div ref={containerRef} className={styles.wrapper}>
      <TriggerButton count={pendingRequests.length} onClick={() => setOpen(prev => !prev)} />

      {open && (
        <div className={styles.dropdown}>
          <TabBar tab={tab} setTab={setTab} pendingCount={pendingRequests.length} friendCount={friends.length} />
          <div className={styles.scrollArea}>
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
    <button type="button" className={styles.trigger} onClick={onClick}>
      <Users size={20} className="text-muted-foreground" />
      {count > 0 && <span className={styles.badge}>{count}</span>}
    </button>
  )
}

function TabBar({ tab, setTab, pendingCount, friendCount }) {
  const tabClass = (key) => `${styles.tabBase} ${tab === key ? styles.tabActive : styles.tabInactive}`

  return (
    <div className={styles.tabBar}>
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
  return (
    <div className={styles.avatar}>
      {letter[0].toUpperCase()}
    </div>
  )
}

function EmptyState({ message }) {
  return <div className={styles.empty}>{message}</div>
}

function RequestsTab({ requests, onRespond }) {
  if (requests.length === 0) return <EmptyState message="No pending requests" />

  return requests.map(req => (
    <div key={req.id} className={styles.row}>
      <Avatar letter={req.from_username} />
      <div className="flex-1">
        <p className={styles.name}>{req.from_username}</p>
        <p className={styles.subtitle}>wants to be your friend</p>
      </div>
      <div className="flex gap-1">
        <button type="button" className={styles.acceptBtn} onClick={() => onRespond(req.id, 'accept')}>
          <Check size={14} />
        </button>
        <button type="button" className={styles.declineBtn} onClick={() => onRespond(req.id, 'decline')}>
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
    <div key={f.id} className={styles.row}>
      <input type="checkbox" checked={visibleFriends.includes(f.id)} onChange={e => toggle(f.id, e.target.checked)} className={styles.checkbox} />
      <Avatar letter={f.username} />
      <p className={styles.name}>{f.username}</p>
    </div>
  ))
}

export default FriendList