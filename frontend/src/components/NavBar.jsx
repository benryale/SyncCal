import { CalendarSync } from 'lucide-react';
import { Button } from "@/components/ui/button"

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

      <div className="flex items-center gap-4">
        {user ? (
          <>
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-xs font-medium text-blue-700">
              {user.username[0].toUpperCase()}
            </div>
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
