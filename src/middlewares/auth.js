const { enviarErro } = require('../utils/erros');
const { PERFIS } = require('../utils/email');
const { verificar } = require('../utils/jwt');

function naoAutenticado(res) {
  res.set('WWW-Authenticate', 'Bearer');
  return enviarErro(res, 401, 'NAO_AUTENTICADO', 'Autenticação necessária ou token inválido.');
}

const ehTextoNaoVazio = (v) => typeof v === 'string' && v.trim() !== '';

function autenticar(req, res, next) {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return naoAutenticado(res);

  const [esquema, token, ...resto] = header.split(' ');
  if (esquema !== 'Bearer' || !token || resto.length > 0) return naoAutenticado(res);

  let payload;
  try {
    payload = verificar(token);
  } catch (err) {
    return naoAutenticado(res);
  }

  if (
    !payload ||
    !ehTextoNaoVazio(payload.sub) ||
    !ehTextoNaoVazio(payload.email) ||
    !PERFIS.includes(payload.role)
  ) {
    return naoAutenticado(res);
  }

  req.user = { id: payload.email, email: payload.email, role: payload.role };
  return next();
}

// Uso: router.post('/', exigirPerfil('admin'), ...)
function exigirPerfil(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return enviarErro(res, 403, 'SEM_PERMISSAO', 'Você não tem permissão para executar esta operação.');
    }
    return next();
  };
}

module.exports = { autenticar, exigirPerfil };
