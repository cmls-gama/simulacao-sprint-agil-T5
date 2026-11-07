const express = require('express');
const roomsRoutes = require('./routes/rooms.routes');
const bookingsRoutes = require('./routes/bookings.routes');

const app = express();

app.use(express.json());

app.use('/salas', roomsRoutes);
app.use('/reservas', bookingsRoutes);

module.exports = app;
