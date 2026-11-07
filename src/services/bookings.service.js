const store = require('../repositories/memory.store');
const { randomUUID } = require('crypto');
const { ErroApp } = require('../utils/erros');

function dadosInvalidos(campos) {
  return new ErroApp(400, 'DADOS_INVALIDOS', 'Dados inválidos.', campos);
}

function dataValida(data) {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const dataUtc = new Date(`${data}T00:00:00Z`);
  return !Number.isNaN(dataUtc.getTime()) && dataUtc.toISOString().slice(0, 10) === data;
}

function dataHoraAtualBrasilia() {
  const partes = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const valores = Object.fromEntries(partes.map(({ type, value }) => [type, value]));
  return { data: `${valores.year}-${valores.month}-${valores.day}`, hora: `${valores.hour}:${valores.minute}` };
}

function criarReserva(dados, usuario) {
  const campos = [];
  const entrada = dados && typeof dados === 'object' && !Array.isArray(dados) ? dados : {};
  const { salaId, data, inicio, fim, titulo } = entrada;

  if (salaId === undefined || salaId === null || salaId === '') {
    campos.push({ campo: 'salaId', mensagem: 'O identificador da sala é obrigatório.' });
  } else if (!Number.isInteger(Number(salaId)) || Number(salaId) <= 0) {
    campos.push({ campo: 'salaId', mensagem: 'Informe um identificador de sala válido.' });
  }

  if (data === undefined || data === null || data === '') {
    campos.push({ campo: 'data', mensagem: 'A data é obrigatória.' });
  } else if (!dataValida(data)) {
    campos.push({ campo: 'data', mensagem: 'Informe uma data válida no formato AAAA-MM-DD.' });
  }

  for (const [campo, valor] of [['inicio', inicio], ['fim', fim]]) {
    if (valor === undefined || valor === null || valor === '') {
      campos.push({ campo, mensagem: `O horário de ${campo === 'inicio' ? 'início' : 'fim'} é obrigatório.` });
    } else if (typeof valor !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(valor)) {
      campos.push({ campo, mensagem: 'Informe o horário no formato HH:mm.' });
    }
  }

  if (titulo === undefined || titulo === null || titulo === '') {
    campos.push({ campo: 'titulo', mensagem: 'O título da reunião é obrigatório.' });
  } else if (typeof titulo !== 'string' || titulo.trim() === '') {
    campos.push({ campo: 'titulo', mensagem: 'O título deve ser um texto não vazio.' });
  }

  if (campos.length) throw dadosInvalidos(campos);

  if (fim <= inicio) {
    throw dadosInvalidos([{ campo: 'fim', mensagem: 'O horário de fim deve ser posterior ao horário de início.' }]);
  }

  const agora = dataHoraAtualBrasilia();
  if (data < agora.data || (data === agora.data && inicio <= agora.hora)) {
    throw dadosInvalidos([{ campo: 'inicio', mensagem: 'A reserva deve começar em uma data e horário futuros (horário de Brasília).' }]);
  }

  const idSala = Number(salaId);
  const sala = store.salas.find((item) => item.id === idSala);
  if (!sala || sala.ativa === false || sala.ativo === false) {
    throw new ErroApp(404, 'SALA_NAO_ENCONTRADA', 'Sala não encontrada ou inativa.');
  }

  const conflito = store.reservas.some((reserva) =>
    reserva.salaId === idSala &&
    reserva.data === data &&
    inicio < reserva.fim &&
    reserva.inicio < fim
  );
  if (conflito) {
    throw new ErroApp(409, 'HORARIO_INDISPONIVEL', 'A sala já está reservada nesse horário.');
  }

  const reserva = {
    id: randomUUID(),
    salaId: idSala,
    data,
    inicio,
    fim,
    titulo: titulo.trim(),
    responsavel: usuario.email,
  };
  store.reservas.push(reserva);

  return {
    ...reserva,
    sala: { id: sala.id, nome: sala.nome },
  };
}

function cancelarReserva(/* id, usuario */) {
  throw new Error('Não implementado');
}

module.exports = { criarReserva, cancelarReserva, store };
