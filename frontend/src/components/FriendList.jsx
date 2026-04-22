import { useState, useEffect, useRef } from 'react'
import { Users, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import axios from 'axios'
import Avatar from './Avatar'

function FriendList({ user, visibleFriends = [], onVisibleFriendsChange = () => {} }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('requests') // 'requests' | 'friends'
  const [pendingRequests, setPendingRequests] = useState([])
  const [friends, setFriends] = useState([])
  const containerRef = useRef(null)
  // track the previous request count so we only toast when a new one comes in
  const lastCountRef = useRef(null)

  // refresh both lists whenever the dropdown opens
  useEffect(() => {
    if (!user || !open) return
    fetchPending()
    fetchFriends()
  }, [user, open])

  // poll for new friend requests every 30 seconds while logged in
  useEffect(() => {
    if (!user) return
    fetchPending()
    const interval = setInterval(fetchPending, 30000)
    return () => clearInterval(interval)
  }, [user])

  // close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function fetchPending() {
    try {
      const res = await axios.get('/api/friends/requests/')
      const newCount = res.data.length

      // first fetch after login: just set the baseline, no toast yet
      if (lastCountRef.current !== null && newCount > lastCountRef.current) {
        const diff = newCount - lastCountRef.current
        toast(diff === 1 ? 'New friend request' : `${diff} new friend requests`)
      }
      lastCountRef.current = newCount

      setPendingRequests(res.data)
    } catch { /* ignore */ }
  }

  async function fetchFriends() {
    try {
      const res = await axios.get('/api/friends/')
      setFriends(res.data)
    } catch { /* ignore */ }
  }

  // accept or decline a pending friend request
  async function respond(requestId, action) {
    try {
      await axios.post(`/api/friends/request/${requestId}/respond/`, { action })
      // remove the request from the list immediately
      setPendingRequests(prev => prev.filter(r => r.id !== requestId))
      // if accepted, refresh friends so the new one shows up
      if (action === 'accept') {
        fetchFriends()
        toast.success('Friend request accepted')
      } else {
        toast('Friend request declined')
      }
    } catch {
      toast.error("Couldn't respond to the request. Try again.")
    }
  }

  if (!user) return null

  return (
    <div ref={containerRef} className="relative">
      {/* friend icon with badge that shows the number of pending requests */}
      <button
        type="button"
        className="relative flex items-center rounded-md p-1 hover:bg-muted cursor-pointer"
        onClick={() => setOpen(prev => !prev)}
      >
        <Users size={20} className="text-muted-foreground" />
        {pendingRequests.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white">
            {pendingRequests.length}
          </span>
        )}
      </button>

      {/* dropdown panel with tabs for requests and friends */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[300px] overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          {/* tab switcher */}
          <div className="flex border-b border-border">
            <button
              type="button"
              className={`flex-1 cursor-pointer border-b-2 bg-transparent py-2 text-sm ${
                tab === 'requests'
                  ? 'border-blue-600 font-semibold text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent font-normal text-muted-foreground'
              }`}
              onClick={() => setTab('requests')}
            >
              Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
            </button>
            <button
              type="button"
              className={`flex-1 cursor-pointer border-b-2 bg-transparent py-2 text-sm ${
                tab === 'friends'
                  ? 'border-blue-600 font-semibold text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent font-normal text-muted-foreground'
              }`}
              onClick={() => setTab('friends')}
            >
              Friends {friends.length > 0 && `(${friends.length})`}
            </button>
          </div>

          {/* scrollable content area */}
          <div className="max-h-72 overflow-y-auto">
            {tab === 'requests' && (
              pendingRequests.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <span className="text-sm text-muted-foreground">No pending requests</span>
                </div>
              ) : (
                pendingRequests.map(req => (
                  <div
                    key={req.id}
                    className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50"
                  >
                    <Avatar username={req.from_username} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{req.from_username}</p>
                      <p className="text-xs text-muted-foreground">wants to be your friend</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="rounded-md bg-green-500 px-2 py-1 text-white hover:bg-green-600 cursor-pointer"
                        onClick={() => respond(req.id, 'accept')}
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-red-500 px-2 py-1 text-white hover:bg-red-600 cursor-pointer"
                        onClick={() => respond(req.id, 'decline')}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )
            )}

            {tab === 'friends' && (
              friends.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <span className="text-sm text-muted-foreground">No friends yet</span>
                </div>
              ) : (
                friends.map(f => (
                  <div
                    key={f.id}
                    className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50"
                  >
                    {/* checkbox toggles whether this friend's events show on the calendar */}
                    <input
                      type="checkbox"
                      checked={visibleFriends.includes(f.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onVisibleFriendsChange([...visibleFriends, f.id])
                        } else {
                          onVisibleFriendsChange(visibleFriends.filter(id => id !== f.id))
                        }
                      }}
                      className="h-4 w-4 cursor-pointer"
                    />
                    <Avatar username={f.username} />
                    <p className="text-sm font-medium text-foreground">{f.username}</p>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default FriendList
