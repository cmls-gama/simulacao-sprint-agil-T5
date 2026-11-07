const store = require('../repositories/memory.store');
const { ErroApp } = require('../utils/erros');
const { validarSala } = require('../utils/validators');
const { ehDataValida } = require('../utils/datas');

const FUSO = 'America/Sao_Paulo';

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

// Agenda de uma sala em uma data (somente leitura).
function consultarDisponibilidade(idParam, dataParam) {
  const sala =
    typeof idParam === 'string' && /^[1-9]d*$/.test(idParam)
      ? store.buscarSalaPorId(Number(idParam))
      : undefined;
  if (!sala || sala.ativa === false || sala.ativo === false) {
    throw new ErroApp(404, 'SALA_NAO_ENCONTRADA', 'Sala não encontrada ou inativa.');
  }

  if (typeof dataParam !== 'string' || !ehDataValida(dataParam)) {
    throw new ErroApp(400, 'DADOS_INVALIDOS', 'Dados inválidos.', [
      { campo: 'data', mensagem: 'Informe uma data válida no formato AAAA-MM-DD.' },
    ]);
  }

  const reservas = store
    .listarReservasPorSalaEData(sala.id, dataParam)
    .filter((r) => r.status !== 'cancelada')
    .sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : a.fim < b.fim ? -1 : a.fim > b.fim ? 1 : 0))
    .map((r) => ({
      id: r.id,
      inicio: r.inicio,
      fim: r.fim,
      responsavel: r.responsavel,
      titulo: r.titulo,
    }));

  return { sala: { id: sala.id, nome: sala.nome }, data: dataParam, fuso: FUSO, reservas };
}

module.exports = { listarSalas, criarSala, consultarDisponibilidade, store };
