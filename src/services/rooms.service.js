const store = require('../repositories/memory.store');
const { ErroApp } = require('../utils/erros');
const { validarSala } = require('../utils/validators');

// Regras de disponibilidade de salas.
function listarDisponibilidade(/* inicio, fim */) {
  throw new Error('Não implementado');
}

function listarSalas() {
  return store.salas.map((s) => ({ ...s, recursos: [...s.recursos] }));
}

// Totalmente síncrono: verifica duplicidade, gera id e salva sem await no meio.
function criarSala(corpo) {
  const { campos, dados } = validarSala(corpo);
  if (campos.length > 0) {
    throw new ErroApp(400, 'DADOS_INVALIDOS', 'Dados inválidos.', campos);
  }

  const chave = dados.nome.toLowerCase();
  if (store.salas.some((s) => s.nome.toLowerCase() === chave)) {
    throw new ErroApp(409, 'SALA_DUPLICADA', `Já existe uma sala cadastrada com o nome "${dados.nome}".`);
  }

  const sala = store.adicionarSala(dados);
  return { ...sala, recursos: [...sala.recursos] };
}

module.exports = { listarDisponibilidade, listarSalas, criarSala, store };
