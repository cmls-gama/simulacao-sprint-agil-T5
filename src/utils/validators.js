// Validação de datas e campos.
function isDataValida(valor) {
  return !Number.isNaN(Date.parse(valor));
}

function intervaloValido(inicio, fim) {
  return isDataValida(inicio) && isDataValida(fim) && new Date(inicio) < new Date(fim);
}

module.exports = { isDataValida, intervaloValido };
