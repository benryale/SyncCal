import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import axios from 'axios';


axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
//click handler
const formatForInput = (dateObj) => {
    if (!dateObj) return '';
    return new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
  };

const Calendar = () => {
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    start_date: '',
    end_date: '',
    priority: 1,
    description: '',
    location: '',
    shared_with: ''
  });
  const [selectedEventId, setSelectedEventId] = useState(null);

  
  // Fetch events on load
  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await axios.get('/api/events/', { withCredentials: true });
      const formattedEvents = response.data.map(event => ({
        id: event.id,
        title: event.title,
        start: event.start_date,
        end: event.end_date,
      }));
      setEvents(formattedEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
    }
  };
  //handle clicks on calendar days and events
  const handleDateClick = (arg) => {
    setSelectedEventId(null); // Clear any old ID
    setFormData({
      title: '',
      start_date: `${arg.dateStr}T10:00`, 
      end_date: `${arg.dateStr}T11:00`,
      priority: 1,
      description: '',
      location: '',
      shared_with: ''
    });
    setShowModal(true);
  };
  // Open modal and pre-fill dates when a day is clicked
  const handleEventClick = (info) => {
    const event = info.event;
    setSelectedEventId(event.id); // Remember which event we are editing
    
    setFormData({
      title: event.title,
      start_date: formatForInput(event.start),
      end_date: formatForInput(event.end || event.start),
      priority: event.extendedProps.priority ||1 ,
      description: event.extendedProps.description || '',
      location: event.extendedProps.location || '',
      shared_with: event.extendedProps.shared_with ? event.extendedProps.shared_with.join(', ') : ''

    });
    setShowModal(true);
  };

  // Handle typing in the form
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Submit the form to Django
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        shared_with: formData.shared_with.split(',').map(id => id.trim()).filter(id => id !== '') // Convert comma-separated string to array and remove empty entries
      };

      if (selectedEventId) {
        // UPDATE EXISTING (PUT)
        const response = await axios.put(`/api/events/${selectedEventId}/`, payload);
        const updatedEvent = response.data;
        setEvents(events.map(ev => ev.id === updatedEvent.id ? {
          id: updatedEvent.id, title: updatedEvent.title, start: updatedEvent.start_date, end: updatedEvent.end_date,
          priority: updatedEvent.priority,
          description: updatedEvent.description,
          location: updatedEvent.location,
          shared_with: updatedEvent.shared_with
        } : ev));
      } else {
        // CREATE NEW (POST) - This is your existing code
        const response = await axios.post('/api/events/', payload);
        const newEvent = response.data;
        setEvents([...events, {
          id: newEvent.id, title: newEvent.title, start: newEvent.start_date, end: newEvent.end_date,
          priority: newEvent.priority,
          description: newEvent.description,
          location: newEvent.location,
          shared_with: newEvent.shared_with

        }]);
      }
      setShowModal(false);
    } catch (error) {
      console.error("Error creating event:", error);
      alert("Failed to save event. Make sure Django is running!");
    }
  };
  //add handling for event deletion
  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    try {
      await axios.delete(`/api/events/${selectedEventId}/`);
      setEvents(events.filter(ev => String(ev.id) !== String(selectedEventId)));
      setShowModal(false);
    } catch (error) {
      console.error("Error deleting event:", error);
    }
  };

  return (
    <div style={{ position: 'relative', marginTop: '20px' }}>
      <FullCalendar
        plugins={[dayGridPlugin,timeGridPlugin, interactionPlugin]}
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
        eventColor="#87bbd6"
      />

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedEventId ? 'Edit Event' : 'Add New Event'}</DialogTitle>
            <DialogDescription>
              Pick a time block and save it to your calendar.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Event Title</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Team sync"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="start_date">Start Time</Label>
              <Input
                id="start_date"
                type="datetime-local"
                name="start_date"
                value={formData.start_date}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="end_date">End Time</Label>
              <Input
                id="end_date"
                type="datetime-local"
                name="end_date"
                value={formData.end_date}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="Zoom, Office, etc."
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Details about the meeting..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority (1-5)</Label>
                <Input
                  id="priority"
                  type="number"
                  name="priority"
                  min="1"
                  max="5"
                  value={formData.priority}
                  onChange={handleInputChange}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="shared_with">Share with Friend IDs</Label>
                <Input
                  id="shared_with"
                  name="shared_with"
                  value={formData.shared_with}
                  onChange={handleInputChange}
                  placeholder="e.g. 2, 5"
                />
              </div>
            </div>

            <DialogFooter className="mt-2 sm:justify-between">
              {selectedEventId ? (
                <Button type="button" variant="destructive" onClick={handleDelete}>
                  Delete
                </Button>
              ) : (
                <div /> //spacing element to keep buttons aligned when "Delete" is not shown
              )}
              
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {selectedEventId ? 'Update' : 'Save Event'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Calendar;
