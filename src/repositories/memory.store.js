// Único lugar que sabe que os dados estão em memória.
const salas = [
  { id: 1, nome: 'Sala Alfa', capacidade: 6 },
  { id: 2, nome: 'Sala Beta', capacidade: 10 },
  { id: 3, nome: 'Sala Gama', capacidade: 4 },
];

const reservas = [];

module.exports = { salas, reservas };
