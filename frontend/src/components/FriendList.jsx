/**
 * FriendList.jsx — updated to respond to WebSocket push notifications.
 *
 * Changes vs original:
 *  - Subscribes to WS messages of type 'friend_request'
 *  - When a friend request arrives or changes status, updates state in real-time
 *  - No longer relies solely on the 30-second poll for notifications
 *  - Kept the 60-second poll as a safety fallback
 */
import { useState, useEffect, useRef } from 'react'
import { Users, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import axios from 'axios'
import Avatar from './Avatar'
import { AnimatedTooltip } from '@/components/ui/animated-tooltip'
import { TextGenerateEffect } from '@/components/ui/text-generate-effect'
import { useWebSocket } from '@/context/WebSocketContext'

function FriendList({ user, visibleFriends = [], onVisibleFriendsChange = () => {} }) {
  const [open, setOpen]                       = useState(false)
  const [tab, setTab]                         = useState('requests')
  const [pendingRequests, setPendingRequests] = useState([])
  const [friends, setFriends]                 = useState([])
  const containerRef   = useRef(null)
  const lastCountRef   = useRef(null)

  const { subscribe } = useWebSocket()

  // ── WebSocket: react to friend_request messages immediately ────────── //
  useEffect(() => {
    if (!user) return
    const unsub = subscribe((msg) => {
      if (msg.type !== 'friend_request') return

      if (msg.action === 'created' && msg.to_user_id === user.id) {
        // Someone sent us a request — add it to the list
        setPendingRequests(prev => {
          if (prev.some(r => r.id === msg.id)) return prev
          return [...prev, {
            id: msg.id,
            from_user_id: msg.from_user_id,
            from_username: msg.from_username,
            created_at: new Date().toISOString(),
          }]
        })
        toast(`${msg.from_username} sent you a friend request`)
      } else if ((msg.action === 'accepted' || msg.action === 'declined')) {
        // A request we sent was responded to, or our own accept/decline propagated
        setPendingRequests(prev => prev.filter(r => r.id !== msg.id))
        if (msg.action === 'accepted') {
          // Refresh friends list so the new friend appears
          fetchFriends()
        }
      }
    })
    return unsub
  }, [subscribe, user])

  // ── fetch on open ─────────────────────────────────────────────────── //
  useEffect(() => {
    if (!user || !open) return
    fetchPending()
    fetchFriends()
  }, [user, open])

  // Safety fallback poll (60 s) — WS handles real-time
  useEffect(() => {
    if (!user) return
    fetchPending()
    const interval = setInterval(fetchPending, 60000)
    return () => clearInterval(interval)
  }, [user])

  // Close on outside click
  useEffect(() => {
    function h(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  async function fetchPending() {
    try {
      const res = await axios.get('/api/friends/requests/')
      const newCount = res.data.length
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

  async function respond(requestId, action) {
    try {
      await axios.post(`/api/friends/request/${requestId}/respond/`, { action })
      setPendingRequests(prev => prev.filter(r => r.id !== requestId))
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
      <button type="button"
        className="relative flex items-center rounded-md p-1 hover:bg-muted cursor-pointer"
        onClick={() => setOpen(prev => !prev)}>
        <Users size={20} className="text-muted-foreground" />
        {pendingRequests.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white">
            {pendingRequests.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[300px] overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          <div className="flex border-b border-border">
            {['requests','friends'].map(t => (
              <button key={t} type="button"
                className={`flex-1 cursor-pointer border-b-2 bg-transparent py-2 text-sm ${
                  tab === t
                    ? 'border-blue-600 font-semibold text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent font-normal text-muted-foreground'
                }`}
                onClick={() => setTab(t)}>
                {t === 'requests'
                  ? `Requests${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}`
                  : `Friends${friends.length > 0 ? ` (${friends.length})` : ''}`}
              </button>
            ))}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {tab === 'requests' && (
              pendingRequests.length === 0
                ? <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    <TextGenerateEffect words="No pending requests" />
                  </div>
                : pendingRequests.map(req => (
                    <div key={req.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50">
                      <AnimatedTooltip title={req.from_username} subtitle="sent you a request">
                        <Avatar username={req.from_username} />
                      </AnimatedTooltip>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{req.from_username}</p>
                        <p className="text-xs text-muted-foreground">wants to be your friend</p>
                      </div>
                      <div className="flex gap-1">
                        <button type="button"
                          className="rounded-md bg-green-500 px-2 py-1 text-white hover:bg-green-600 cursor-pointer"
                          onClick={() => respond(req.id, 'accept')}>
                          <Check size={14} />
                        </button>
                        <button type="button"
                          className="rounded-md bg-red-500 px-2 py-1 text-white hover:bg-red-600 cursor-pointer"
                          onClick={() => respond(req.id, 'decline')}>
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))
            )}

            {tab === 'friends' && (
              friends.length === 0
                ? <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    <TextGenerateEffect words="No friends yet" />
                  </div>
                : friends.map(f => (
                    <div key={f.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50">
                      <input type="checkbox"
                        checked={visibleFriends.includes(f.id)}
                        onChange={(e) => {
                          onVisibleFriendsChange(
                            e.target.checked
                              ? [...visibleFriends, f.id]
                              : visibleFriends.filter(id => id !== f.id)
                          )
                        }}
                        className="h-4 w-4 cursor-pointer" />
                      <AnimatedTooltip title={f.username} subtitle="friend">
                        <Avatar username={f.username} />
                      </AnimatedTooltip>
                      <p className="text-sm font-medium text-foreground">{f.username}</p>
                    </div>
                  ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default FriendList
