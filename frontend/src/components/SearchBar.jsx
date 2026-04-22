import { useState, useEffect, useRef } from 'react'
import { Search, UserPlus, UserCheck, Clock } from 'lucide-react'
import { toast } from 'sonner'
import axios from 'axios'
import Avatar from './Avatar'

function SearchBar({ user }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  // tracks per-user request state: 'none' | 'pending' | 'accepted'
  const [requestStates, setRequestStates] = useState({})
  const containerRef = useRef(null)
  const debounceRef = useRef(null)

  // debounce the search request so we don't hammer the API on every keystroke
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setOpen(false)
      return
    }

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await axios.get(`/api/users/search/?q=${encodeURIComponent(query)}`)
        setResults(res.data)
        // seed friend states from what the server tells us about each user
        const states = {}
        res.data.forEach(u => { states[u.id] = u.friend_status ?? 'none' })
        setRequestStates(prev => ({ ...prev, ...states }))
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(debounceRef.current)
  }, [query])

  // close dropdown when clicking outside the search area
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // optimistically mark the request as pending so the UI updates instantly
  async function handleAddFriend(toUserId) {
    setRequestStates(prev => ({ ...prev, [toUserId]: 'pending' }))
    try {
      await axios.post('/api/friends/request/', { to_user_id: toUserId })
      toast.success('Friend request sent')
    } catch {
      // revert on failure so the button goes back to "Add"
      setRequestStates(prev => ({ ...prev, [toUserId]: 'none' }))
      toast.error("Couldn't send friend request. Try again.")
    }
  }

  // small helper to render the right friend button based on status
  function FriendButton({ userId }) {
    const status = requestStates[userId] ?? 'none'
    if (!user) return null

    if (status === 'accepted') {
      return (
        <button
          disabled
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-green-700"
        >
          <UserCheck size={13} /> Friends
        </button>
      )
    }
    if (status === 'pending') {
      return (
        <button
          disabled
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground"
        >
          <Clock size={13} /> Pending
        </button>
      )
    }
    return (
      <button
        onClick={(e) => { e.stopPropagation(); handleAddFriend(userId) }}
        className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted cursor-pointer"
      >
        <UserPlus size={13} /> Add
      </button>
    )
  }

  return (
    <div ref={containerRef} className="relative w-72">
      <div className="relative">
        <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Search size={15} />
        </div>
        <input
          placeholder="Search users..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="w-full rounded-md border border-border bg-muted/50 py-1.5 pl-8 pr-3 text-sm focus:border-blue-400 focus:bg-white focus:outline-none"
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-60 overflow-y-auto rounded-md border border-border bg-white shadow-md">
          {loading ? (
            <div className="px-3 py-2">
              <span className="text-sm text-muted-foreground">Searching...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2">
              <span className="text-sm text-muted-foreground">No users found</span>
            </div>
          ) : (
            results.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50"
              >
                <Avatar username={u.username} size="sm" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{u.username}</p>
                  {u.email && (
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  )}
                </div>
                <FriendButton userId={u.id} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default SearchBar
