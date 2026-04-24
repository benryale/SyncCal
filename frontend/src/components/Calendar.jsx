import React, { useEffect, useRef, useState, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Bell, Check, X, CalendarDays, Clock3, LoaderCircle, Wifi, WifiOff, AlertTriangle, Keyboard } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { TextGenerateEffect } from '@/components/ui/text-generate-effect';
import { EventHoverTooltip } from '@/components/ui/event-hover-tooltip';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fromZonedTime, toZonedTime, format as formatInTz } from 'date-fns-tz';
import FriendShareSelector from '@/components/FriendShareSelector';
import { useWebSocket } from '@/context/WebSocketContext';

const COMMON_ZONES = [
  'UTC','America/New_York','America/Chicago','America/Denver',
  'America/Los_Angeles','America/Anchorage','Pacific/Honolulu',
  'Europe/London','Europe/Paris','Europe/Berlin',
  'Asia/Tokyo','Asia/Shanghai','Asia/Kolkata','Australia/Sydney',
];

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

axios.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Token ${token}`;
  return cfg;
});

const getFriendColor = (username) => {
  let s = 0;
  for (let i = 0; i < username.length; i++) s += username.charCodeAt(i);
  return FRIEND_COLORS[s % FRIEND_COLORS.length];
};

const formatForInput = (utcValue, tz) => {
  if (!utcValue) return '';
  return formatInTz(toZonedTime(utcValue, tz), "yyyy-MM-dd'T'HH:mm", { timeZone: tz });
};

const makeInitialForm = (tz) => ({
  title: '', start_date: '', end_date: '', priority: 1,
  description: '', location: '', shared_with: '', timezone: tz,
});

const isSameOrAfterToday = (date) => {
  const t = new Date(); t.setHours(0,0,0,0); return date >= t;
};

const eventOverlapsDate = (ev, date) => {
  const ds = new Date(date); ds.setHours(0,0,0,0);
  const de = new Date(date); de.setHours(23,59,59,999);
  const es = new Date(ev.start);
  const ee = ev.end ? new Date(ev.end) : es;
  return es <= de && ee >= ds;
};

const toFcEvent = (ev) => ({
  id: ev.id,
  title: ev.title,
  start: ev.start_date,
  end: ev.end_date,
  extendedProps: {
    organizer: ev.organizer,
    timezone: ev.timezone,
    location: ev.location,
    description: ev.description,
    priority: ev.priority,
    shared_with: ev.shared_with,
  },
});

const toFriendFcEvent = (ev) => {
  const c = getFriendColor(ev.organizer);
  return {
    id: `friend-${ev.id}`,
    title: ev.organizer,
    start: ev.start_date,
    end: ev.end_date,
    backgroundColor: c.bg,
    borderColor: c.border,
    extendedProps: {
      isFriendEvent: true,
      organizer: ev.organizer,
      timezone: ev.timezone,
      location: ev.location,
      description: ev.description,
      priority: ev.priority,
      shared_with: ev.shared_with,
    },
  };
};

const buildTooltip = (ev) => {
  const { isFriendEvent, organizer, location, description } = ev.extendedProps;
  const meta = [];
  if (location) meta.push(`Location: ${location}`);
  if (description) meta.push(description);
  return isFriendEvent
    ? { eventId: ev.id, title: `@${organizer}`, subtitle: 'Busy block', meta }
    : { eventId: ev.id, title: ev.title, subtitle: organizer ? `Organized by @${organizer}` : '', meta };
};

const detectConflicts = (start, end, events, editId = null) => {
  const s = new Date(start), e = new Date(end);
  return events.filter((ev) => {
    if (ev.extendedProps?.isFriendEvent) return false;
    if (editId && String(ev.id) === String(editId)) return false;
    const es = new Date(ev.start), ee = ev.end ? new Date(ev.end) : es;
    return s < ee && es < e;
  });
};

const ONBOARDING_KEY = 'synccal_onboarded';

const TOUR_STEPS = [
  {
    icon: <CalendarDays className="size-8 text-blue-500" />,
    title: 'Click any day to create an event',
    body: 'Click on a date to open the event form. Set a title, time, and optionally invite friends.',
  },
  {
    icon: <Wifi className="size-8 text-green-500" />,
    title: 'Live collaboration',
    body: "Changes appear instantly across all tabs and for friends viewing your calendar. The green WiFi icon means you're connected live.",
  },
  {
    icon: <AlertTriangle className="size-8 text-amber-500" />,
    title: 'Conflict detection',
    body: 'When creating events, an amber warning appears if the time overlaps an existing event.',
  },
  {
    icon: <Keyboard className="size-8 text-orange-500" />,
    title: 'Keyboard shortcuts',
    body: 'Press N to create a new event, Escape to close dialogs, or ? to see all shortcuts.',
  },
];

function OnboardingModal({ onDone }) {
  const [step, setStep] = useState(0);
  const s = TOUR_STEPS[step];
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border bg-popover p-6 shadow-2xl">
        <div className="mb-4 flex justify-center">{s.icon}</div>
        <h2 className="mb-2 text-center text-lg font-bold text-foreground">{s.title}</h2>
        <p className="mb-6 text-center text-sm text-muted-foreground">{s.body}</p>
        <div className="mb-4 flex justify-center gap-1.5">
          {TOUR_STEPS.map((_, i) => (
            <button key={i} onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-blue-500' : 'w-2 bg-muted'}`} />
          ))}
        </div>
        <div className="flex gap-2">
          {step < TOUR_STEPS.length - 1 ? (
            <>
              <Button variant="ghost" className="flex-1" onClick={onDone}>Skip</Button>
              <Button className="flex-1" onClick={() => setStep(s => s + 1)}>Next</Button>
            </>
          ) : (
            <Button className="w-full" onClick={onDone}>Get started!</Button>
          )}
        </div>
      </div>
    </div>
  );
}

const SHORTCUTS = [
  { key: 'N', desc: 'New event' },
  { key: 'Esc', desc: 'Close dialog' },
  { key: '?', desc: 'Show this help' },
  { key: 'M', desc: 'Month view' },
  { key: 'W', desc: 'Week view' },
  { key: 'D', desc: 'Day view' },
];

function ShortcutsModal({ onClose }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-4" /> Keyboard shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          {SHORTCUTS.map(s => (
            <div key={s.key} className="flex items-center justify-between text-sm">
              <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">{s.key}</kbd>
              <span className="text-muted-foreground">{s.desc}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const Calendar = ({ visibleFriends = [], user }) => {
  const userTz = user?.timezone || 'UTC';
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState(() => makeInitialForm(userTz));
  const [selectedId, setSelectedId] = useState(null);
  const [invites, setInvites] = useState([]);
  const [showBell, setShowBell] = useState(false);
  const [hoveredTip, setHoveredTip] = useState(null);
  const [formConflicts, setFormConflicts] = useState([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const lastInviteCount = useRef(null);
  const calRef = useRef(null);

  const { connected, subscribe } = useWebSocket();

  useEffect(() => {
    if (!localStorage.getItem(ONBOARDING_KEY)) setShowOnboarding(true);
  }, []);

  const finishOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setShowOnboarding(false);
  };

  useEffect(() => {
    const handler = (e) => {
      if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
      if (e.metaKey || e.ctrlKey) return;
      switch (e.key) {
        case 'n': case 'N':
          if (!showModal) openNewEventModal();
          break;
        case 'Escape':
          if (showModal) closeModal();
          if (showBell) setShowBell(false);
          if (showShortcuts) setShowShortcuts(false);
          break;
        case '?':
          setShowShortcuts(v => !v);
          break;
        case 'm': case 'M':
          calRef.current?.getApi().changeView('dayGridMonth');
          break;
        case 'w': case 'W':
          calRef.current?.getApi().changeView('timeGridWeek');
          break;
        case 'd': case 'D':
          calRef.current?.getApi().changeView('timeGridDay');
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showModal, showBell, showShortcuts]);

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === 'calendar_event') {
        const { action, event: ev } = msg;
        if (action === 'created') {
          if (ev.organizer_id === user?.id) {
            setEvents(prev => prev.some(e => String(e.id) === String(ev.id)) ? prev : [...prev, toFcEvent(ev)]);
          } else if (visibleFriends.includes(ev.organizer_id)) {
            setEvents(prev => prev.some(e => e.id === `friend-${ev.id}`) ? prev : [...prev, toFriendFcEvent(ev)]);
          }
        } else if (action === 'updated') {
          if (ev.organizer_id === user?.id) {
            setEvents(prev => prev.map(e => String(e.id) === String(ev.id) ? toFcEvent(ev) : e));
            toast.info('Calendar updated', { description: `"${ev.title}" was changed`, duration: 2500 });
          } else if (visibleFriends.includes(ev.organizer_id)) {
            setEvents(prev => prev.map(e => e.id === `friend-${ev.id}` ? toFriendFcEvent(ev) : e));
          }
        } else if (action === 'deleted') {
          if (ev.organizer_id === user?.id) {
            setEvents(prev => prev.filter(e => String(e.id) !== String(ev.id)));
          } else {
            setEvents(prev => prev.filter(e => e.id !== `friend-${ev.id}`));
          }
        }
        return;
      }
      if (msg.type === 'invite' && msg.action === 'created') {
        setInvites(prev => {
          if (prev.some(i => i.id === msg.id)) return prev;
          toast('New event invite', { description: msg.event_title });
          return [...prev, {
            id: msg.id, event_id: msg.event_id,
            event_title: msg.event_title, event_start: msg.event_start,
            event_end: msg.event_end, organizer_username: msg.organizer_username,
            status: 'pending',
          }];
        });
      }
    });
    return unsub;
  }, [subscribe, user?.id, visibleFriends]);

  useEffect(() => { fetchEvents(); fetchInvites(); }, [visibleFriends]);
  useEffect(() => { const t = setInterval(fetchInvites, 60000); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (!formData.start_date || !formData.end_date) { setFormConflicts([]); return; }
    const tz = formData.timezone || userTz;
    try {
      const s = fromZonedTime(formData.start_date, tz);
      const e = fromZonedTime(formData.end_date, tz);
      setFormConflicts(detectConflicts(s, e, events, selectedId));
    } catch { setFormConflicts([]); }
  }, [formData.start_date, formData.end_date, formData.timezone, events, selectedId, userTz]);

  const fetchEvents = async () => {
    try {
      const res = await axios.get('/api/events/');
      let all = res.data.map(toFcEvent);
      if (visibleFriends.length > 0) {
        try {
          const fr = await axios.get(`/api/events/?owner_id__in=${visibleFriends.join(',')}`);
          all = [...all, ...fr.data.map(toFriendFcEvent)];
        } catch { /* non-critical */ }
      }
      setEvents(all);
    } catch (err) { console.error('fetchEvents:', err); }
  };

  const fetchInvites = async () => {
    try {
      const res = await axios.get('/api/events/invites/');
      const pending = res.data.filter(i => i.status === 'pending');
      if (lastInviteCount.current !== null && pending.length > lastInviteCount.current) {
        toast(pending.length - lastInviteCount.current === 1 ? 'New event invite' : `${pending.length - lastInviteCount.current} new event invites`);
      }
      lastInviteCount.current = pending.length;
      setInvites(pending);
    } catch (err) { console.error('fetchInvites:', err); }
  };

  const openNewEventModal = (dateStr = null) => {
    setSelectedId(null);
    const ds = dateStr || new Date().toISOString().slice(0,10);
    setFormData({ ...makeInitialForm(userTz), start_date: `${ds}T10:00`, end_date: `${ds}T11:00` });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSubmitting(false);
    setSelectedId(null);
    setFormData(makeInitialForm(userTz));
    setFormConflicts([]);
  };

  const handleDateClick = (arg) => openNewEventModal(arg.dateStr);

  const handleEventClick = (info) => {
    const ev = info.event;
    if (ev.extendedProps?.isFriendEvent) return;
    const evTz = ev.extendedProps.timezone || userTz;
    setSelectedId(ev.id);
    setFormData({
      title: ev.title, timezone: evTz,
      start_date: formatForInput(ev.start, evTz),
      end_date: formatForInput(ev.end || ev.start, evTz),
      priority: ev.extendedProps.priority || 1,
      description: ev.extendedProps.description || '',
      location: ev.extendedProps.location || '',
      shared_with: ev.extendedProps.shared_with
        ? (Array.isArray(ev.extendedProps.shared_with) ? ev.extendedProps.shared_with.join(', ') : ev.extendedProps.shared_with)
        : '',
    });
    setShowModal(true);
  };

  const handleInputChange = (e) => setFormData(f => ({ ...f, [e.target.name]: e.target.value }));

  const startDate = formData.start_date ? new Date(formData.start_date) : null;
  const endDate   = formData.end_date   ? new Date(formData.end_date)   : null;
  const hasInvalidRange  = Boolean(startDate && endDate && startDate >= endDate);
  const isFormIncomplete = !formData.title.trim() || !formData.start_date || !formData.end_date;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isFormIncomplete || hasInvalidRange || isSubmitting) return;
    setSubmitting(true);
    try {
      const tz = formData.timezone || userTz;
      const payload = {
        title: formData.title,
        description: formData.description,
        location: formData.location,
        start_date: fromZonedTime(formData.start_date, tz).toISOString(),
        end_date:   fromZonedTime(formData.end_date,   tz).toISOString(),
        timezone: tz,
        priority: formData.priority,
      };
      let eventId = selectedId;
      if (selectedId) {
        const res = await axios.put(`/api/events/${selectedId}/`, payload);
        setEvents(prev => prev.map(ev => String(ev.id) === String(selectedId) ? toFcEvent(res.data) : ev));
      } else {
        const res = await axios.post('/api/events/', payload);
        eventId = res.data.id;
        setEvents(prev => [...prev, toFcEvent(res.data)]);
      }
      const toInvite = formData.shared_with
        ? formData.shared_with.split(',').map(n => n.trim()).filter(Boolean) : [];
      for (const username of toInvite) {
        try { await axios.post('/api/events/invites/send/', { event_id: eventId, username }); }
        catch (err) { console.error('invite failed for', username, err.response?.data); }
      }
      toast.success(selectedId ? 'Event updated' : 'Event created');
      closeModal();
    } catch (err) {
      console.error('save event:', err.response?.data || err);
      toast.error("Failed to save event.");
    } finally { setSubmitting(false); }
  };

  const handleEventDrop = async (info) => {
    try {
      await axios.put(`/api/events/${info.event.id}/`, {
        title: info.event.title,
        start_date: info.event.start.toISOString(),
        end_date: (info.event.end || info.event.start).toISOString(),
      });
      toast.success('Event moved');
    } catch { toast.error("Couldn't move that event."); info.revert(); }
  };

  const handleEventResize = async (info) => {
    try {
      await axios.put(`/api/events/${info.event.id}/`, {
        title: info.event.title,
        start_date: info.event.start.toISOString(),
        end_date: info.event.end.toISOString(),
      });
      toast.success('Event updated');
    } catch { toast.error("Couldn't resize that event."); info.revert(); }
  };

  const handleEventMount = (info) => {
    const show = () => {
      const r = info.el.getBoundingClientRect();
      setHoveredTip({ top: r.top, left: r.left + r.width / 2, ...buildTooltip(info.event) });
    };
    const hide = () => setHoveredTip(c => c?.eventId === info.event.id ? null : c);
    info.el.addEventListener('mouseenter', show);
    info.el.addEventListener('mouseleave', hide);
    info.el._show = show; info.el._hide = hide;
  };

  const handleEventWillUnmount = (info) => {
    if (info.el._show) info.el.removeEventListener('mouseenter', info.el._show);
    if (info.el._hide) info.el.removeEventListener('mouseleave', info.el._hide);
    setHoveredTip(c => c?.eventId === info.event.id ? null : c);
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await axios.delete(`/api/events/${selectedId}/`);
      setEvents(prev => prev.filter(ev => String(ev.id) !== String(selectedId)));
      toast.success('Event deleted');
      closeModal();
    } catch { toast.error("Couldn't delete the event."); }
  };

  const handleInviteResponse = async (inviteId, status) => {
    try {
      await axios.post(`/api/events/invites/${inviteId}/respond/`, { status });
      setInvites(prev => prev.filter(i => i.id !== inviteId));
      if (status === 'accepted') fetchEvents();
    } catch { toast.error(`Couldn't ${status === 'accepted' ? 'accept' : 'decline'} the invite.`); }
  };

  const formatInviteTime = (ds) =>
    formatInTz(toZonedTime(ds, user?.timezone || 'UTC'), 'MMM d • h:mm a', { timeZone: user?.timezone || 'UTC' });

  const hasInviteConflict = (s, e) => {
    const ns = new Date(s), ne = new Date(e);
    return events.some(ev => {
      const es = new Date(ev.start), ee = ev.end ? new Date(ev.end) : es;
      return ns < ee && es < ne;
    });
  };

  const getDayCellClass = (arg) => {
    if (arg.view.type !== 'dayGridMonth' || arg.isOther || !isSameOrAfterToday(arg.date)) return [];
    return events.some(ev => eventOverlapsDate(ev, arg.date)) ? [] : ['sync-empty-day'];
  };

  const zonesForPicker = (() => {
    const seen = new Set([userTz, formData.timezone].filter(Boolean));
    COMMON_ZONES.forEach(z => seen.add(z));
    return [...seen];
  })();

  return (
    <div className="relative">
      {showOnboarding && <OnboardingModal onDone={finishOnboarding} />}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      <EventHoverTooltip tooltip={hoveredTip} />

      <div className="absolute right-0 top-0 z-20 flex h-[38px] items-center gap-2">
        <button
          title={connected ? 'Live — click for shortcuts' : 'Reconnecting…'}
          onClick={() => setShowShortcuts(true)}
          className="flex items-center gap-1 rounded px-1 hover:bg-muted"
        >
          {connected
            ? <Wifi className="size-4 text-green-500" />
            : <WifiOff className="size-4 text-muted-foreground animate-pulse" />}
        </button>
        <ThemeToggle />
        <div className="relative">
          <Button variant="outline" size="icon" className="relative rounded-full"
            onClick={() => setShowBell(v => !v)}>
            <Bell className="size-5 text-muted-foreground" />
            {invites.length > 0 && (
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {invites.length}
              </span>
            )}
          </Button>
          {showBell && (
            <div className="absolute right-0 top-12 z-50 w-80 rounded-md border bg-popover p-2 shadow-lg">
              <h3 className="mb-2 px-2 text-sm font-semibold text-foreground">Pending Invites</h3>
              {invites.length === 0 ? (
                <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                  <TextGenerateEffect words="No new invites" />
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
                  {invites.map(inv => (
                    <div key={inv.id} className="flex flex-col rounded-lg border bg-muted/20 p-3 text-sm shadow-sm hover:bg-muted/40">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 pr-2">
                          <p className="font-semibold text-foreground truncate">{inv.event_title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            From: <span className="font-medium text-blue-600 dark:text-blue-400">@{inv.organizer_username}</span>
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="icon" variant="ghost"
                            className="h-7 w-7 text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/50"
                            onClick={() => handleInviteResponse(inv.id, 'accepted')}>
                            <Check className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost"
                            className="h-7 w-7 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/50"
                            onClick={() => handleInviteResponse(inv.id, 'declined')}>
                            <X className="size-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1">
                        <p className="flex items-center text-xs text-muted-foreground">
                          <Clock3 className="mr-1.5 size-3.5" />
                          {formatInviteTime(inv.event_start)}
                        </p>
                        {hasInviteConflict(inv.event_start, inv.event_end) && (
                          <p className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800 dark:bg-red-900/30 dark:text-red-200 w-fit">
                            <AlertTriangle className="size-3" /> Time Conflict
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <FullCalendar
        ref={calRef}
        timeZone={userTz}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{ left: 'title', center: 'dayGridMonth,timeGridWeek,timeGridDay', right: 'prev,next today' }}
        events={events}
        dateClick={handleDateClick}
        dayCellClassNames={getDayCellClass}
        eventClick={handleEventClick}
        eventDidMount={handleEventMount}
        eventWillUnmount={handleEventWillUnmount}
        editable={true}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        height="75vh"
        eventDisplay="block"
      />

      <Dialog open={showModal} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="p-0 sm:max-w-md overflow-visible">
          <DialogHeader className="px-6 pt-5 pb-1 text-center">
            <DialogTitle className="text-lg font-semibold">
              {selectedId ? 'Edit event' : 'New event'}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Block out some time on your calendar.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="grid">
            <div className="grid gap-4 px-6 pb-5">

              <div className="grid gap-1.5">
                <Label htmlFor="title" className="text-sm font-medium">Event title</Label>
                <Input id="title" name="title" value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Study group, office hours, dinner plans"
                  className="h-10 bg-muted/50" required />
              </div>

              <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="start_date" className="flex items-center gap-1.5 text-sm font-medium">
                    <CalendarDays className="size-3.5 text-muted-foreground" /> Start
                  </Label>
                  <Input id="start_date" type="datetime-local" name="start_date"
                    value={formData.start_date} onChange={handleInputChange} className="h-10" required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="end_date" className="flex items-center gap-1.5 text-sm font-medium">
                    <Clock3 className="size-3.5 text-muted-foreground" /> End
                  </Label>
                  <Input id="end_date" type="datetime-local" name="end_date"
                    value={formData.end_date} onChange={handleInputChange} className="h-10" required />
                </div>
              </div>

              {formConflicts.length > 0 && !hasInvalidRange && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-medium">Scheduling conflict</p>
                    <p className="text-xs mt-0.5">Overlaps with: {formConflicts.map(c => `"${c.title}"`).join(', ')}</p>
                  </div>
                </div>
              )}

              <div className="grid gap-1.5">
                <Label htmlFor="location" className="text-sm font-medium">Location</Label>
                <Input id="location" name="location" value={formData.location}
                  onChange={handleInputChange} placeholder="Zoom, library, dining hall" className="h-10" />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                <Input id="description" name="description" value={formData.description}
                  onChange={handleInputChange} placeholder="Any extra details" className="h-10" />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-sm font-medium">Share with Friends</Label>
                <FriendShareSelector value={formData.shared_with} onChange={handleInputChange} />
                <p className="text-[0.8rem] text-muted-foreground">
                  Invited friends will receive a notification instantly.
                </p>
              </div>

              {hasInvalidRange && (
                <p className="text-sm text-red-500">End time must be after the start time.</p>
              )}
            </div>

            <div className="flex items-center justify-between border-t bg-muted/20 px-6 py-3">
              <div>
                {selectedId && (
                  <Button type="button" variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={closeModal} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting || isFormIncomplete || hasInvalidRange}>
                  {isSubmitting
                    ? <><LoaderCircle className="size-4 animate-spin mr-1" />Saving…</>
                    : (selectedId ? 'Update' : 'Save event')}
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
