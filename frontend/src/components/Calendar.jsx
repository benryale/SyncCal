import React, { useEffect, useRef, useState, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { ThemeToggle } from "@/components/ThemeToggle";
import { Bell, Check, X, CalendarDays, Clock3, LoaderCircle, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { TextGenerateEffect } from '@/components/ui/text-generate-effect';
import { EventHoverTooltip } from '@/components/ui/event-hover-tooltip';

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { fromZonedTime, toZonedTime, format as formatInTz } from 'date-fns-tz'
import FriendShareSelector from "@/components/FriendShareSelector";

// ── new additions ─────────────────────────────────────────────────────────── //
import { useCalendarSocket } from '@/hooks/useCalendarSocket';
import { findConflicts, inviteHasConflict } from '@/utils/conflictDetection';
// ─────────────────────────────────────────────────────────────────────────── //

const COMMON_ZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
]

// attach the auth token to every API call
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

// format a UTC instant as a datetime-local string in the given tz
const formatForInput = (utcValue, tz) => {
  if (!utcValue) return ''
  return formatInTz(toZonedTime(utcValue, tz), "yyyy-MM-dd'T'HH:mm", { timeZone: tz })
}

const makeInitialFormData = (tz) => ({
  title: '',
  start_date: '',
  end_date: '',
  priority: 1,
  description: '',
  location: '',
  shared_with: '',
  timezone: tz,
})

const FRIEND_COLORS = [
  { bg: '#f97316', border: '#ea580c' },
  { bg: '#10b981', border: '#059669' },
  { bg: '#8b5cf6', border: '#7c3aed' },
  { bg: '#f43f5e', border: '#e11d48' },
  { bg: '#06b6d4', border: '#0891b2' },
  { bg: '#f59e0b', border: '#d97706' },
  { bg: '#ec4899', border: '#db2777' },
  { bg: '#6366f1', border: '#4f46e5' },
];

const getFriendColor = (username) => {
  let sum = 0;
  for (let i = 0; i < username.length; i++) sum += username.charCodeAt(i);
  return FRIEND_COLORS[sum % FRIEND_COLORS.length];
};

const isSameOrAfterToday = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
};

const eventOverlapsDate = (event, date) => {
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 999);
  const eventStart = new Date(event.start);
  const eventEnd   = event.end ? new Date(event.end) : eventStart;
  return eventStart <= dayEnd && eventEnd >= dayStart;
};

const buildEventTooltip = (event) => {
  const { isFriendEvent, organizer, location, description } = event.extendedProps;
  const meta = [];
  if (location)    meta.push(`Location: ${location}`);
  if (description) meta.push(description);
  if (isFriendEvent) return { eventId: event.id, title: `@${organizer}`, subtitle: 'Busy block', meta };
  return { eventId: event.id, title: event.title, subtitle: organizer ? `Organized by @${organizer}` : '', meta };
};

const apiEventToFcEvent = (event) => ({
  id: event.id,
  title: event.title,
  start: event.start_date,
  end: event.end_date,
  extendedProps: {
    organizer: event.organizer,
    timezone: event.timezone,
    location: event.location,
    description: event.description,
    priority: event.priority,
    shared_with: event.shared_with,
  },
});

const apiFriendEventToFcEvent = (event) => {
  const color = getFriendColor(event.organizer);
  return {
    id: `friend-${event.id}`,
    title: event.organizer,
    start: event.start_date,
    end: event.end_date,
    backgroundColor: color.bg,
    borderColor: color.border,
    extendedProps: {
      isFriendEvent: true,
      organizer: event.organizer,
      timezone: event.timezone,
      location: event.location,
      description: event.description,
      priority: event.priority,
      shared_with: event.shared_with,
    },
  };
};

const Calendar = ({ visibleFriends = [], user }) => {
  const userTz = user?.timezone || 'UTC';
  const [events, setEvents]                 = useState([]);
  const [showModal, setShowModal]           = useState(false);
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [formData, setFormData]             = useState(() => makeInitialFormData(userTz));
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [invites, setInvites]               = useState([]);
  const [showInvitesList, setShowInvitesList] = useState(false);
  const [hoveredEventTooltip, setHoveredEventTooltip] = useState(null);
  const lastInviteCountRef = useRef(null);
  const [showAdvanced, setShowAdvanced]     = useState(false);
  const [formConflicts, setFormConflicts]   = useState([]);

  // WebSocket connection
  const { lastMessage, connected } = useCalendarSocket();

  const zonesForPicker = (() => {
    const seen = new Set([userTz, formData.timezone].filter(Boolean));
    for (const z of COMMON_ZONES) seen.add(z);
    return [...seen];
  })();

  // Process incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;
    const { action, event } = lastMessage;

    if (action === 'created') {
      if (event.organizer_id === user?.id) {
        setEvents(prev => {
          const exists = prev.some(e => String(e.id) === String(event.id));
          if (exists) return prev;
          return [...prev, apiEventToFcEvent(event)];
        });
      } else if (visibleFriends.includes(event.organizer_id)) {
        fetchFriendEvents();
      }
      return;
    }

    if (action === 'updated') {
      if (event.organizer_id === user?.id) {
        setEvents(prev =>
          prev.map(e => String(e.id) === String(event.id) ? apiEventToFcEvent(event) : e)
        );
        toast.info('Calendar updated', { description: `"${event.title}" was modified.`, duration: 2500 });
      } else if (visibleFriends.includes(event.organizer_id)) {
        fetchFriendEvents();
      }
      return;
    }

    if (action === 'deleted') {
      if (event.organizer_id === user?.id) {
        setEvents(prev => prev.filter(e => String(e.id) !== String(event.id)));
      } else if (visibleFriends.includes(event.organizer_id)) {
        setEvents(prev => prev.filter(e => e.id !== `friend-${event.id}`));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage]);

  // Initial + friend-change fetch
  useEffect(() => {
    fetchEvents();
    fetchInvites();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleFriends]);

  // Invite polling (30 s) — events now pushed via WS
  useEffect(() => {
    const interval = setInterval(fetchInvites, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Conflict detection: re-run when form dates or events change
  useEffect(() => {
    if (!formData.start_date || !formData.end_date) { setFormConflicts([]); return; }
    const tz = formData.timezone || userTz;
    try {
      const start = fromZonedTime(formData.start_date, tz);
      const end   = fromZonedTime(formData.end_date,   tz);
      setFormConflicts(findConflicts(start, end, events, selectedEventId));
    } catch { setFormConflicts([]); }
  }, [formData.start_date, formData.end_date, formData.timezone, events, selectedEventId, userTz]);

  const fetchFriendEvents = async () => {
    if (visibleFriends.length === 0) return;
    try {
      const res = await axios.get(`/api/events/?owner_id__in=${visibleFriends.join(',')}`, { withCredentials: true });
      const friendEvents = res.data.map(apiFriendEventToFcEvent);
      setEvents(prev => [...prev.filter(e => !e.extendedProps?.isFriendEvent), ...friendEvents]);
    } catch { /* non-critical */ }
  };

  const fetchEvents = async () => {
    try {
      const response = await axios.get('/api/events/', { withCredentials: true });
      let formatted = response.data.map(apiEventToFcEvent);
      if (visibleFriends.length > 0) {
        try {
          const fr = await axios.get(`/api/events/?owner_id__in=${visibleFriends.join(',')}`, { withCredentials: true });
          formatted = [...formatted, ...fr.data.map(apiFriendEventToFcEvent)];
        } catch { console.log("Could not fetch friend events"); }
      }
      setEvents(formatted);
    } catch (error) { console.error("Error fetching events:", error); }
  };

  const fetchInvites = async () => {
    try {
      const response = await axios.get('/api/events/invites/');
      const pendingInvites = response.data.filter(inv => inv.status === 'pending');
      if (lastInviteCountRef.current !== null && pendingInvites.length > lastInviteCountRef.current) {
        const diff = pendingInvites.length - lastInviteCountRef.current;
        toast(diff === 1 ? 'New event invite' : `${diff} new event invites`);
      }
      lastInviteCountRef.current = pendingInvites.length;
      setInvites(pendingInvites);
    } catch (error) { console.error("Error fetching invites:", error); }
  };

  const handleInviteResponse = async (inviteId, status) => {
    try {
      await axios.post(`/api/events/invites/${inviteId}/respond/`, { status });
      setInvites(invites.filter(inv => inv.id !== inviteId));
      if (status === 'accepted') fetchEvents();
    } catch (error) {
      console.error(`Failed to ${status} invite:`, error);
      toast.error(`Couldn't ${status === 'accepted' ? 'accept' : 'decline'} the invite. Try again.`);
    }
  };

  const resetForm = () => {
    setFormData(makeInitialFormData(userTz));
    setSelectedEventId(null);
    setShowAdvanced(false);
    setFormConflicts([]);
  };

  const handleDateClick = (arg) => {
    setSelectedEventId(null);
    setFormData({ ...makeInitialFormData(userTz), start_date: `${arg.dateStr}T10:00`, end_date: `${arg.dateStr}T11:00` });
    setShowModal(true);
  };

  const handleEventClick = (info) => {
    const event = info.event;
    if (event.extendedProps?.isFriendEvent) return;
    const evTz = event.extendedProps.timezone || userTz;
    setSelectedEventId(event.id);
    setFormData({
      title: event.title,
      timezone: evTz,
      start_date: formatForInput(event.start, evTz),
      end_date: formatForInput(event.end || event.start, evTz),
      priority: event.extendedProps.priority || 1,
      description: event.extendedProps.description || '',
      location: event.extendedProps.location || '',
      shared_with: event.extendedProps.shared_with ? event.extendedProps.shared_with.join(', ') : ''
    });
    setShowAdvanced(evTz !== userTz);
    setShowModal(true);
  };

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const closeModal = () => { setShowModal(false); setIsSubmitting(false); resetForm(); };

  const startDate = formData.start_date ? new Date(formData.start_date) : null;
  const endDate   = formData.end_date   ? new Date(formData.end_date)   : null;
  const hasInvalidRange  = Boolean(startDate && endDate && startDate >= endDate);
  const isFormIncomplete = !formData.title.trim() || !formData.start_date || !formData.end_date;
  const formError        = hasInvalidRange ? 'End time must be after the start time.' : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.start_date || !formData.end_date || hasInvalidRange || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const tz = formData.timezone || userTz;
      const payload = {
        title: formData.title,
        description: formData.description,
        location: formData.location,
        start_date: fromZonedTime(formData.start_date, tz).toISOString(),
        end_date: fromZonedTime(formData.end_date, tz).toISOString(),
        timezone: tz,
        priority: formData.priority,
      };
      let currentEventId = selectedEventId;
      if (selectedEventId) {
        const response = await axios.put(`/api/events/${selectedEventId}/`, payload);
        const updatedEvent = response.data;
        setEvents(events.map(ev => String(ev.id) === String(updatedEvent.id) ? apiEventToFcEvent(updatedEvent) : ev));
      } else {
        const response = await axios.post('/api/events/', payload);
        const newEvent = response.data;
        currentEventId = newEvent.id;
        setEvents(prev => [...prev, apiEventToFcEvent(newEvent)]);
      }
      const usernamesToInvite = formData.shared_with
        ? formData.shared_with.split(',').map(n => n.trim()).filter(Boolean) : [];
      if (usernamesToInvite.length > 0 && currentEventId) {
        for (const username of usernamesToInvite) {
          try { await axios.post('/api/events/invites/send/', { event_id: currentEventId, username }); }
          catch (inviteError) { console.error(`Failed to invite ${username}:`, inviteError.response?.data || inviteError); }
        }
      }
      toast.success(selectedEventId ? 'Event updated' : 'Event created');
      closeModal();
    } catch (error) {
      console.error("Error saving event:", error.response?.data || error);
      toast.error("Failed to save event. Make sure you're signed in and try again.");
    } finally { setIsSubmitting(false); }
  };

  const handleEventDrop = async (info) => {
    try {
      await axios.put(`/api/events/${info.event.id}/`, {
        title: info.event.title,
        start_date: info.event.start.toISOString(),
        end_date: (info.event.end || info.event.start).toISOString(),
      });
      toast.success('Event moved');
    } catch (error) {
      console.error("Failed to move event:", error);
      toast.error("Couldn't move that event. Putting it back.");
      info.revert();
    }
  };

  const handleEventResize = async (info) => {
    try {
      await axios.put(`/api/events/${info.event.id}/`, {
        title: info.event.title,
        start_date: info.event.start.toISOString(),
        end_date: info.event.end.toISOString(),
      });
      toast.success('Event updated');
    } catch (error) {
      console.error("Failed to resize event:", error);
      toast.error("Couldn't resize that event. Putting it back.");
      info.revert();
    }
  };

  const handleEventMount = (info) => {
    const showTooltip = () => {
      const rect = info.el.getBoundingClientRect();
      setHoveredEventTooltip({ top: rect.top, left: rect.left + rect.width / 2, ...buildEventTooltip(info.event) });
    };
    const hideTooltip = () => setHoveredEventTooltip(cur => cur?.eventId === info.event.id ? null : cur);
    info.el.addEventListener('mouseenter', showTooltip);
    info.el.addEventListener('mouseleave', hideTooltip);
    info.el._syncShowTooltip = showTooltip;
    info.el._syncHideTooltip = hideTooltip;
  };

  const handleEventWillUnmount = (info) => {
    if (info.el._syncShowTooltip) { info.el.removeEventListener('mouseenter', info.el._syncShowTooltip); delete info.el._syncShowTooltip; }
    if (info.el._syncHideTooltip) { info.el.removeEventListener('mouseleave', info.el._syncHideTooltip); delete info.el._syncHideTooltip; }
    setHoveredEventTooltip(cur => cur?.eventId === info.event.id ? null : cur);
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    try {
      await axios.delete(`/api/events/${selectedEventId}/`);
      setEvents(events.filter(ev => String(ev.id) !== String(selectedEventId)));
      toast.success('Event deleted');
      closeModal();
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error("Couldn't delete the event. Try again.");
    }
  };

  const formatInviteTime = (dateString) => {
    const tz = user?.timezone || 'UTC';
    return formatInTz(toZonedTime(dateString, tz), "MMM d • h:mm a", { timeZone: tz });
  };

  const getDayCellClassNames = (arg) => {
    if (arg.view.type !== 'dayGridMonth' || arg.isOther || !isSameOrAfterToday(arg.date)) return [];
    return events.some(event => eventOverlapsDate(event, arg.date)) ? [] : ['sync-empty-day'];
  };

  return (
    <div className="relative">
      <EventHoverTooltip tooltip={hoveredEventTooltip} />

      <div className="absolute right-0 top-0 z-20 flex h-[38px] items-center gap-2">
        {/* WebSocket status indicator */}
        <span title={connected ? 'Live updates active' : 'Reconnecting…'} className="flex items-center">
          {connected
            ? <Wifi className="size-4 text-green-500" />
            : <WifiOff className="size-4 text-muted-foreground animate-pulse" />
          }
        </span>

        <ThemeToggle />

        <div className="relative">
          <Button variant="outline" size="icon" className="relative rounded-full" onClick={() => setShowInvitesList(!showInvitesList)}>
            <Bell className="size-5 text-muted-foreground" />
            {invites.length > 0 && (
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {invites.length}
              </span>
            )}
          </Button>

          {showInvitesList && (
            <div className="absolute right-0 top-12 z-50 w-80 rounded-md border bg-popover p-2 shadow-lg">
              <h3 className="mb-2 px-2 text-sm font-semibold text-foreground">Pending Invites</h3>
              {invites.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                  <TextGenerateEffect words="No new invites" />
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
                  {invites.map((invite) => {
                    const isConflict = inviteHasConflict(invite.event_start, invite.event_end, events);
                    return (
                      <div key={invite.id} className="flex flex-col rounded-lg border bg-muted/20 p-3 text-sm shadow-sm transition-colors hover:bg-muted/40">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 pr-2">
                            <p className="font-semibold text-foreground truncate">{invite.event_title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              From: <span className="font-medium text-blue-600 dark:text-blue-400">@{invite.organizer_username}</span>
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/50" onClick={() => handleInviteResponse(invite.id, 'accepted')}>
                              <Check className="size-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/50" onClick={() => handleInviteResponse(invite.id, 'declined')}>
                              <X className="size-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          <p className="flex items-center text-xs text-muted-foreground">
                            <Clock3 className="mr-1.5 size-3.5" />
                            {formatInviteTime(invite.event_start)}
                          </p>
                          {isConflict && (
                            <p className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800 dark:bg-red-900/30 dark:text-red-200 w-fit">
                              <AlertTriangle className="size-3" />
                              Time Conflict
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <FullCalendar
        timeZone={user?.timezone || 'UTC'}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{ left: 'title', center: 'dayGridMonth,timeGridWeek,timeGridDay', right: 'prev,next today' }}
        events={events}
        dateClick={handleDateClick}
        dayCellClassNames={getDayCellClassNames}
        eventClick={handleEventClick}
        eventDidMount={handleEventMount}
        eventWillUnmount={handleEventWillUnmount}
        editable={true}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        height="75vh"
        eventDisplay="block"
      />

      <Dialog open={showModal} onOpenChange={(open) => { if (!open) { closeModal(); return; } setShowModal(true); }}>
        <DialogContent className="p-0 sm:max-w-md overflow-visible">
          <DialogHeader className="px-6 pt-5 pb-1 text-center">
            <DialogTitle className="text-lg font-semibold">{selectedEventId ? 'Edit event' : 'New event'}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">Block out some time on your calendar.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="grid">
            <div className="grid gap-4 px-6 pb-5">
              <div className="grid gap-1.5">
                <Label htmlFor="title" className="text-sm font-medium">Event title</Label>
                <Input id="title" name="title" value={formData.title} onChange={handleInputChange} placeholder="Study group, office hours, dinner plans" className="h-10 bg-muted/50" required />
              </div>

              <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="start_date" className="flex items-center gap-1.5 text-sm font-medium">
                    <CalendarDays className="size-3.5 text-muted-foreground" />Start
                  </Label>
                  <Input id="start_date" type="datetime-local" name="start_date" value={formData.start_date} onChange={handleInputChange} className="h-10" required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="end_date" className="flex items-center gap-1.5 text-sm font-medium">
                    <Clock3 className="size-3.5 text-muted-foreground" />End
                  </Label>
                  <Input id="end_date" type="datetime-local" name="end_date" value={formData.end_date} onChange={handleInputChange} className="h-10" required />
                </div>
              </div>

              {/* Conflict warning */}
              {formConflicts.length > 0 && !hasInvalidRange && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-medium">Scheduling conflict</p>
                    <p className="text-xs mt-0.5">Overlaps with: {formConflicts.map(c => `"${c.title}"`).join(', ')}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end -mt-1">
                <button type="button" onClick={() => setShowAdvanced(s => !s)} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                  {showAdvanced ? 'Hide advanced' : 'Show advanced'}
                </button>
              </div>

              {showAdvanced && (
                <div className="grid gap-1.5 rounded-lg border bg-muted/20 p-3">
                  <Label htmlFor="timezone" className="text-sm font-medium">Anchor timezone</Label>
                  <Select value={formData.timezone} onValueChange={(v) => setFormData(f => ({ ...f, timezone: v }))}>
                    <SelectTrigger id="timezone" className="h-9"><SelectValue placeholder="Pick a timezone" /></SelectTrigger>
                    <SelectContent>{zonesForPicker.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-[0.75rem] text-muted-foreground">The start/end times above are interpreted in this zone.</p>
                </div>
              )}

              <div className="grid gap-1.5">
                <Label htmlFor="location" className="text-sm font-medium">Location</Label>
                <Input id="location" name="location" value={formData.location} onChange={handleInputChange} placeholder="Zoom, library, dining hall" className="h-10" />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                <Input id="description" name="description" value={formData.description} onChange={handleInputChange} placeholder="Any extra details" className="h-10" />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="shared_with" className="text-sm font-medium">Share with Friends</Label>
                <FriendShareSelector value={formData.shared_with} onChange={handleInputChange} />
                <p className="text-[0.8rem] text-muted-foreground">Enter comma-separated usernames</p>
              </div>

              {formError && <p className="text-sm text-red-500">{formError}</p>}
            </div>

            <div className="flex items-center justify-between border-t bg-muted/20 px-6 py-3">
              <div>
                {selectedEventId && (
                  <Button type="button" variant="destructive" onClick={handleDelete} disabled={isSubmitting}>Delete</Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={closeModal} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting || isFormIncomplete || hasInvalidRange}>
                  {isSubmitting ? (<><LoaderCircle className="size-4 animate-spin" />Saving…</>) : (selectedEventId ? 'Update' : 'Save event')}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Calendar;
