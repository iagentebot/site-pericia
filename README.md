# Richter Perícia

> Um SaaS de gestão de perícias judiciais para times jurídicos e especialistas técnicos.

O **Richter Perícia** foi desenhado como um painel único (SaaS) para acompanhar processos, pagamentos e colaboradores dentro de uma estrutura segura. Ele combina uma landing page institucional com um módulo administrativo protegido por login Google + controles de perfil (admin, edição e somente leitura).

## O que o SaaS entrega hoje

1. **Porta de entrada rica** – página inicial com hero, áreas de atuação, serviços e contatos pensados para converter novos clientes.
2. **Lista de processos viva** – cards dinâmicos com filtros por status, busca textual por autor, réu ou número de processo e badges coloridas para status, justiça e tipo de perícia.
3. **Relatórios financeiros** – modal de pagamentos que agrupa recibos por mês, calcula impostos e soma totais para auxiliar cobranças e faturamento mensal.
4. **Fluxo protegido** – apenas usuários logados (via Google) acessam `/processes` e, dependendo da role, podem adicionar ou apenas consultar.
5. **Fallback inteligente** – quando o banco de dados MySQL não está configurado, o front-end usa dados mockados e garante que o painel continue funcional em demonstrações.

## Arquitetura & stack

- **Frontend:** Next.js 14 (App Router habitual no `pages/`), React 18 e Tailwind + design radiante (gradientes e animações). O site público (`/`) consome seções organizadas e o dashboard requer login autenticado.
- **API:** rotas em `pages/api/*` atendem login/logout, sessão, Google OAuth e proxies para o banco (processos + pagamentos). Tudo roda sobre o `server.js` customizado para produção (`node server.js`).
- **Autenticação:** JWT assinado com `JWT_SECRET`, cookie `session` de 8h e refresh a cada login. O `session` expõe o usuário com e-mail, nome, foto e papéis.
- **Dados:** o conector MySQL vive em `pages/api/processes.ts` → se não houver `DB_HOST`/`DB_USER`/`DB_DATABASE`, ele responde 204 e o front usa `mockProcesses` de `services/processService.ts`.

## Papéis e login (Google + roles)

1. Configure o login via Google definindo:
   - `GOOGLE_CLIENT_ID` (usado pelo backend para validar o `id_token`)
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (necessário para o botão proprietário `@react-oauth/google`)
2. Regras de papéis (roles) por e-mail/domínio:
   - `ROLE_ADMIN_ENTRIES` → lista separada por `,`/`;` de e-mails ou domínios (`@exemplo.com`)
   - `ROLE_CONTRIBUTOR_ENTRIES` → quem pode adicionar/editar processos
   - `ROLE_READONLY_ENTRIES` → quem só lê o painel
   - Se um usuário não bater com nenhuma entrada, ele herdará `readonly` por padrão.
3. Os papéis chegam no JWT e são exibidos no cabeçalho do painel, guiando quais botões aparecem (por exemplo, `+ Adicionar Processo` só aparece para admins e contribuidores).
4. Para sair, o botão chama `/api/logout` que zera o cookie `session`.

## Variáveis de ambiente obrigatórias

| Variável | Uso | Exemplo / Observações |
| --- | --- | --- |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Token público para o botão de login do Google (cliente). | `1234567890-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_ID` | Validação do `id_token` no backend. | mesmo valor que o anterior |
| `JWT_SECRET` | Segredo para assinar o JWT. | string com pelo menos 32 caracteres |
| `ROLE_ADMIN_ENTRIES` | E-mails sobrepostos ao papel `admin`. | `bruno@empresa.com,@empresa.com` |
| `ROLE_CONTRIBUTOR_ENTRIES` | E-mails com permissão de edição. | `equipe@empresa.com` |
| `ROLE_READONLY_ENTRIES` | Observadores com acesso somente leitura. | `auditoria@empresa.com` |
| `DB_HOST`, `DB_USER`, `DB_DATABASE`, `DB_PASSWORD` | Conexão com MySQL (opcional). Se faltarem, o app usa dados fictícios por padrão. |
| `DB_PORT`, `DB_CHARSET` | Portas e charset extras quando necessário. |
| `NEXT_PUBLIC_API_BASE_URL` | Se quiser direcionar as chamadas `services/processService` para outro backend. |
| `COOKIE_SECURE` | `true`/`false` para forçar cookie seguro. |

## Executando localmente

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Ajuste o arquivo `.env.local` (ou exporte as variáveis acima) e garanta que `JWT_SECRET` e o login Google estejam configurados.
3. Rode em modo dev (porta padrão 3000 ou via `PORT=4000 npm run dev`):
   ```bash
   npm run dev -- --hostname 0.0.0.0 --port 4000
   ```
4. Para produção, construa e execute via `server.js`:
   ```bash
   npm run build
   npm start
   ```

## Operações extras

- Para forçar logout para o usuário atual, chame `POST /api/logout`.
- A rota `GET /api/session` devolve usuário logado (usada pelo contexto do React).
- Para personalizar o fluxo de login, altere `lib/roles.ts` com novos papéis e descrições.
- Os componentes `pages/processes/*` já estão prontos para extender formulários e relatórios.

## Segurança e observações

1. Não adicione segredos diretamente no repositório. Use `.env.local`, vault ou o Key Manager de sua infraestrutura.
2. O JWT fica em cookie HttpOnly e é renovado a cada login para reduzir riscos de CSRF.
3. Configure o OAuth do Google com os domínios de callback (`http://localhost:3000` ou sua URL real) para evitar erro `invalid_client`.
4. Se quiser rodar o site em um domínio diferente, atualize `NEXT_PUBLIC_API_BASE_URL` e valide os cabeçalhos CORS.

O **Richter Perícia** é um MVP pronto para crescer: tem base sólida de Next.js, rotas com sessões e uma estrutura de papéis que garante que somente quem deve editar vai ter botões visíveis no painel.
