const { Router } = require('express');
const { enviarErro } = require('../utils/erros');
const { exigirPerfil } = require('../middlewares/auth');
const roomsService = require('../services/rooms.service');

const router = Router();

// GET /salas (admin e funcionario; autenticação global em app.js)
router.get('/', exigirPerfil('admin', 'funcionario'), (req, res, next) => {
  try {
    res.status(200).json(roomsService.listarSalas());
  } catch (err) {
    next(err);
  }
});

// POST /salas (somente admin)
router.post('/', exigirPerfil('admin'), (req, res, next) => {
  try {
    res.status(201).json(roomsService.criarSala(req.body));
  } catch (err) {
    next(err);
  }
});

// GET /salas/disponibilidade (outro card)
router.get('/disponibilidade', (req, res) => {
  enviarErro(res, 501, 'NAO_IMPLEMENTADO', 'Não implementado.');
});

module.exports = router;
