// Validação de datas e campos.
function isDataValida(valor) {
  return !Number.isNaN(Date.parse(valor));
}

function intervaloValido(inicio, fim) {
  return isDataValida(inicio) && isDataValida(fim) && new Date(inicio) < new Date(fim);
}

const NOME_SALA_MAX = 100;
const CAPACIDADE_MIN = 1;
const CAPACIDADE_MAX = 500;

// Trim + espaços internos colapsados em um só.
function normalizarNomeSala(valor) {
  return valor.trim().replace(/\s+/g, ' ');
}

// Valida o corpo de criação de sala. Reporta TODOS os campos inválidos.
// Retorna { campos: [{campo, mensagem}], dados: {nome, capacidade, recursos} }
function validarSala(corpo) {
  const body = corpo && typeof corpo === 'object' && !Array.isArray(corpo) ? corpo : {};
  const campos = [];
  const dados = {};

  // nome
  if (typeof body.nome !== 'string' || normalizarNomeSala(body.nome) === '') {
    campos.push({ campo: 'nome', mensagem: 'O nome é obrigatório e deve ser um texto não vazio.' });
  } else {
    const nome = normalizarNomeSala(body.nome);
    if (nome.length > NOME_SALA_MAX) {
      campos.push({ campo: 'nome', mensagem: `O nome deve ter no máximo ${NOME_SALA_MAX} caracteres.` });
    } else {
      dados.nome = nome;
    }
  }

  // capacidade
  const cap = body.capacidade;
  if (
    typeof cap !== 'number' ||
    !Number.isInteger(cap) ||
    cap < CAPACIDADE_MIN ||
    cap > CAPACIDADE_MAX
  ) {
    campos.push({
      campo: 'capacidade',
      mensagem: `A capacidade é obrigatória e deve ser um número inteiro entre ${CAPACIDADE_MIN} e ${CAPACIDADE_MAX}.`,
    });
  } else {
    dados.capacidade = cap;
  }

  // recursos (opcional)
  if (body.recursos === undefined || body.recursos === null) {
    dados.recursos = [];
  } else if (!Array.isArray(body.recursos)) {
    campos.push({ campo: 'recursos', mensagem: 'Os recursos devem ser uma lista de textos.' });
  } else if (
    body.recursos.some((r) => typeof r !== 'string' || r.trim() === '')
  ) {
    campos.push({
      campo: 'recursos',
      mensagem: 'Cada recurso deve ser um texto não vazio.',
    });
  } else {
    const vistos = new Set();
    dados.recursos = [];
    for (const r of body.recursos) {
      const item = r.trim();
      const chave = item.toLowerCase();
      if (!vistos.has(chave)) {
        vistos.add(chave);
        dados.recursos.push(item);
      }
    }
  }

  return { campos, dados };
}

module.exports = {
  isDataValida,
  intervaloValido,
  normalizarNomeSala,
  validarSala,
  NOME_SALA_MAX,
  CAPACIDADE_MIN,
  CAPACIDADE_MAX,
};
