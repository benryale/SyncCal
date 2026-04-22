import { CalendarSync } from 'lucide-react';
import { Button } from "@/components/ui/button"
import SearchBar from './SearchBar';
import FriendList from './FriendList';
import Avatar from './Avatar';

function NavBar({ user, onLogout, onLoginClick, onLogoClick, visibleFriends, onVisibleFriendsChange }) {
  return (
    <nav className="h-16 border-b border-border bg-white px-8 flex items-center justify-between">
      <button
        className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={onLogoClick}
      >
        <CalendarSync size={24} className="text-[#1a2744]" />
        <span className="text-lg font-medium text-[#1a2744]">SyncCal</span>
      </button>

      {/* search bar shows up in the middle when the user is logged in */}
      {user && <SearchBar user={user} />}

      <div className="flex items-center gap-4">
        {user ? (
          <>
            {/* friend list dropdown for managing requests and friend visibility */}
            <FriendList
              user={user}
              visibleFriends={visibleFriends}
              onVisibleFriendsChange={onVisibleFriendsChange}
            />
            <Avatar username={user.username} />
            <span className="text-sm text-muted-foreground">{user.username}</span>
            <Button variant="outline" onClick={onLogout}>
              Sign out
            </Button>
          </>
        ) : (
          <>
            <button
              className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={onLoginClick}
            >
              Log in
            </button>
            <Button onClick={onLoginClick}>
              Sign Up
            </Button>
          </>
        )}
      </div>
    </nav>
  )
}

export default NavBar
