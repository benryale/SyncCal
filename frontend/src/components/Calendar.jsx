import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
// import axios from 'axios';

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

      {/* The Popup Form */}
      {showModal && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3>Add New Event</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label>Event Title</label>
              <input type="text" name="title" value={formData.title} onChange={handleInputChange} required />

              <label>Start Time</label>
              <input type="datetime-local" name="start_date" value={formData.start_date} onChange={handleInputChange} required />

              <label>End Time</label>
              <input type="datetime-local" name="end_date" value={formData.end_date} onChange={handleInputChange} required />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px' }}>
                <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit">Save Event</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple inline styles for the modal
const modalOverlayStyle = {
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000
};

const modalContentStyle = {
  backgroundColor: 'white',
  padding: '20px',
  borderRadius: '8px',
  width: '300px',
  boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
};

export default Calendar;