const store = require('../repositories/memory.store');

// Regra de conflito (sobreposição de horários) e cancelamento.
function criarReserva(/* dados */) {
  throw new Error('Não implementado');
}

function cancelarReserva(/* id, usuario */) {
  throw new Error('Não implementado');
}

module.exports = { criarReserva, cancelarReserva, store };
