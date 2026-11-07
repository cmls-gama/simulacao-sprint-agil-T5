const jwt = require('jsonwebtoken');

const SEGREDO_TESTE = 'segredo-fixo-apenas-para-testes';
const EXPIRACAO_PADRAO = 3600;

function getSecret() {
  const segredo = process.env.JWT_SECRET;
  if (segredo) return segredo;
  if (process.env.NODE_ENV === 'test') return SEGREDO_TESTE;
  throw new Error('JWT_SECRET não definido. Configure a variável de ambiente.');
}

function getExpiresIn() {
  const bruto = process.env.JWT_EXPIRES_IN_SECONDS;
  if (bruto === undefined || bruto === '') return EXPIRACAO_PADRAO;
  const n = Number(bruto);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error('JWT_EXPIRES_IN_SECONDS deve ser um inteiro positivo.');
  }
  return n;
}

// Falha rápido na inicialização.
function validarConfig() {
  getSecret();
  getExpiresIn();
}

function assinar({ email, role }) {
  const expiresIn = getExpiresIn();
  const token = jwt.sign({ sub: email, email, role }, getSecret(), {
    algorithm: 'HS256',
    expiresIn,
  });
  return { token, expiresIn };
}

function verificar(token) {
  return jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
}

module.exports = { validarConfig, assinar, verificar, getSecret };
