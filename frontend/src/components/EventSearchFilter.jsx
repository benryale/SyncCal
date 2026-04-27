/**
 * EventSearchFilter.jsx
 * ---------------------
 * A search + filter bar that sits above the FullCalendar.
 * Props:
 *   events       – the full FullCalendar event array
 *   onFilter     – callback(filteredEvents) called whenever the filter changes
 *   onClear      – called when the user clears all filters
 */
import { useState, useEffect, useRef } from 'react'
import { Search, X, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

function EventSearchFilter({ events, onFilter }) {
  const [query, setQuery]         = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const isFiltering = query || startDate || endDate

  // re-run filter whenever inputs or events change
  useEffect(() => {
    if (!isFiltering) {
      onFilter(null) // null = show all events
      return
    }

    const q = query.toLowerCase().trim()

    const filtered = events.filter(ev => {
      // title search
      if (q && !ev.title.toLowerCase().includes(q)) return false

      // skip friend overlay events from search results
      if (ev.extendedProps?.isFriendEvent) return false

      // date range filter
      const evStart = new Date(ev.start)
      if (startDate && evStart < new Date(startDate)) return false
      if (endDate) {
        const rangeEnd = new Date(endDate)
        rangeEnd.setHours(23, 59, 59, 999)
        if (evStart > rangeEnd) return false
      }

      return true
    })

    onFilter(filtered)
  }, [query, startDate, endDate, events])

  const handleClear = () => {
    setQuery('')
    setStartDate('')
    setEndDate('')
    setShowFilters(false)
    onFilter(null)
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search events by title…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-8 pr-8 h-9"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Toggle date filters */}
        <Button
          variant={showFilters ? 'secondary' : 'outline'}
          size="sm"
          className="h-9 gap-1.5 shrink-0"
          onClick={() => setShowFilters(v => !v)}
        >
          <Filter className="size-3.5" />
          Date filter
          {(startDate || endDate) && (
            <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
              !
            </span>
          )}
        </Button>

        {/* Clear all */}
        {isFiltering && (
          <Button variant="ghost" size="sm" className="h-9 shrink-0" onClick={handleClear}>
            <X className="size-4 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Date range inputs */}
      {showFilters && (
        <div className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <span className="text-sm text-muted-foreground shrink-0">From</span>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <span className="text-sm text-muted-foreground shrink-0">to</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            min={startDate}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate('') }}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Reset dates
            </button>
          )}
        </div>
      )}

      {/* Result count when filtering */}
      {isFiltering && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {events.filter(ev => !ev.extendedProps?.isFriendEvent).length === 0
            ? 'No events found'
            : `Showing ${
                events.filter(ev => {
                  if (ev.extendedProps?.isFriendEvent) return false
                  const q = query.toLowerCase().trim()
                  if (q && !ev.title.toLowerCase().includes(q)) return false
                  const evStart = new Date(ev.start)
                  if (startDate && evStart < new Date(startDate)) return false
                  if (endDate) {
                    const re = new Date(endDate); re.setHours(23,59,59,999)
                    if (evStart > re) return false
                  }
                  return true
                }).length
              } event(s)`
          }
        </p>
      )}
    </div>
  )
}

export default EventSearchFilter
