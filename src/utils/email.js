// Único local que define quais domínios corporativos existem e seus perfis.
const DOMINIOS_PERFIS = Object.freeze({
  'admin.com': 'admin',
  'funcionario.com': 'funcionario',
});

const PERFIS = Object.freeze(Object.values(DOMINIOS_PERFIS));

const LOCAL_REGEX = /^[a-z0-9._%+-]+$/;

function normalizarEmail(valor) {
  return String(valor).trim().toLowerCase();
}

// Retorna { email, local, dominio } se o formato é válido; senão null.
function analisarEmail(valor) {
  if (typeof valor !== 'string') return null;
  const email = normalizarEmail(valor);
  const partes = email.split('@');
  if (partes.length !== 2) return null;
  const [local, dominio] = partes;
  if (!LOCAL_REGEX.test(local)) return null;
  if (!dominio || /\s/.test(dominio)) return null;
  return { email, local, dominio };
}

// Correspondência EXATA do domínio (sem sufixos/subdomínios).
function resolverPerfil(dominio) {
  return Object.prototype.hasOwnProperty.call(DOMINIOS_PERFIS, dominio)
    ? DOMINIOS_PERFIS[dominio]
    : null;
}

module.exports = { DOMINIOS_PERFIS, PERFIS, normalizarEmail, analisarEmail, resolverPerfil };
