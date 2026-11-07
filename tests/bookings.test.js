process.env.NODE_ENV = 'test';
delete process.env.JWT_SECRET;

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const store = require('../src/repositories/memory.store');
const { getSecret } = require('../src/utils/jwt');

const token = (email = 'ana@admin.com', role = 'admin') =>
  `Bearer ${jwt.sign({ sub: email, email, role }, getSecret(), { algorithm: 'HS256' })}`;
const reservaPadrao = (sobrescritos = {}) => ({
  salaId: 1,
  data: '2099-12-31',
  inicio: '09:00',
  fim: '10:00',
  titulo: 'Reunião de teste',
  ...sobrescritos,
});
const criar = (dados, auth = token()) =>
  request(app).post('/reservas').set('Authorization', auth).send(dados);

beforeEach(() => store.resetar());

describe('POST /reservas - conflitos', () => {
  test.each([
    ['intervalo idêntico', '09:00', '10:00'],
    ['sobreposição no início', '08:30', '09:30'],
    ['sobreposição no fim', '09:30', '10:30'],
    ['novo intervalo contido no existente', '09:30', '09:45'],
    ['novo intervalo engloba o existente', '08:00', '11:00'],
  ])('%s retorna 409 sem alterar a agenda', async (_caso, inicio, fim) => {
    expect((await criar(reservaPadrao())).status).toBe(201);

    const res = await criar(reservaPadrao({ inicio, fim }));

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      erro: {
        codigo: 'HORARIO_INDISPONIVEL',
        mensagem: 'Sala Alfa já reservada das 09:00 às 10:00.',
      },
    });
    expect(store.reservas).toHaveLength(1);
    expect(store.reservas[0]).toMatchObject({ inicio: '09:00', fim: '10:00' });
  });

  test.each([
    ['em sequência antes', '08:00', '09:00'],
    ['em sequência depois', '10:00', '11:00'],
  ])('%s é permitido', async (_caso, inicio, fim) => {
    expect((await criar(reservaPadrao())).status).toBe(201);

    const res = await criar(reservaPadrao({ inicio, fim }));

    expect(res.status).toBe(201);
    expect(store.reservas).toHaveLength(2);
  });

  test('permite mesmo horário em outra sala ou data', async () => {
    expect((await criar(reservaPadrao())).status).toBe(201);
    expect((await criar(reservaPadrao({ salaId: 2 }))).status).toBe(201);
    expect((await criar(reservaPadrao({ data: '2100-01-01' }))).status).toBe(201);
    expect(store.reservas).toHaveLength(3);
  });

  test('requisições simultâneas criam apenas uma reserva conflitante', async () => {
    const resultados = await Promise.all([
      criar(reservaPadrao()),
      criar(reservaPadrao({ titulo: 'Outra equipe' })),
    ]);

    expect(resultados.filter((res) => res.status === 201)).toHaveLength(1);
    expect(resultados.filter((res) => res.status === 409)).toHaveLength(1);
    expect(store.reservas).toHaveLength(1);
  });
});
