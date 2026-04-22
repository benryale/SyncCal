// shows the first letter of a username in a small blue circle
// used in the nav, friend list, and user search results
function Avatar({ username, size = 'md' }) {
  const dimensions = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8'
  const letter = username ? username[0].toUpperCase() : '?'

  return (
    <div className={`${dimensions} flex-shrink-0 rounded-full bg-blue-50 flex items-center justify-center text-xs font-semibold text-blue-700`}>
      {letter}
    </div>
  )
}

export default Avatar
