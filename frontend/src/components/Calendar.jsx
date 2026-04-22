import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
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

// attach auth token to every request so the backend knows who we are
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

// converts a Date object to the format datetime-local inputs expect
const formatForInput = (dateObj) => {
  if (!dateObj) return '';
  return new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
};

const initialFormData = {
  title: '',
  start_date: '',
  end_date: '',
  priority: 1,
  description: '',
  location: '',
  shared_with: ''
};

const Calendar = ({ visibleFriends = [] }) => {
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [selectedEventId, setSelectedEventId] = useState(null);

  // pull events whenever the component loads or visible friends change
  useEffect(() => {
    fetchEvents();
  }, [visibleFriends]);

  const fetchEvents = async () => {
    try {
      const response = await axios.get('/api/events/', { withCredentials: true });
      let formattedEvents = response.data.map(event => ({
        id: event.id,
        title: event.title,
        start: event.start_date,
        end: event.end_date,
      }));

      // if we have friends toggled on, grab their events too
      if (visibleFriends.length > 0) {
        try {
          const friendResponse = await axios.get(`/api/events/?owner_id__in=${visibleFriends.join(',')}`, { withCredentials: true });
          const friendEvents = friendResponse.data.map(event => ({
            id: `friend-${event.id}`,
            title: `busy (@${event.organizer})`,
            start: event.start_date,
            end: event.end_date,
            backgroundColor: '#ed8936',
            borderColor: '#dd6b20',
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

  const resetForm = () => {
    setFormData(initialFormData);
    setSelectedEventId(null);
  };

  // clicking an empty date opens the modal for a new event
  const handleDateClick = (arg) => {
    setSelectedEventId(null);
    setFormData({
      ...initialFormData,
      start_date: `${arg.dateStr}T10:00`,
      end_date: `${arg.dateStr}T11:00`
    });
    setShowModal(true);
  };

  // clicking an existing event opens the modal pre-filled for editing
  const handleEventClick = (info) => {
    const event = info.event;
    setSelectedEventId(event.id);
    setFormData({
      title: event.title,
      start_date: formatForInput(event.start),
      end_date: formatForInput(event.end || event.start),
      priority: event.extendedProps.priority || 1,
      description: event.extendedProps.description || '',
      location: event.extendedProps.location || '',
      shared_with: event.extendedProps.shared_with ? event.extendedProps.shared_with.join(', ') : ''
    });
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

    if (isFormIncomplete || hasInvalidRange || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        shared_with: formData.shared_with.split(',').map(id => id.trim()).filter(id => id !== '')
      };

      if (selectedEventId) {
        // updating an existing event
        const response = await axios.put(`/api/events/${selectedEventId}/`, payload);
        const updatedEvent = response.data;
        setEvents(events.map(ev => ev.id === updatedEvent.id ? {
          id: updatedEvent.id,
          title: updatedEvent.title,
          start: updatedEvent.start_date,
          end: updatedEvent.end_date,
        } : ev));
      } else {
        // creating a brand new event
        const response = await axios.post('/api/events/', payload);
        const newEvent = response.data;
        setEvents([...events, {
          id: newEvent.id,
          title: newEvent.title,
          start: newEvent.start_date,
          end: newEvent.end_date,
        }]);
      }
      closeModal();
    } catch (error) {
      console.error("Error saving event:", error);
      alert("Failed to save event. Make sure Django is running!");
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

  return (
    <div className="relative">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a2744]">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tap any date to add something</p>
        </div>
      </div>

      <FullCalendar
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
