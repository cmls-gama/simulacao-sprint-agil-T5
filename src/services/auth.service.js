const { ErroApp } = require('../utils/erros');
const { analisarEmail, resolverPerfil } = require('../utils/email');
const { assinar } = require('../utils/jwt');

function dadosInvalidos(mensagem) {
  return new ErroApp(400, 'DADOS_INVALIDOS', 'Dados inválidos.', [{ campo: 'email', mensagem }]);
}

function login(email) {
  if (typeof email !== 'string' || email.trim() === '') {
    throw dadosInvalidos('O e-mail é obrigatório e deve ser um texto.');
  }

  const analisado = analisarEmail(email);
  if (!analisado) throw dadosInvalidos('Formato de e-mail inválido.');

  const role = resolverPerfil(analisado.dominio);
  if (!role) {
    throw new ErroApp(401, 'CREDENCIAIS_INVALIDAS', 'Credenciais inválidas.');
  }

  const { token, expiresIn } = assinar({ email: analisado.email, role });
  return { token, tipo: 'Bearer', expiraEm: expiresIn };
}

module.exports = { login };
