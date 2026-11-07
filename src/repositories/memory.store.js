// Único lugar que sabe que os dados estão em memória.
const criarSementeSalas = () => [
  { id: 1, nome: 'Sala Alfa', capacidade: 6, recursos: [] },
  { id: 2, nome: 'Sala Beta', capacidade: 10, recursos: [] },
  { id: 3, nome: 'Sala Gama', capacidade: 4, recursos: [] },
];

const salas = criarSementeSalas();
const reservas = [];

// Próximo id = maior id existente + 1; ids nunca são reutilizados.
let ultimoId = Math.max(0, ...salas.map((s) => s.id));

// Síncrono: gera o id e salva sem nenhum await no meio.
function adicionarSala({ nome, capacidade, recursos }) {
  ultimoId += 1;
  const sala = { id: ultimoId, nome, capacidade, recursos };
  salas.push(sala);
  return sala;
}

// Restaura os dados iniciais mutando os arrays in place (uso em testes).
function resetar() {
  salas.length = 0;
  salas.push(...criarSementeSalas());
  reservas.length = 0;
  ultimoId = Math.max(0, ...salas.map((s) => s.id));
}

module.exports = { salas, reservas, adicionarSala, resetar };
