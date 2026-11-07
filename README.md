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

### POST /login (única rota pública)

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

Códigos atuais: `DADOS_INVALIDOS` (400), `NAO_AUTENTICADO` (401), `CREDENCIAIS_INVALIDAS` (401), `SEM_PERMISSAO` (403), `ROTA_NAO_ENCONTRADA` (404), `ERRO_INTERNO` (500), `NAO_IMPLEMENTADO` (501).
