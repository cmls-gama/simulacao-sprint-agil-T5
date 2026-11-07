const { Router } = require('express');
const auth = require('../middlewares/auth');
// const roomsService = require('../services/rooms.service');

const router = Router();

// GET /salas/disponibilidade
router.get('/disponibilidade', auth, (req, res) => {
  res.status(501).json({ erro: 'Não implementado' });
});

module.exports = router;
