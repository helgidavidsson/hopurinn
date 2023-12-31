const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors())
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000", // URL of your frontend application
        methods: ["GET", "POST"],
        allowedHeaders: ["my-custom-header"],
        credentials: true
    }
});

let participants = [];

let groupTitle = "Nafn hópar";

let groupDescription = "";

let events = [];

let globalNotificationTime = '1h'; // Default value or load from a database if persisted

io.on('connection', (socket) => {
    // Send the initial state to the newly connected client
    socket.emit('initialState', { 
        participants, 
        title: groupTitle, 
        description: groupDescription, 
        events, 
         });

    socket.emit('initialNotificationTime', { timeBefore: globalNotificationTime });


    socket.on('toggleParticipant', (data) => {
        console.log(`Toggling participant ${data.id}, isCheckedAttendance: ${data.isCheckedAttendance}`);
        const participant = participants.find(p => p.id === data.id);
        if (participant) {
            participant.isCheckedAttendance = data.isCheckedAttendance;
            console.log(`Updated isCheckedAttendance for participant ${data.id}: ${participant.isCheckedAttendance}`);
            io.emit('participantToggled', data);
        }
    });


    // Add socket event for saving group information
socket.on('saveInfo', (data) => {
    const { title, description } = data;

    groupTitle = title;
    groupDescription = description;

    console.log('Updated group information:', { groupTitle, groupDescription });
    // Optionally, you can emit an event to confirm the update
    io.emit('infoUpdated', { groupTitle, groupDescription });
});


// Assuming your participant structure now has 'isCheckedEmail' and 'isCheckedAttendance'

socket.on('toggleParticipantAttendance', (data) => {
    const participant = participants.find(p => p.id === data.id);
    if (participant) {
        participant.isCheckedAttendance = data.isCheckedAttendance;
        io.emit('participantAttendanceToggled', data);
    }
});


socket.on('saveParticipants', (data) => {
    const { rows } = data;
    const existingParticipantsMap = new Map(participants.map(p => [p.id, p]));
    console.log("data : ", data)
    participants = rows.map(row => {
        const existingParticipant = existingParticipantsMap.get(row.id);
        return {
            id: row.id,
            name: row.name,
            email: row.email,
            isCheckedEmail: row.isCheckedEmail, // Update with the new isCheckedEmail state
            isCheckedAttendance: existingParticipant ? existingParticipant.isCheckedAttendance : null, // Preserve existing isCheckedAttendance or set to null            
            comments: existingParticipant ? existingParticipant.comments : [],
        
        };
    });

    io.emit('participantsUpdated', participants);
});

socket.on('updateNotificationTime', (data) => {
    globalNotificationTime = data.timeBefore;
    
    // Optionally, you can persist this update to a database

    console.log('Updated global notification time:', globalNotificationTime);
    
    // Emit an event to update all clients with the new time
    io.emit('notificationTimeUpdated', { timeBefore: globalNotificationTime });
});


socket.on('saveComment', (data) => {
    const { participantId, comment } = data;
    const participant = participants.find(p => p.id === participantId);

    if (participant) {
        // Initialize comments array if it doesn't exist
        if (!participant.comments) {
            participant.comments = [];
        }

        // Now you can safely push the comment
        participant.comments.push(comment);
        io.emit('commentsUpdated', participants); // Update all clients
    }
});

    socket.emit('eventsUpdated', events); 

    // Helper function to generate repeated event dates

    socket.on('addEvent', (newEvent) => {
        // The newEvent object already contains all the necessary information, 
        // including dates for repeated events.
    
        // Check if the event ID is provided, if not, generate a new ID.
        const eventID = newEvent.id || Date.now().toString(36) + Math.random().toString(36).substring(2);
    
        // Push the event to the events array.
        events.push({ ...newEvent, id: eventID });
    
        // Emit the updated events to all clients.
        io.emit('eventsUpdated', events);
    });

    socket.on('editEvent', (updatedEvent) => {
        // Find the index of the event to be updated
        const index = events.findIndex(event => event.id === updatedEvent.id);
    
        // If the event is found, update it
        if (index !== -1) {
            events[index] = { ...events[index], ...updatedEvent };
        }
    
        // Emit the updated events to all clients
        io.emit('eventsUpdated', events);
    });
    
    
    

    socket.on('deleteEvent', (data) => {
        const { eventName, eventId, scope } = data;
        if (scope === 'allEvents') {
            events = events.filter(event => event.eventName !== eventName);
        } else {
            console.log("Received event ID for deletion:", eventId);
            events = events.filter(event => event.id !== eventId); // Use eventId to identify the event
        }
        io.emit('eventsUpdated', events);
    });
    
    


    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

server.listen(3001, () => {
    console.log('Server is running on port 3001');
});

