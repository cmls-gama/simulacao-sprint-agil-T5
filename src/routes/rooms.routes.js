const { Router } = require('express');
const { enviarErro } = require('../utils/erros');

const router = Router();

// GET /salas/disponibilidade (autenticação aplicada globalmente em app.js)
router.get('/disponibilidade', (req, res) => {
  enviarErro(res, 501, 'NAO_IMPLEMENTADO', 'Não implementado.');
});

module.exports = router;
