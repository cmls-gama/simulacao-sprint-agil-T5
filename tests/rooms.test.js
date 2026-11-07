process.env.NODE_ENV = 'test';
delete process.env.JWT_SECRET;

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const store = require('../src/repositories/memory.store');
const { getSecret } = require('../src/utils/jwt');

const tokenDe = (email, role, opts = { expiresIn: 60 }) =>
  jwt.sign({ sub: email, email, role }, getSecret(), { algorithm: 'HS256', ...opts });
const admin = () => `Bearer ${tokenDe('ana@admin.com', 'admin')}`;
const func = () => `Bearer ${tokenDe('joao@funcionario.com', 'funcionario')}`;

const criar = (body, auth = admin()) => {
  const r = request(app).post('/salas');
  if (auth) r.set('Authorization', auth);
  return r.send(body);
};
const listar = (auth = admin()) => request(app).get('/salas').set('Authorization', auth);
const SEMENTE = 3;

beforeEach(() => store.resetar());

async function naoCriou() {
  const res = await listar();
  expect(res.body).toHaveLength(SEMENTE);
}

describe('POST /salas - sucesso', () => {
  test('201 com recursos e formato do corpo', async () => {
    const res = await criar({ nome: 'Sala Delta', capacidade: 8, recursos: ['Projetor', 'TV'] });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 4, nome: 'Sala Delta', capacidade: 8, recursos: ['Projetor', 'TV'] });
  });

  test('201 sem recursos -> []', async () => {
    const res = await criar({ nome: 'Sala X', capacidade: 2 });
    expect(res.status).toBe(201);
    expect(res.body.recursos).toEqual([]);
  });

  test('201 com recursos null -> []', async () => {
    const res = await criar({ nome: 'Sala X', capacidade: 2, recursos: null });
    expect(res.status).toBe(201);
    expect(res.body.recursos).toEqual([]);
  });

  test('201 com recursos [] -> []', async () => {
    const res = await criar({ nome: 'Sala X', capacidade: 2, recursos: [] });
    expect(res.status).toBe(201);
    expect(res.body.recursos).toEqual([]);
  });

  test('nome com exatamente 100 caracteres -> 201', async () => {
    const res = await criar({ nome: 'a'.repeat(100), capacidade: 2 });
    expect(res.status).toBe(201);
  });

  test('capacidade 1 e 500 -> 201', async () => {
    expect((await criar({ nome: 'Min', capacidade: 1 })).status).toBe(201);
    expect((await criar({ nome: 'Max', capacidade: 500 })).status).toBe(201);
  });

  test('ignora campos desconhecidos (inclusive id)', async () => {
    const res = await criar({ id: 99, nome: 'Sala Y', capacidade: 3, foo: 'bar' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 4, nome: 'Sala Y', capacidade: 3, recursos: [] });
  });
});

describe('POST /salas - normalização', () => {
  test('"  Sala   Nova  " vira "Sala Nova"', async () => {
    const res = await criar({ nome: '  Sala   Nova  ', capacidade: 5 });
    expect(res.status).toBe(201);
    expect(res.body.nome).toBe('Sala Nova');
  });

  test('recursos são aparados e deduplicados sem diferenciar maiúsculas', async () => {
    const res = await criar({
      nome: 'Sala N',
      capacidade: 5,
      recursos: [' Projetor ', 'projetor', 'TV', 'PROJETOR', 'tv', 'Quadro'],
    });
    expect(res.body.recursos).toEqual(['Projetor', 'TV', 'Quadro']);
  });
});

describe('POST /salas - 400', () => {
  const campo = (res, nome) => res.body.erro.campos.find((c) => c.campo === nome);

  test.each([
    ['nome em branco', { nome: '   ', capacidade: 5 }, 'nome'],
    ['nome ausente', { capacidade: 5 }, 'nome'],
    ['nome não-texto', { nome: 123, capacidade: 5 }, 'nome'],
    ['nome com 101 caracteres', { nome: 'a'.repeat(101), capacidade: 5 }, 'nome'],
    ['nome > 100 só após normalizar', { nome: ' ' + 'a'.repeat(101) + ' ', capacidade: 5 }, 'nome'],
    ['capacidade 0', { nome: 'S', capacidade: 0 }, 'capacidade'],
    ['capacidade -1', { nome: 'S', capacidade: -1 }, 'capacidade'],
    ['capacidade "abc"', { nome: 'S', capacidade: 'abc' }, 'capacidade'],
    ['capacidade "10"', { nome: 'S', capacidade: '10' }, 'capacidade'],
    ['capacidade 2.5', { nome: 'S', capacidade: 2.5 }, 'capacidade'],
    ['capacidade null', { nome: 'S', capacidade: null }, 'capacidade'],
    ['capacidade ausente', { nome: 'S' }, 'capacidade'],
    ['capacidade 501', { nome: 'S', capacidade: 501 }, 'capacidade'],
    ['recurso string vazia', { nome: 'S', capacidade: 5, recursos: ['TV', ''] }, 'recursos'],
    ['recurso só espaços', { nome: 'S', capacidade: 5, recursos: ['  '] }, 'recursos'],
    ['recurso não-texto', { nome: 'S', capacidade: 5, recursos: ['TV', 5] }, 'recursos'],
    ['recursos não-array', { nome: 'S', capacidade: 5, recursos: 'TV' }, 'recursos'],
  ])('%s', async (_n, body, nomeCampo) => {
    const res = await criar(body);
    expect(res.status).toBe(400);
    expect(res.body.erro.codigo).toBe('DADOS_INVALIDOS');
    expect(res.body.erro.mensagem).toBe('Dados inválidos.');
    expect(campo(res, nomeCampo)).toBeDefined();
    expect(typeof campo(res, nomeCampo).mensagem).toBe('string');
    await naoCriou();
  });

  test('múltiplos campos inválidos reportados juntos', async () => {
    const res = await criar({ nome: '', capacidade: 0, recursos: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.erro.campos.map((c) => c.campo).sort()).toEqual(['capacidade', 'nome', 'recursos']);
    await naoCriou();
  });

  test('sem corpo -> lista nome e capacidade', async () => {
    const res = await request(app).post('/salas').set('Authorization', admin());
    expect(res.status).toBe(400);
    expect(res.body.erro.campos.map((c) => c.campo).sort()).toEqual(['capacidade', 'nome']);
    await naoCriou();
  });

  test.each([['array', []], ['lista de objetos', [{ nome: 'a' }]]])('corpo %s', async (_n, body) => {
    const res = await criar(body);
    expect(res.status).toBe(400);
    expect(res.body.erro.campos.map((c) => c.campo).sort()).toEqual(['capacidade', 'nome']);
  });

  test('JSON malformado de admin -> 400', async () => {
    const res = await request(app)
      .post('/salas')
      .set('Authorization', admin())
      .set('Content-Type', 'application/json')
      .send('{"nome": ');
    expect(res.status).toBe(400);
    expect(res.body.erro.codigo).toBe('DADOS_INVALIDOS');
    await naoCriou();
  });
});

describe('POST /salas - 409', () => {
  test.each(['sala alfa ', '  SALA   ALFA', 'Sala Alfa'])('semente duplicada: %j', async (nome) => {
    const res = await criar({ nome, capacidade: 5 });
    expect(res.status).toBe(409);
    expect(res.body.erro.codigo).toBe('SALA_DUPLICADA');
    expect(res.body.erro.campos).toBeUndefined();
    await naoCriou();
  });

  test('sala criada no teste duplicada', async () => {
    expect((await criar({ nome: 'Sala Nova', capacidade: 5 })).status).toBe(201);
    const res = await criar({ nome: '  sala  NOVA', capacidade: 9 });
    expect(res.status).toBe(409);
    expect(res.body.erro.codigo).toBe('SALA_DUPLICADA');
    expect((await listar()).body).toHaveLength(SEMENTE + 1);
  });

  test('acentos NÃO são ignorados', async () => {
    expect((await criar({ nome: 'Sala Açai', capacidade: 5 })).status).toBe(201);
    expect((await criar({ nome: 'Sala Acai', capacidade: 5 })).status).toBe(201);
  });

  test('requisições concorrentes com o mesmo nome criam só uma sala', async () => {
    const resultados = await Promise.all(
      Array.from({ length: 5 }, () => criar({ nome: 'Concorrente', capacidade: 5 })),
    );
    expect(resultados.filter((r) => r.status === 201)).toHaveLength(1);
    expect(resultados.filter((r) => r.status === 409)).toHaveLength(4);
  });

  test('400 tem precedência sobre 409', async () => {
    const res = await criar({ nome: 'Sala Alfa', capacidade: 0 });
    expect(res.status).toBe(400);
  });
});

describe('POST /salas - 403 e 401', () => {
  test('funcionario com corpo válido -> 403', async () => {
    const res = await criar({ nome: 'Sala F', capacidade: 5 }, func());
    expect(res.status).toBe(403);
    expect(res.body.erro.codigo).toBe('SEM_PERMISSAO');
    await naoCriou();
  });

  test('funcionario com corpo inválido -> 403 (não 400)', async () => {
    const res = await criar({ nome: '', capacidade: 0 }, func());
    expect(res.status).toBe(403);
    await naoCriou();
  });

  test('funcionario com nome duplicado -> 403 (não 409)', async () => {
    const res = await criar({ nome: 'Sala Alfa', capacidade: 5 }, func());
    expect(res.status).toBe(403);
  });

  test.each([
    ['sem token', null],
    ['token malformado', 'Bearer abc.def'],
    ['token expirado', `Bearer ${tokenDe('ana@admin.com', 'admin', { expiresIn: -10 })}`],
  ])('%s -> 401', async (_n, auth) => {
    const res = await criar({ nome: 'Sala Z', capacidade: 5 }, auth);
    expect(res.status).toBe(401);
    expect(res.body.erro.codigo).toBe('NAO_AUTENTICADO');
    await naoCriou();
  });

  test('401 tem precedência mesmo com corpo inválido', async () => {
    expect((await criar({}, null)).status).toBe(401);
  });
});

describe('GET /salas', () => {
  test('retorna as salas semente com recursos', async () => {
    const res = await listar();
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 1, nome: 'Sala Alfa', capacidade: 6, recursos: [] },
      { id: 2, nome: 'Sala Beta', capacidade: 10, recursos: [] },
      { id: 3, nome: 'Sala Gama', capacidade: 4, recursos: [] },
    ]);
  });

  test('inclui sala recém-criada', async () => {
    await criar({ nome: 'Sala Nova', capacidade: 7, recursos: ['TV'] });
    const res = await listar();
    expect(res.body).toContainEqual({ id: 4, nome: 'Sala Nova', capacidade: 7, recursos: ['TV'] });
  });

  test('funciona para admin e funcionario', async () => {
    expect((await listar(admin())).status).toBe(200);
    expect((await listar(func())).status).toBe(200);
  });

  test('401 sem token', async () => {
    expect((await request(app).get('/salas')).status).toBe(401);
  });

  test('alterar o resultado não altera o store', async () => {
    const res = await listar();
    res.body[0].nome = 'Hack';
    expect((await listar()).body[0].nome).toBe('Sala Alfa');
  });
});

describe('ids', () => {
  test('novos ids são maiores que os da semente, crescentes e únicos', async () => {
    const ids = [];
    for (const nome of ['A1', 'A2', 'A3']) {
      ids.push((await criar({ nome, capacidade: 2 })).body.id);
    }
    expect(ids).toEqual([4, 5, 6]);
    expect(new Set(ids).size).toBe(3);
    expect(Math.min(...ids)).toBeGreaterThan(3);
  });

  test('resetar restaura a semente e o contador', async () => {
    await criar({ nome: 'Temp', capacidade: 2 });
    store.resetar();
    expect(store.salas).toHaveLength(3);
    expect((await criar({ nome: 'Temp', capacidade: 2 })).body.id).toBe(4);
  });
});

describe('regressão', () => {
  test('o antigo placeholder GET /salas/disponibilidade não existe mais (404 com token)', async () => {
    const res = await request(app).get('/salas/disponibilidade').set('Authorization', func());
    expect(res.status).toBe(404);
    expect(res.body.erro.codigo).toBe('ROTA_NAO_ENCONTRADA');
  });

  test('GET /salas/disponibilidade sem token -> 401', async () => {
    expect((await request(app).get('/salas/disponibilidade')).status).toBe(401);
  });
});

describe('ordem de middlewares (comportamento observado)', () => {
  test('JSON malformado de funcionario', async () => {
    const res = await request(app)
      .post('/salas')
      .set('Authorization', func())
      .set('Content-Type', 'application/json')
      .send('{"nome": ');
    // express.json() roda antes de exigirPerfil: o parser falha primeiro.
    expect(res.status).toBe(400);
    await naoCriou();
  });
});
