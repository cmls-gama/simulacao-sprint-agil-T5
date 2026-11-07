require('dotenv').config();
const { validarConfig } = require('./utils/jwt');

validarConfig(); // falha rápido se JWT_SECRET estiver ausente

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
