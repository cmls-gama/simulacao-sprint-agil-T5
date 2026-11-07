const fs = require('fs');
const path = require('path');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');
const authRoutes = require('./routes/auth.routes');
const roomsRoutes = require('./routes/rooms.routes');
const bookingsRoutes = require('./routes/bookings.routes');
const { autenticar } = require('./middlewares/auth');
const { ErroApp, enviarErro } = require('./utils/erros');

const app = express();

// Rotas públicas: /login e a documentação (/docs-api).
const especificacao = YAML.parse(fs.readFileSync(path.join(__dirname, '..', 'openapi.yaml'), 'utf8'));
app.use('/docs-api', swaggerUi.serve, swaggerUi.setup(especificacao));
app.use('/login', express.json(), authRoutes);

// Tudo abaixo exige autenticação (inclusive rotas inexistentes).
app.use(autenticar);
app.use(express.json());

app.use('/salas', roomsRoutes);
app.use('/reservas', bookingsRoutes);

app.use((req, res) => {
  enviarErro(res, 404, 'ROTA_NAO_ENCONTRADA', 'Rota não encontrada.');
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof ErroApp) {
    return enviarErro(res, err.status, err.codigo, err.message, err.campos);
  }
  if (err && err.type === 'entity.parse.failed') {
    return enviarErro(res, 400, 'DADOS_INVALIDOS', 'Corpo da requisição inválido.', [
      { campo: 'corpo', mensagem: 'JSON malformado.' },
    ]);
  }
  return enviarErro(res, 500, 'ERRO_INTERNO', 'Erro interno do servidor.');
});

module.exports = app;
