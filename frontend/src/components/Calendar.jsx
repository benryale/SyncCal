import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import axios from 'axios';

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

const Calendar = () => {
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    start_date: '',
    end_date: ''
  });

  // Fetch events on load
  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/events/');
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

  // Open modal and pre-fill dates when a day is clicked
  const handleDateClick = (arg) => {
    setFormData({
      title: '',
      start_date: `${arg.dateStr}T10:00`, 
      end_date: `${arg.dateStr}T11:00`
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
      const response = await axios.post('http://127.0.0.1:8000/api/events/', {
        ...formData,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        priority: 1
      });

      const newEvent = response.data;
      setEvents([...events, {
        id: newEvent.id,
        title: newEvent.title,
        start: newEvent.start_date,
        end: newEvent.end_date,
      }]);
      setShowModal(false);
    } catch (error) {
      console.error("Error creating event:", error);
      alert("Failed to save event. Make sure Django is running!");
    }
  };

  return (
    <div style={{ position: 'relative', marginTop: '20px' }}>
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}
        dateClick={handleDateClick}
        height="75vh"
      />

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Event</DialogTitle>
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

            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Event</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Calendar;
