const { Router } = require('express');
const { enviarErro } = require('../utils/erros');

const router = Router();

// POST /reservas (autenticação aplicada globalmente em app.js)
router.post('/', (req, res) => {
  enviarErro(res, 501, 'NAO_IMPLEMENTADO', 'Não implementado.');
});

// DELETE /reservas/:id
router.delete('/:id', (req, res) => {
  enviarErro(res, 501, 'NAO_IMPLEMENTADO', 'Não implementado.');
});

module.exports = router;
