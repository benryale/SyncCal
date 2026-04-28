import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, X, Users } from 'lucide-react';

export default function FriendShareSelector({ value, onChange }) {
  const [query, setQuery] = useState('');
  const [friends, setFriends] = useState([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  //  Convert the comma separated string from Calendar.jsx into an array for the UI
  const selectedUsernames = value 
    ? value.split(',').map(n => n.trim()).filter(n => n !== '') 
    : [];

  // Fetch the user's accepted friends ONCE when the component loads
  useEffect(() => {
    const fetchFriends = async () => {

      try {
        // friends endpoint will return a list of users
        const res = await axios.get('/api/friends/'); 
        console.log("django friends:", res.data);
        // Map it to just an array of usernames for easy filtering
        const friendUsernames = res.data.map(f => f.username || f.friend?.username || f.to_user?.username);
        setFriends(friendUsernames.filter(Boolean));
      } catch (error) {
        console.error("Failed to fetch friends for dropdown:", error);
      }
    };
    fetchFriends();
  }, []);

  //  Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  //  Update the parent form data
  const updateParent = (newArray) => {
    // We send a fake "event" back to Calendar.jsx so handleInputChange works perfectly
    onChange({
      target: {
        name: 'shared_with',
        value: newArray.join(', ')
      }
    });
  };

  const handleSelect = (username) => {
    if (!selectedUsernames.includes(username)) {
      updateParent([...selectedUsernames, username]);
    }
    setQuery('');
    setOpen(false);
  };

  const handleRemove = (usernameToRemove) => {
    updateParent(selectedUsernames.filter(u => u !== usernameToRemove));
  };

  //  Instantly filter friends based on what they type
  const availableFriends = friends.filter(f => 
    f.toLowerCase().includes(query.toLowerCase()) && 
    !selectedUsernames.includes(f)
  );

  return (
    <div ref={containerRef} className="relative w-full">
      
      {/* this serves as the input area*/}
      <div 
        className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-offset-2"
        onClick={() => setOpen(true)}
      >
        {selectedUsernames.length === 0 && query === '' && (
          <div className="absolute left-3 flex items-center text-muted-foreground pointer-events-none">
            <Users size={14} className="mr-2" />
            <span>Search friends...</span>
          </div>
        )}

        {/* Selected Friend Badges */}
        {selectedUsernames.map(username => (
          <span 
            key={username} 
            className="flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
          >
            @{username}
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); handleRemove(username); }}
              className="rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 p-0.5"
            >
              <X size={12} />
            </button>
          </span>
        ))}

        {/* Actual invisible input field */}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          className="flex-1 bg-transparent outline-none min-w-[60px]"
          autoComplete="off"
        />
      </div>

      {/* dropdown menu of friends */}
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-48 overflow-y-auto rounded-md border border-border bg-white dark:bg-[#1a2744] shadow-md">
          {availableFriends.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {query ? "No matching friends." : "All friends selected."}
            </div>
          ) : (
            availableFriends.map((friendName) => (
              <div
                key={friendName}
                onClick={() => handleSelect(friendName)}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-muted/50 dark:hover:bg-white/10"
              >
                @{friendName}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}