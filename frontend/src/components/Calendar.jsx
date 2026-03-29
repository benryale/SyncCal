import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
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

const initialFormData = {
  title: '',
  start_date: '',
  end_date: ''
};

const Calendar = () => {
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(initialFormData);

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

  const resetForm = () => {
    setFormData(initialFormData);
  };

  const handleDateClick = (arg) => {
    setFormData({
      title: '',
      start_date: `${arg.dateStr}T10:00`,
      end_date: `${arg.dateStr}T11:00`
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isFormIncomplete || hasInvalidRange || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

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
      closeModal();
    } catch (error) {
      console.error("Error creating event:", error);
      alert("Failed to save event. Make sure Django is running!");
      setIsSubmitting(false);
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
              New event
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Add an event to your calendar.
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
                  placeholder="Weekly sync, office hours, project review"
                  className="h-10 bg-muted/50"
                  required
                />
              </div>

              <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
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

              {formError && (
                <p className="text-sm text-red-500">{formError}</p>
              )}
            </div>

            <div className="flex items-center justify-between border-t px-6 py-3">
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
                  'Save event'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Calendar;
