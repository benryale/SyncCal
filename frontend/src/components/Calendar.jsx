import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { ThemeToggle } from "@/components/ThemeToggle";
import {  Bell, Check, X } from 'lucide-react';
import axios from 'axios';
import { CalendarDays, Clock3, LoaderCircle } from 'lucide-react';

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
import { formatInUserTz } from "@/lib/time"
import { fromZonedTime, toZonedTime, format as formatInTz } from 'date-fns-tz'

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

// attach auth token to every request so the backend knows who we are
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

const Calendar = ({ visibleFriends = [], user }) => {
  const userTz = user?.timezone || 'UTC';
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(() => makeInitialFormData(userTz));
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [invites, setInvites] = useState([]);
  const [showInvitesList, setShowInvitesList] = useState(false);
  // tz picker hidden by default, surfaced on edit
  const [showAdvanced, setShowAdvanced] = useState(false);

  const zonesForPicker = (() => {
    const seen = new Set([userTz, formData.timezone].filter(Boolean));
    for (const z of COMMON_ZONES) seen.add(z);
    return [...seen];
  })();

  // pull events whenever the component loads or visible friends change
  useEffect(() => {
    fetchEvents();
    fetchInvites();
  }, [visibleFriends]);

  const fetchEvents = async () => {
    try {
      const response = await axios.get('/api/events/', { withCredentials: true });
      let formattedEvents = response.data.map(event => ({
        id: event.id,
        title: event.title,
        start: event.start_date,
        end: event.end_date,
        extendedProps: {
          timezone:    event.timezone,
          description: event.description,
          location:    event.location,
          priority:    event.priority,
          shared_with: event.shared_with,
        },
      }));

      // if we have friends toggled on, grab their events too
      if (visibleFriends.length > 0) {
        try {
          const friendResponse = await axios.get(`/api/events/?owner_id__in=${visibleFriends.join(',')}`, { withCredentials: true });
          const friendEvents = friendResponse.data.map(event => ({
            id: `friend-${event.id}`,
            title: `${event.title} (friend)`,
            start: event.start_date,
            end: event.end_date,
            backgroundColor: '#ed8936',
            borderColor: '#dd6b20',
            extendedProps: {
              timezone:    event.timezone,
              description: event.description,
              location:    event.location,
              priority:    event.priority,
              shared_with: event.shared_with,
            },
          }));
          formattedEvents = [...formattedEvents, ...friendEvents];
        } catch (error) {
          console.log("Could not fetch friend events");
        }
      }

      setEvents(formattedEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
    }
  };
  const fetchInvites = async () => {
    try {
      const response = await axios.get('/api/events/invites/');
      // Filter so we only see 'pending' invites in the dropdown
      const pendingInvites = response.data.filter(inv => inv.status === 'pending');
      setInvites(pendingInvites);
    } catch (error) {
      console.error("Error fetching invites:", error);
    }
  };

  // Handle Accept or Decline
  const handleInviteResponse = async (inviteId, status) => {
    try {
      await axios.post(`/api/events/invites/${inviteId}/respond/`, { status });
      
      // Remove that invite from the dropdown list
      setInvites(invites.filter(inv => inv.id !== inviteId));
      
      // If they accepted, refresh the calendar to show the new event
      if (status === 'accepted') {
        fetchEvents();
      }
    } catch (error) {
      console.error(`Failed to ${status} invite:`, error);
    }
  };

  const resetForm = () => {
    setFormData(makeInitialFormData(userTz));
    setSelectedEventId(null);
    setShowAdvanced(false);
  };

  // clicking an empty date opens the modal for a new event
  const handleDateClick = (arg) => {
    setSelectedEventId(null);
    setFormData({
      ...makeInitialFormData(userTz),
      start_date: `${arg.dateStr}T10:00`,
      end_date: `${arg.dateStr}T11:00`
    });
    setShowModal(true);
  };

  // clicking an existing event opens the modal pre-filled for editing
  const handleEventClick = (info) => {
    const event = info.event;
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

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const closeModal = () => {
    setShowModal(false);
    setIsSubmitting(false);
    resetForm();
  };

  const startDate = formData.start_date ? new Date(formData.start_date) : null;
  const endDate = formData.end_date ? new Date(formData.end_date) : null;
  const hasInvalidRange = Boolean(startDate && endDate && startDate >= endDate);
  const isFormIncomplete = !formData.title.trim() || !formData.start_date || !formData.end_date;
  const formError = hasInvalidRange ? 'End time must be after the start time.' : '';

  // handles both creating new events and updating existing ones
  const handleSubmit = async (e) => {
      e.preventDefault();
      console.log("%c >>> SUBMIT TRIGGERED <<< ", "background: #222; color: #bada55; font-size: 20px;");
      
      // Recalculate validation just to be safe
      const isFormIncompleteCheck = !formData.title.trim() || !formData.start_date || !formData.end_date;
      
      if (isFormIncompleteCheck || hasInvalidRange || isSubmitting) {
        console.warn("Validation Failed. Check required fields.");
        return;
      }

      setIsSubmitting(true);
      console.log('Passed validation. starting api calls');

      try {
        const tz = formData.timezone || userTz;
        const payload = {
          title: formData.title,
          description: formData.description,
          location: formData.location,
          start_date: fromZonedTime(formData.start_date, tz).toISOString(),
          end_date:   fromZonedTime(formData.end_date,   tz).toISOString(),
          timezone:   tz,
          priority:   formData.priority,
        };

        let currentEventId = selectedEventId;

        if (selectedEventId) {
          console.log('Attempting PUT request');
          const response = await axios.put(`/api/events/${selectedEventId}/`, payload);
          const updatedEvent = response.data;
          setEvents(events.map(ev => ev.id === updatedEvent.id ? {
            id: updatedEvent.id,
            title: updatedEvent.title,
            start: updatedEvent.start_date,
            end: updatedEvent.end_date,
          } : ev));
        } else {
          console.log('Attempting POST request');
          const response = await axios.post('/api/events/', payload);
          const newEvent = response.data;
          currentEventId = newEvent.id; 
          setEvents([...events, {
            id: newEvent.id,
            title: newEvent.title,
            start: newEvent.start_date,
            end: newEvent.end_date,
          }]);
        }
        
        console.log('Event is saved! Event id is:', currentEventId);

        // --- CRITICAL FIX: Handle the comma-separated string ---
        const usernamesToInvite = formData.shared_with
          ? formData.shared_with.split(',').map(name => name.trim()).filter(name => name !== '')
          : [];

        console.log('Parsed usernames to invite:', usernamesToInvite);

        if (usernamesToInvite.length > 0 && currentEventId) {
          for (const username of usernamesToInvite) {
            try {
              console.log(`Sending invite request for: ${username}`);
              const inviteRes = await axios.post('/api/events/invites/send/', {
                event_id: currentEventId,
                username: username
              });
              console.log(`Invite successful for ${username}:`, inviteRes.data);
            } catch (inviteError) {
              console.error(`Failed to invite ${username}:`, inviteError.response?.data || inviteError);
            }
          }
        }
        
        closeModal();
      } catch (error) {
        console.error("Error saving event:", error.response?.data || error);
        alert("Failed to save event. Check console for details.");
      } finally {
        setIsSubmitting(false); 
      }
    };

  // deletes the event we're currently looking at
  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    try {
      await axios.delete(`/api/events/${selectedEventId}/`);
      setEvents(events.filter(ev => String(ev.id) !== String(selectedEventId)));
      closeModal();
    } catch (error) {
      console.error("Error deleting event:", error);
    }
  };
  const formatInviteTime = (dateString) => formatInUserTz(dateString, user?.timezone);

  // Helper to check for scheduling conflicts
  const hasConflict = (inviteStart, inviteEnd) => {
    const newStart = new Date(inviteStart);
    const newEnd = new Date(inviteEnd);
    
    // Check against all currently loaded events
    return events.some(ev => {
      const existingStart = new Date(ev.start);
      const existingEnd = new Date(ev.end);
      // Logic for overlapping time windows
      return newStart < existingEnd && newEnd > existingStart;
    });
  };

  return (
    <div className="relative">
      <div className="mb-5 flex items-center justify-between relative">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a2744]">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tap any date to add something</p>
        </div>

        <div className="flex items-center gap-3">
          
          <ThemeToggle /> {/* toggle button */}

          <div className="relative">
            <Button 
              variant="outline" 
              size="icon" 
              className="relative rounded-full"
              onClick={() => setShowInvitesList(!showInvitesList)}
            >
              <Bell className="size-5 text-muted-foreground" />
              {invites.length > 0 && (
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {invites.length}
                </span>
              )}
            </Button>

          {showInvitesList && (
            <div className="absolute right-0 top-12 z-50 w-80 rounded-md border bg-white p-2 shadow-lg">
              <h3 className="mb-2 px-2 text-sm font-semibold text-gray-700">Pending Invites</h3>
              
              {invites.length === 0 ? (
                <p className="px-2 py-3 text-sm text-gray-500 text-center">No new invites.</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
                  {invites.map((invite) => {
                    const isConflict = hasConflict(invite.event_start, invite.event_end);
                    
                    return (
                      <div key={invite.id} className="flex flex-col rounded-lg border bg-muted/20 p-3 text-sm shadow-sm transition-colors hover:bg-muted/40">
                        
                        <div className="flex items-start justify-between">
                          <div className="flex-1 pr-2">
                            <p className="font-semibold text-gray-900 truncate">{invite.event_title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              From: <span className="font-medium text-blue-600">@{invite.organizer_username}</span>
                            </p>
                          </div>
                          
                          {/* Accept / Decline Buttons */}
                          <div className="flex gap-1 shrink-0">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:bg-green-100" onClick={() => handleInviteResponse(invite.id, 'accepted')}>
                              <Check className="size-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:bg-red-100" onClick={() => handleInviteResponse(invite.id, 'declined')}>
                              <X className="size-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-2 space-y-1.5">
                          <p className="flex items-center text-xs text-gray-600">
                            <Clock3 className="mr-1.5 size-3.5" />
                            {formatInviteTime(invite.event_start)}
                          </p>
                          
                          {/* Conflict Warning Badge */}
                          {isConflict && (
                            <p className="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800 w-fit">
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
          )}</div>
        </div>
      </div>

      <FullCalendar
        timeZone={user?.timezone || 'UTC'}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'title',
          center: 'dayGridMonth,timeGridWeek,timeGridDay',
          right: 'prev,next today'
        }}
        events={events}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        height="75vh"
        eventDisplay="block"
      />

      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          if (!open) {
            closeModal();
            return;
          }
          setShowModal(true);
        }}
      >
        <DialogContent className="overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="px-6 pt-5 pb-1 text-center">
            <DialogTitle className="text-lg font-semibold">
              {selectedEventId ? 'Edit event' : 'New event'}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Block out some time on your calendar.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="grid">
            <div className="grid gap-4 px-6 pb-5">
              <div className="grid gap-1.5">
                <Label htmlFor="title" className="text-sm font-medium">Event title</Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Study group, office hours, dinner plans"
                  className="h-10 bg-muted/50"
                  required
                />
              </div>

              <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="start_date" className="flex items-center gap-1.5 text-sm font-medium">
                    <CalendarDays className="size-3.5 text-muted-foreground" />
                    Start
                  </Label>
                  <Input
                    id="start_date"
                    type="datetime-local"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleInputChange}
                    className="h-10"
                    required
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="end_date" className="flex items-center gap-1.5 text-sm font-medium">
                    <Clock3 className="size-3.5 text-muted-foreground" />
                    End
                  </Label>
                  <Input
                    id="end_date"
                    type="datetime-local"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleInputChange}
                    className="h-10"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end -mt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(s => !s)}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  {showAdvanced ? 'Hide advanced' : 'Show advanced'}
                </button>
              </div>

              {showAdvanced && (
                <div className="grid gap-1.5 rounded-lg border bg-muted/20 p-3">
                  <Label htmlFor="timezone" className="text-sm font-medium">Anchor timezone</Label>
                  <Select
                    value={formData.timezone}
                    onValueChange={(v) => setFormData(f => ({ ...f, timezone: v }))}
                  >
                    <SelectTrigger id="timezone" className="h-9">
                      <SelectValue placeholder="Pick a timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {zonesForPicker.map(z => (
                        <SelectItem key={z} value={z}>{z}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[0.75rem] text-muted-foreground">
                    The start/end times above are interpreted in this zone. Defaults to your preference.
                  </p>
                </div>
              )}

              <div className="grid gap-1.5">
                <Label htmlFor="location" className="text-sm font-medium">Location</Label>
                <Input
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="Zoom, library, dining hall"
                  className="h-10"
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                <Input
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Any extra details"
                  className="h-10"
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="shared_with" className="text-sm font-medium">Share with Friends</Label>
                <Input
                  id="shared_with"
                  name="shared_with"
                  value={formData.shared_with}
                  onChange={handleInputChange}
                  placeholder="e.g., ben_raykhman, kevin_wang"
                  classname="h-10"
                />
                <p className="text-[0.8rem] text-muted-foreground">
                  Enter comma-separated Usernames
                </p>
              </div>

              {formError && (
                <p className="text-sm text-red-500">{formError}</p>
              )}
            </div>


            <div className="flex items-center justify-between border-t bg-muted/20 px-6 py-3">
              <div>
                {selectedEventId && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                  >
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || isFormIncomplete || hasInvalidRange}
                >
                  {isSubmitting ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    selectedEventId ? 'Update' : 'Save event'
                  )}
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
