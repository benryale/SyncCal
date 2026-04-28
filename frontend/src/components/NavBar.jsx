/**
 * NavBar.jsx — adds avatar dropdown with "Profile" and "Sign out" links
 */
import { useState, useRef, useEffect } from 'react'
import { CalendarSync, User, LogOut, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SearchBar from './SearchBar'
import FriendList from './FriendList'
import Avatar from './Avatar'

function NavBar({
  user, onLogout, onLoginClick, onSignUpClick,
  onLogoClick, onProfileClick,
  visibleFriends, onVisibleFriendsChange,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <nav className="h-16 border-b border-border bg-card px-8 flex items-center justify-between">
      {/* Logo */}
      <button
        className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={onLogoClick}
      >
        <CalendarSync size={24} className="text-[#1a2744] dark:text-slate-100" />
        <span className="text-lg font-medium text-[#1a2744] dark:text-slate-100">SyncCal</span>
      </button>

      {/* Search bar — logged in only */}
      {user && <SearchBar user={user} />}

      <div className="flex items-center gap-4">
        {user ? (
          <>
            <FriendList
              user={user}
              visibleFriends={visibleFriends}
              onVisibleFriendsChange={onVisibleFriendsChange}
            />

            {/* Avatar + dropdown menu */}
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setDropdownOpen(v => !v)}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-muted transition-colors cursor-pointer"
              >
                <Avatar username={user.username} />
                <span className="text-sm text-muted-foreground">{user.username}</span>
                <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-44 rounded-lg border border-border bg-popover shadow-lg py-1">
                  <button
                    onClick={() => { setDropdownOpen(false); onProfileClick?.() }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    <User className="size-4 text-muted-foreground" />
                    Profile
                  </button>
                  <div className="my-1 border-t border-border" />
                  <button
                    onClick={() => { setDropdownOpen(false); onLogout() }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                  >
                    <LogOut className="size-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <button
              className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={onLoginClick}
            >
              Log in
            </button>
            <Button onClick={onSignUpClick}>Sign Up</Button>
          </>
        )}
      </div>
    </nav>
  )
}

export default NavBar
