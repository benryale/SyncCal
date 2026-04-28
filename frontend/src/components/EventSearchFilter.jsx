/**
 * EventSearchFilter.jsx
 * ---------------------
 * Autocomplete dropdown search — as you type, shows matching events.
 * Clicking a result navigates the FullCalendar to that event's date.
 */
import { useState, useEffect, useRef } from 'react'
import { Search, X, Calendar } from 'lucide-react'
import { format } from 'date-fns'

function EventSearchFilter({ events, calendarRef }) {
  const [query, setQuery]       = useState('')
  const [open, setOpen]         = useState(false)
  const [results, setResults]   = useState([])
  const containerRef            = useRef(null)
  const inputRef                = useRef(null)

  // filter events as user types
  useEffect(() => {
    const q = query.trim().toLowerCase()
    if (!q) { setResults([]); setOpen(false); return }

    const matches = events
      .filter(ev => !ev.extendedProps?.isFriendEvent)
      .filter(ev => ev.title.toLowerCase().includes(q))
      .slice(0, 8) // max 8 results

    setResults(matches)
    setOpen(matches.length > 0)
  }, [query, events])

  // close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (ev) => {
    // navigate calendar to the event's date
    if (calendarRef?.current) {
      const api = calendarRef.current.getApi()
      api.gotoDate(new Date(ev.start))
      // switch to week view so the event is clearly visible
      api.changeView('timeGridWeek')
    }
    setQuery('')
    setOpen(false)
  }

  const formatEventDate = (dateStr) => {
    try {
      return format(new Date(dateStr), 'MMM d, yyyy')
    } catch {
      return ''
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          placeholder="Search events…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="w-full rounded-md border border-border bg-muted/50 py-1.5 pl-8 pr-8 text-sm text-foreground focus:border-blue-400 focus:bg-card focus:outline-none"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false) }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
          {results.map(ev => (
            <button
              key={ev.id}
              onClick={() => handleSelect(ev)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/60 transition-colors"
            >
              {/* color dot */}
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: ev.extendedProps?.color || ev.backgroundColor || '#3B82F6' }}
              />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{ev.title}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="size-3" />
                  {formatEventDate(ev.start)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default EventSearchFilter
