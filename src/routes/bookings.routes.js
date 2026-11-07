const { Router } = require('express');
const { enviarErro } = require('../utils/erros');
const { exigirPerfil } = require('../middlewares/auth');
const bookingsService = require('../services/bookings.service');

const router = Router();

// POST /reservas (autenticação aplicada globalmente em app.js)
router.post('/', exigirPerfil('admin', 'funcionario'), (req, res, next) => {
  try {
    const reserva = bookingsService.criarReserva(req.body, req.user);
    return res.status(201).json(reserva);
  } catch (err) {
    return next(err);
  }
});

// DELETE /reservas/:id
router.delete('/:id', (req, res) => {
  enviarErro(res, 501, 'NAO_IMPLEMENTADO', 'Não implementado.');
});

module.exports = router;
