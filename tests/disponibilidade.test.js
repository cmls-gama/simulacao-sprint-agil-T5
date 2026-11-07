process.env.NODE_ENV = 'test';
delete process.env.JWT_SECRET;

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const store = require('../src/repositories/memory.store');
const { getSecret } = require('../src/utils/jwt');

let admin;
let func;

beforeAll(async () => {
  admin = `Bearer ${(await request(app).post('/login').send({ email: 'ana@admin.com' })).body.token}`;
  func = `Bearer ${(await request(app).post('/login').send({ email: 'joao@funcionario.com' })).body.token}`;
});

beforeEach(() => store.resetar());

const consultar = (id, query = '?data=2026-11-10', auth = admin) => {
  const r = request(app).get(`/salas/${id}/disponibilidade${query}`);
  return auth ? r.set('Authorization', auth) : r;
};

let seq = 0;
const inserir = (extra = {}) => {
  seq += 1;
  const r = {
    id: `id-${seq}`,
    salaId: 1,
    data: '2026-11-10',
    inicio: '09:00',
    fim: '10:00',
    titulo: `Reunião ${seq}`,
    responsavel: 'ana@admin.com',
    ...extra,
  };
  store.reservas.push(r);
  return r;
};

describe('200', () => {
  test('retorna reservas da data com somente os campos previstos', async () => {
    const r = inserir({ inicio: '09:00', fim: '10:30', titulo: 'Planning', responsavel: 'ana@admin.com' });
    const res = await consultar(1);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      sala: { id: 1, nome: 'Sala Alfa' },
      data: '2026-11-10',
      fuso: 'America/Sao_Paulo',
      reservas: [{ id: r.id, inicio: '09:00', fim: '10:30', responsavel: 'ana@admin.com', titulo: 'Planning' }],
    });
    expect(Object.keys(res.body.reservas[0]).sort()).toEqual(['fim', 'id', 'inicio', 'responsavel', 'titulo']);
  });

  test('dia vazio -> 200 com reservas []', async () => {
    const res = await consultar(2);
    expect(res.status).toBe(200);
    expect(res.body.reservas).toEqual([]);
    expect(res.body.sala).toEqual({ id: 2, nome: 'Sala Beta' });
  });

  test('ordena por inicio, depois fim, depois ordem de inserção', async () => {
    const c = inserir({ inicio: '14:00', fim: '15:00' });
    const a1 = inserir({ inicio: '08:00', fim: '09:00' });
    const e = inserir({ inicio: '10:00', fim: '12:00' });
    const d = inserir({ inicio: '10:00', fim: '11:00' });
    const res = await consultar(1);
    expect(res.body.reservas.map((r) => r.id)).toEqual([a1.id, d.id, e.id, c.id]);
  });

  test('empate total (inicio e fim) mantém a ordem de inserção', async () => {
    const x = inserir({ inicio: '10:00', fim: '11:00' });
    const y = inserir({ inicio: '10:00', fim: '11:00' });
    const z = inserir({ inicio: '10:00', fim: '11:00' });
    const res = await consultar(1);
    expect(res.body.reservas.map((r) => r.id)).toEqual([x.id, y.id, z.id]);
  });

  test('não retorna reserva da mesma sala em outra data', async () => {
    inserir({ data: '2026-11-11' });
    const keep = inserir();
    const res = await consultar(1);
    expect(res.body.reservas.map((r) => r.id)).toEqual([keep.id]);
  });

  test('não retorna reserva de outra sala na mesma data', async () => {
    inserir({ salaId: 2 });
    const res = await consultar(1);
    expect(res.body.reservas).toEqual([]);
  });

  test('exclui reservas canceladas e mantém as demais', async () => {
    inserir({ status: 'cancelada', inicio: '08:00', fim: '09:00' });
    const ok = inserir({ inicio: '11:00', fim: '12:00' });
    const ativa = inserir({ status: 'ativa', inicio: '13:00', fim: '14:00' });
    const res = await consultar(1);
    expect(res.body.reservas.map((r) => r.id)).toEqual([ok.id, ativa.id]);
  });

  test('data passada funciona normalmente', async () => {
    const r = inserir({ data: '2020-01-15' });
    const res = await consultar(1, '?data=2020-01-15');
    expect(res.status).toBe(200);
    expect(res.body.reservas.map((x) => x.id)).toEqual([r.id]);
  });

  test('data futura distante funciona', async () => {
    const res = await consultar(1, '?data=2999-12-31');
    expect(res.status).toBe(200);
    expect(res.body.reservas).toEqual([]);
  });

  test('retorna cópias: alterar a resposta não altera o store', async () => {
    const r = inserir();
    const res = await consultar(1);
    res.body.reservas[0].titulo = 'Hack';
    expect(r.titulo).not.toBe('Hack');
    expect((await consultar(1)).body.reservas[0].titulo).toBe(r.titulo);
  });

  test('somente leitura: não altera store.reservas', async () => {
    inserir();
    inserir({ inicio: '07:00', fim: '08:00' });
    const antes = JSON.stringify(store.reservas);
    await consultar(1);
    await consultar(1, '?data=2020-01-01');
    await consultar(999);
    await consultar(1, '');
    expect(JSON.stringify(store.reservas)).toBe(antes);
  });

  test('funciona para admin e funcionario; funcionario vê responsável de outros', async () => {
    inserir({ responsavel: 'ana@admin.com' });
    const a = await consultar(1, '?data=2026-11-10', admin);
    const f = await consultar(1, '?data=2026-11-10', func);
    expect(a.status).toBe(200);
    expect(f.status).toBe(200);
    expect(f.body.reservas[0].responsavel).toBe('ana@admin.com');
  });

  test('sala criada via POST /salas também pode ser consultada', async () => {
    const nova = await request(app).post('/salas').set('Authorization', admin).send({ nome: 'Sala Nova', capacidade: 5 });
    const res = await consultar(nova.body.id);
    expect(res.status).toBe(200);
    expect(res.body.sala).toEqual({ id: nova.body.id, nome: 'Sala Nova' });
  });
});

describe('integração com POST /reservas', () => {
  test('reserva criada aparece imediatamente com responsavel/titulo corretos', async () => {
    const criada = await request(app)
      .post('/reservas')
      .set('Authorization', func)
      .send({ salaId: 1, data: '2099-12-31', inicio: '10:00', fim: '11:00', titulo: 'Planejamento' });
    expect(criada.status).toBe(201);

    const res = await consultar(1, '?data=2099-12-31', admin);
    expect(res.status).toBe(200);
    expect(res.body.reservas).toEqual([
      { id: criada.body.id, inicio: '10:00', fim: '11:00', responsavel: 'joao@funcionario.com', titulo: 'Planejamento' },
    ]);
  });

  test('várias reservas criadas vêm ordenadas', async () => {
    for (const [inicio, fim] of [['15:00', '16:00'], ['09:00', '10:00']]) {
      await request(app)
        .post('/reservas')
        .set('Authorization', admin)
        .send({ salaId: 2, data: '2099-12-31', inicio, fim, titulo: 'T' });
    }
    const res = await consultar(2, '?data=2099-12-31');
    expect(res.body.reservas.map((r) => r.inicio)).toEqual(['09:00', '15:00']);
  });
});

describe('404 sala', () => {
  test.each(['999', 'abc', '-1', '1.5', '0', '1e0', '%201', '01', '1%20'])('id %j -> 404', async (id) => {
    const res = await consultar(id);
    expect(res.status).toBe(404);
    expect(res.body.erro.codigo).toBe('SALA_NAO_ENCONTRADA');
    expect(res.body.erro.mensagem).toMatch(/Sala não encontrada/);
  });

  test.each([['ativa === false', { ativa: false }], ['ativo === false', { ativo: false }]])(
    'sala inativa (%s) -> 404',
    async (_n, flag) => {
      Object.assign(store.salas[0], flag);
      inserir();
      const res = await consultar(1);
      expect(res.status).toBe(404);
      expect(res.body.erro.codigo).toBe('SALA_NAO_ENCONTRADA');
    },
  );

  test('campo ausente (undefined) conta como ativa', async () => {
    expect((await consultar(1)).status).toBe(200);
  });

  test('404 vence data ausente ou inválida', async () => {
    expect((await consultar(999, '')).status).toBe(404);
    expect((await consultar('abc', '?data=lixo')).status).toBe(404);
  });
});

describe('400 data', () => {
  test.each([
    ['ausente', ''],
    ['vazia', '?data='],
    ['espaços', '?data=%20%20%20'],
    ['dd/mm/aaaa', '?data=10%2F11%2F2026'],
    ['com hora', '?data=2026-11-10T10:00:00'],
    ['2026-02-30', '?data=2026-02-30'],
    ['2026-13-01', '?data=2026-13-01'],
    ['2026-00-10', '?data=2026-00-10'],
    ['sem hífens', '?data=20261110'],
    ['dia 1 dígito', '?data=2026-11-1'],
    ['data com espaço ao redor', '?data=%202026-11-10'],
    ['repetida', '?data=2026-11-10&data=2026-11-11'],
    ['repetida inválida', '?data=a&data=b'],
    ['objeto', '?data[a]=2026-11-10'],
  ])('%s -> 400', async (_n, query) => {
    const res = await consultar(1, query);
    expect(res.status).toBe(400);
    expect(res.body.erro.codigo).toBe('DADOS_INVALIDOS');
    expect(res.body.erro.campos).toHaveLength(1);
    expect(res.body.erro.campos[0].campo).toBe('data');
    expect(typeof res.body.erro.campos[0].mensagem).toBe('string');
  });

  test('29/02 de ano bissexto é aceito; de ano comum não', async () => {
    expect((await consultar(1, '?data=2028-02-29')).status).toBe(200);
    expect((await consultar(1, '?data=2027-02-29')).status).toBe(400);
  });
});

describe('401', () => {
  const expirado = jwt.sign({ sub: 'a@admin.com', email: 'a@admin.com', role: 'admin' }, getSecret(), {
    algorithm: 'HS256',
    expiresIn: -10,
  });

  test.each([
    ['sem token', null],
    ['token malformado', 'Bearer abc.def'],
    ['token expirado', `Bearer ${expirado}`],
  ])('%s -> 401', async (_n, auth) => {
    const res = await consultar(1, '?data=2026-11-10', auth);
    expect(res.status).toBe(401);
    expect(res.body.erro.codigo).toBe('NAO_AUTENTICADO');
  });

  test('sala inexistente sem token -> 401 (não 404)', async () => {
    expect((await consultar(999, '?data=2026-11-10', null)).status).toBe(401);
  });
});

describe('regressão', () => {
  test('placeholder antigo /salas/disponibilidade não existe mais', async () => {
    const res = await request(app).get('/salas/disponibilidade').set('Authorization', admin);
    expect(res.status).toBe(404);
  });

  test('GET /salas e POST /salas continuam funcionando', async () => {
    expect((await request(app).get('/salas').set('Authorization', func)).status).toBe(200);
    const criada = await request(app).post('/salas').set('Authorization', admin).send({ nome: 'Sala R', capacidade: 3 });
    expect(criada.status).toBe(201);
  });
});
