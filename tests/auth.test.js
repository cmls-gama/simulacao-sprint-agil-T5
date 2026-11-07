process.env.NODE_ENV = 'test';
delete process.env.JWT_SECRET;

const request = require('supertest');
const jwt = require('jsonwebtoken');
const express = require('express');
const { autenticar, exigirPerfil } = require('../src/middlewares/auth');
const { enviarErro } = require('../src/utils/erros');
const { getSecret } = require('../src/utils/jwt');

// App de teste com rotas protegidas descartáveis, montado como o app real.
const executou = jest.fn();
const app = require('../src/app');
const testApp = express();
testApp.use('/', (req, res, next) => (req.path === '/login' ? app(req, res, next) : next()));
testApp.use(autenticar);
testApp.get('/teste/protegida', (req, res) => {
  executou();
  res.json({ user: req.user });
});
testApp.get('/teste/admin', exigirPerfil('admin'), (req, res) => res.json({ ok: true }));
testApp.get('/teste/ambos', exigirPerfil('admin', 'funcionario'), (req, res) => res.json({ ok: true }));
testApp.use((req, res) => enviarErro(res, 404, 'ROTA_NAO_ENCONTRADA', 'Rota não encontrada.'));

const login = (body, headers = {}) => request(app).post('/login').set(headers).send(body);
const token = (claims, secret = getSecret(), opts = { expiresIn: 60 }) =>
  jwt.sign(claims, secret, { algorithm: 'HS256', ...opts });
const valido = (role = 'admin') =>
  token({ sub: 'ana@admin.com', email: 'ana@admin.com', role });

beforeEach(() => executou.mockClear());

describe('POST /login - sucesso', () => {
  test('admin', async () => {
    const res = await login({ email: 'ana@admin.com' });
    expect(res.status).toBe(200);
    expect(res.body.tipo).toBe('Bearer');
    expect(res.body.expiraEm).toBe(3600);
    const dec = jwt.verify(res.body.token, getSecret());
    expect(dec).toMatchObject({ role: 'admin', email: 'ana@admin.com', sub: 'ana@admin.com' });
    expect(typeof dec.exp).toBe('number');
    expect(typeof dec.iat).toBe('number');
    expect(dec.exp - dec.iat).toBe(3600);
  });

  test('funcionario', async () => {
    const res = await login({ email: 'joao@funcionario.com' });
    expect(res.status).toBe(200);
    expect(jwt.decode(res.body.token).role).toBe('funcionario');
  });

  test('normaliza e-mail', async () => {
    const res = await login({ email: ' ANA@Admin.COM ' });
    expect(res.status).toBe(200);
    const dec = jwt.decode(res.body.token);
    expect(dec.email).toBe('ana@admin.com');
    expect(dec.sub).toBe('ana@admin.com');
  });

  test('campo senha não tem efeito', async () => {
    const a = await login({ email: 'ana@admin.com' });
    const b = await login({ email: 'ana@admin.com', senha: 'qualquer' });
    expect(b.status).toBe(a.status);
    expect(Object.keys(b.body)).toEqual(Object.keys(a.body));
    expect(jwt.decode(b.body.token).role).toBe('admin');
    const c = await login({ email: 'ana@gmail.com', senha: '123' });
    expect(c.status).toBe(401);
  });

  test.each([
    ['Authorization inválido', { Authorization: 'Bearer lixo' }],
    ['Authorization expirado', { Authorization: `Bearer ${token({ sub: 'a', email: 'a', role: 'admin' }, getSecret(), { expiresIn: -10 })}` }],
    ['Authorization Basic', { Authorization: 'Basic xxx' }],
  ])('ignora %s', async (_n, headers) => {
    const res = await login({ email: 'ana@admin.com' }, headers);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});

describe('POST /login - domínio não corporativo', () => {
  test.each([
    'ana@gmail.com',
    'ana@admin.com.br',
    'ana@sub.admin.com',
    'ana@xadmin.com',
    'ana@admin.com.',
    'ana@funcionario.com.br',
  ])('%s -> 401', async (email) => {
    const res = await login({ email });
    expect(res.status).toBe(401);
    expect(res.body.erro.codigo).toBe('CREDENCIAIS_INVALIDAS');
    expect(res.body.erro.campos).toBeUndefined();
    expect(res.body.token).toBeUndefined();
  });
});

describe('POST /login - dados inválidos', () => {
  test.each([
    ['ausente', {}],
    ['vazio', { email: '' }],
    ['espaços', { email: '   ' }],
    ['número', { email: 123 }],
    ['null', { email: null }],
    ['objeto', { email: { a: 1 } }],
    ['sem arroba', { email: 'semarroba' }],
    ['sem local', { email: '@admin.com' }],
    ['espaço no local', { email: 'a b@admin.com' }],
    ['duas arrobas', { email: 'a@@admin.com' }],
    ['ana@admin.com@x.com', { email: 'ana@admin.com@x.com' }],
    ['domínio vazio', { email: 'ana@' }],
    ['domínio com espaço', { email: 'ana@admin .com' }],
  ])('%s -> 400', async (_n, body) => {
    const res = await login(body);
    expect(res.status).toBe(400);
    expect(res.body.erro.codigo).toBe('DADOS_INVALIDOS');
    expect(res.body.erro.campos[0].campo).toBe('email');
    expect(typeof res.body.erro.campos[0].mensagem).toBe('string');
    expect(res.body.token).toBeUndefined();
  });

  test('corpo ausente -> 400', async () => {
    const res = await request(app).post('/login');
    expect(res.status).toBe(400);
    expect(res.body.erro.campos[0].campo).toBe('email');
  });
});

describe('autenticar', () => {
  test('token válido executa e define req.user', async () => {
    const res = await request(testApp).get('/teste/protegida').set('Authorization', `Bearer ${valido()}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 'ana@admin.com', email: 'ana@admin.com', role: 'admin' });
    expect(executou).toHaveBeenCalledTimes(1);
  });

  test('token emitido pelo /login é aceito', async () => {
    const l = await login({ email: 'joao@funcionario.com' });
    const res = await request(testApp).get('/teste/protegida').set('Authorization', `Bearer ${l.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('funcionario');
  });

  const claimsOk = { sub: 'ana@admin.com', email: 'ana@admin.com', role: 'admin' };
  test.each([
    ['sem header', undefined],
    ['Basic', 'Basic xxx'],
    ['Bearer vazio', 'Bearer '],
    ['Bearer sem espaço', 'Bearer'],
    ['malformado', 'Bearer abc.def'],
    ['outro segredo', `Bearer ${token(claimsOk, 'outro-segredo')}`],
    ['expirado', `Bearer ${token(claimsOk, getSecret(), { expiresIn: -10 })}`],
    ['sem role', `Bearer ${token({ sub: 'a@admin.com', email: 'a@admin.com' })}`],
    ['role superuser', `Bearer ${token({ ...claimsOk, role: 'superuser' })}`],
    ['sem sub', `Bearer ${token({ email: 'a@admin.com', role: 'admin' })}`],
    ['sem email', `Bearer ${token({ sub: 'a@admin.com', role: 'admin' })}`],
    ['alg none', `Bearer ${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify(claimsOk)).toString('base64url')}.`],
  ])('401 e não executa: %s', async (_n, header) => {
    const req = request(testApp).get('/teste/protegida');
    const res = await (header === undefined ? req : req.set('Authorization', header));
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
    expect(res.body.erro.codigo).toBe('NAO_AUTENTICADO');
    expect(typeof res.body.erro.mensagem).toBe('string');
    expect(res.body.erro.campos).toBeUndefined();
    expect(executou).not.toHaveBeenCalled();
  });
});

describe('rotas do app real', () => {
  test('rota desconhecida sem token -> 401', async () => {
    const res = await request(app).get('/nao-existe');
    expect(res.status).toBe(401);
    expect(res.body.erro.codigo).toBe('NAO_AUTENTICADO');
  });

  test('rota desconhecida com token -> 404', async () => {
    const res = await request(app).get('/nao-existe').set('Authorization', `Bearer ${valido()}`);
    expect(res.status).toBe(404);
    expect(res.body.erro.codigo).toBe('ROTA_NAO_ENCONTRADA');
  });

  test('rotas existentes exigem token', async () => {
    expect((await request(app).get('/salas')).status).toBe(401);
    expect((await request(app).post('/reservas')).status).toBe(401);
    expect((await request(app).delete('/reservas/1')).status).toBe(401);
  });

  test('/docs-api é público', async () => {
    const res = await request(app).get('/docs-api/').redirects(1);
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });

  test('GET /login não é público', async () => {
    expect((await request(app).get('/login')).status).toBe(401);
  });
});

describe('exigirPerfil', () => {
  test('funcionario em rota admin -> 403', async () => {
    const res = await request(testApp).get('/teste/admin').set('Authorization', `Bearer ${valido('funcionario')}`);
    expect(res.status).toBe(403);
    expect(res.body.erro.codigo).toBe('SEM_PERMISSAO');
  });

  test('admin em rota admin -> 200', async () => {
    const res = await request(testApp).get('/teste/admin').set('Authorization', `Bearer ${valido('admin')}`);
    expect(res.status).toBe(200);
  });

  test('ambos os perfis em rota compartilhada', async () => {
    for (const r of ['admin', 'funcionario']) {
      const res = await request(testApp).get('/teste/ambos').set('Authorization', `Bearer ${valido(r)}`);
      expect(res.status).toBe(200);
    }
  });
});
