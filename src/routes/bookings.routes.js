const { Router } = require('express');
const auth = require('../middlewares/auth');
// const bookingsService = require('../services/bookings.service');

const router = Router();

// POST /reservas
router.post('/', auth, (req, res) => {
  res.status(501).json({ erro: 'Não implementado' });
});

// DELETE /reservas/:id
router.delete('/:id', auth, (req, res) => {
  res.status(501).json({ erro: 'Não implementado' });
});

module.exports = router;
