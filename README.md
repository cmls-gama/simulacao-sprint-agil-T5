# simulacao-sprint-agil-T5

API REST (Express) de reserva de salas de reunião. Dados em memória, autenticação via JWT.

## Executando

```bash
npm install
cp .env.example .env   # defina JWT_SECRET
npm start
npm test
```

| Variável | Obrigatória | Descrição |
|---|---|---|
| `JWT_SECRET` | sim | Segredo HS256. O servidor **não sobe** sem ela (nos testes, `NODE_ENV=test`, usa-se um segredo fixo). |
| `JWT_EXPIRES_IN_SECONDS` | não | Validade do token em segundos (padrão `3600`). |
| `PORT` | não | Porta (padrão `3000`). |

## Documentação (Swagger)

Com a API rodando, acesse `http://localhost:3000/docs-api` (público). A especificação fica em `openapi.yaml`. Para testar rotas protegidas, faça `POST /login`, clique em **Authorize** e cole o token.

## Autenticação

> **Atenção: esquema apenas para simulação.** Não há senha nem base de usuários.
> Qualquer pessoa que conheça um e-mail corporativo pode fazer login como essa pessoa.

O perfil é derivado do domínio do e-mail (correspondência **exata**; configurado em `DOMINIOS_PERFIS` em `src/utils/email.js`):

| E-mail | Perfil (`role`) |
|---|---|
| `<nome>@admin.com` | `admin` |
| `<nome>@funcionario.com` | `funcionario` |
| qualquer outro domínio (`admin.com.br`, `sub.admin.com`, `xadmin.com`...) | rejeitado |

O e-mail é normalizado (trim + minúsculas) e deve ter exatamente um `@`, parte local `[a-z0-9._%+-]+` e domínio sem espaços.

### POST /login (público, junto com `/docs-api`)

Request: `{ "email": "ana@admin.com" }`. Campos extras (ex.: `senha`) e o header `Authorization` são ignorados.

| Resultado | Status | Corpo |
|---|---|---|
| Sucesso | 200 | `{ "token": "<jwt>", "tipo": "Bearer", "expiraEm": 3600 }` |
| E-mail ausente / não-texto / vazio / mal formado | 400 | `DADOS_INVALIDOS` com `campos: [{ "campo": "email", "mensagem": "..." }]` |
| E-mail válido de domínio não corporativo | 401 | `CREDENCIAIS_INVALIDAS` |

### Token (JWT HS256)

Claims: `sub` (e-mail normalizado), `email` (e-mail normalizado), `role` (`admin` | `funcionario`), `iat`, `exp`.

### Enviando o token

Todas as demais rotas (inclusive rotas inexistentes) exigem:

```
Authorization: Bearer <token>
```

Falhas (header ausente, esquema diferente de Bearer, token vazio/malformado/expirado/assinatura inválida, claims `sub`/`email`/`role` ausentes ou `role` desconhecido) retornam **401 `NAO_AUTENTICADO`** com header `WWW-Authenticate: Bearer`.

Para os demais cards: após autenticar, `req.user = { id, email, role }` (`id` = e-mail). Para restringir por perfil use `exigirPerfil` de `src/middlewares/auth.js`:

```js
const { exigirPerfil } = require('../middlewares/auth');
router.post('/', exigirPerfil('admin'), handler);                    // cadastro de salas
router.post('/', exigirPerfil('admin', 'funcionario'), handler);     // reservas
```

Perfil insuficiente → **403 `SEM_PERMISSAO`**.

## Reservas

### POST /reservas

Cria uma reserva para uma sala existente e ativa. Apenas os perfis `admin` e `funcionario` podem reservar. Envie `salaId`, `data` (`AAAA-MM-DD`), `inicio` e `fim` (`HH:mm`) e `titulo`. Datas e horários são interpretados no fuso de Brasília; o início deve ser futuro e o fim posterior ao início no mesmo dia. O responsável é obtido exclusivamente do token.

```json
{
  "salaId": 1,
  "data": "2099-12-31",
  "inicio": "10:00",
  "fim": "11:00",
  "titulo": "Planejamento do Time X"
}
```

Uma criação retorna **201** com `id`, sala, data, horários, título e e-mail do responsável. Campos ausentes ou inválidos e horários passados retornam **400**; sala inexistente ou inativa retorna **404**; sobreposição com outra reserva da mesma sala e data retorna **409 `HORARIO_INDISPONIVEL`**, com mensagem indicando nome da sala e intervalo ocupado. Os intervalos são semiabertos (`início <= horário < fim`), então reservas adjacentes são permitidas. A verificação e gravação são síncronas no processo para evitar que requisições simultâneas criem reservas conflitantes.

## Salas

Modelo: `{ id, nome, capacidade, recursos }`. Há 3 salas de exemplo (ids 1 a 3); novas salas recebem o maior id + 1.

### POST /salas (somente `admin`)

Request: `{ "nome": "Sala Delta", "capacidade": 8, "recursos": ["Projetor", "TV"] }` → **201** com a sala criada.

Regras de validação:

- `nome`: obrigatório, texto. Aparado e com espaços internos colapsados; no máximo 100 caracteres. Único sem diferenciar maiúsculas/minúsculas (acentos **não** são ignorados), incluindo as salas de exemplo. Guarda a grafia normalizada original.
- `capacidade`: obrigatória, número JSON inteiro de 1 a 500 (`"10"`, `2.5`, `null`, `0` e negativos são inválidos).
- `recursos`: opcional (ausente, `null` ou `[]` → `[]`). Lista de textos; itens aparados, vazios/não-texto são inválidos; duplicatas (ignorando maiúsculas) removidas mantendo a primeira.
- Campos desconhecidos são ignorados. Corpo ausente ou que não seja objeto → 400 listando `nome` e `capacidade`.

Ordem de avaliação (para no primeiro erro): **401** (sem token válido) → **403** `SEM_PERMISSAO` (perfil ≠ admin, mesmo com corpo inválido) → **400** `DADOS_INVALIDOS` (todos os campos inválidos em `campos`) → **409** `SALA_DUPLICADA` → **201**.

Observação: o parser de JSON roda depois da autenticação, mas antes da checagem de perfil. Assim, um JSON malformado enviado por um `funcionario` retorna 400 (e não 403).

### GET /salas (`admin` e `funcionario`)

Lista todas as salas, no mesmo formato. **200**, ou **401** sem token.

## Formato padrão de erro

Todos os erros usam (helper em `src/utils/erros.js`; `campos` apenas em 400):

```json
{
  "erro": {
    "codigo": "DADOS_INVALIDOS",
    "mensagem": "Dados inválidos.",
    "campos": [{ "campo": "email", "mensagem": "Formato de e-mail inválido." }]
  }
}
```

Códigos atuais incluem `DADOS_INVALIDOS` (400), `NAO_AUTENTICADO` / `CREDENCIAIS_INVALIDAS` (401), `SEM_PERMISSAO` (403), `ROTA_NAO_ENCONTRADA` / `SALA_NAO_ENCONTRADA` (404), `SALA_DUPLICADA` / `HORARIO_INDISPONIVEL` (409), `ERRO_INTERNO` (500) e `NAO_IMPLEMENTADO` (501).
