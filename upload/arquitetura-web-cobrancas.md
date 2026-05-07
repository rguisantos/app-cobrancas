**APP COBRANÇAS**

Arquitetura da Versão Web + Backend

*Sincronização Bidirecional com Mobile*

  ----------------------------------- -----------------------------------
  **Versão**                          1.0 --- Março 2026

  ----------------------------------- -----------------------------------

**1. Visão Geral da Solução**

O sistema é composto por três camadas integradas que compartilham os
mesmos dados de forma bidirecional:

+---+------------------------------------------------------------------+
| 📱 | **Mobile (existente)**                                          |
|   |                                                                  |
|   | React Native + Expo SDK 55 + SQLite offline-first                |
+---+------------------------------------------------------------------+

+---+------------------------------------------------------------------+
| 🌐 | **Web + Admin (a desenvolver)**                                 |
|   |                                                                  |
|   | Next.js 15 --- frontend web completo e painel administrativo     |
+---+------------------------------------------------------------------+

+---+------------------------------------------------------------------+
| ⚙️ | **Backend API (a desenvolver)**                                 |
|   |                                                                  |
|   | Next.js API Routes + PostgreSQL + Prisma --- fonte central de    |
|   | dados                                                            |
+---+------------------------------------------------------------------+

**Diagrama de Arquitetura**

+--------------------+-------+-----------------+-------+------------+
| **📱 MOBILE**      | **⟵   | **⚙️ BACKEND    | *     | **🌐 WEB** |
|                    | sync  | API**           | *⟵⟶** |            |
| React Native       | ⟶**   |                 |       | Next.js    |
|                    |       | Next.js +       |       |            |
| SQLite local       |       | Prisma          |       | React +    |
|                    |       |                 |       | shadcn     |
|                    |       | PostgreSQL      |       |            |
+--------------------+-------+-----------------+-------+------------+

**2. Stack Tecnológica**

A escolha por Next.js como framework unificado permite desenvolver o
backend (API Routes) e o frontend web em um único repositório, reduzindo
complexidade operacional e reutilizando tipos TypeScript já definidos no
mobile.

**2.1 Por que Next.js?**

  ---------------------------- ------------------------------------------
  **Necessidade**              **Como o Next.js atende**

  Backend + Frontend juntos    API Routes no mesmo projeto --- sem
                               servidor separado para iniciar

  Tipos compartilhados com     TypeScript nativo --- os tipos do mobile
  mobile                       são reaproveitados diretamente

  Endpoints de sync já         /api/sync/push e /api/sync/pull prontos
  mapeados                     para implementar

  Deploy simplificado          Vercel ou servidor Node --- um único
                               artefato de build

  Server-Side Rendering        Relatórios e dashboards com dados frescos
                               sem client-side fetch

  Autenticação integrada       NextAuth.js com suporte a JWT, sessions e
                               OAuth
  ---------------------------- ------------------------------------------

**2.2 Dependências Principais**

  ------------------------ ------------- ---------------------------------------
  **Pacote**               **Versão**    **Função**

  next                     15.x          Framework full-stack (frontend + API)

  react / react-dom        19.x          Mesma versão do mobile

  typescript               5.x           Mesma versão do mobile

  prisma                   6.x           ORM --- modelagem e queries do
                                         PostgreSQL

  \@prisma/client          6.x           Client gerado automaticamente pelo
                                         Prisma

  next-auth                5.x (beta)    Autenticação --- JWT compatível com o
                                         mobile

  zod                      3.x           Validação de schema --- já usado no
                                         mobile

  tailwindcss              4.x           Estilização utilitária

  shadcn/ui                latest        Componentes UI baseados em Radix

  \@tanstack/react-table   8.x           Tabelas com sort, filter e paginação

  recharts                 2.x           Gráficos para dashboard e relatórios

  date-fns                 3.x           Manipulação de datas

  bcryptjs                 2.x           Hash de senhas (melhoria também para o
                                         mobile)
  ------------------------ ------------- ---------------------------------------

**3. Estrutura do Projeto**

O projeto web fica em um repositório separado do mobile. A pasta shared/
contém os tipos TypeScript copiados (ou via package privado) do mobile
para garantir consistência.

**3.1 Estrutura de Pastas**

  ------------------------ ----------------------------------------------
  **app-cobrancas-web/**   --- Raiz do projeto Next.js

  ├── app/                 --- App Router do Next.js

  │ ├── (auth)/            --- Rotas de autenticação (login, reset)

  │ ├── (web)/             --- Aplicação web completa (usuários comuns)

  │ │ ├── clientes/        --- Listagem, detalhes e cadastro

  │ │ ├── produtos/        --- Listagem, detalhes e cadastro

  │ │ ├── locacoes/        --- Contratos de locação

  │ │ ├── cobrancas/       --- Histórico e registro de cobranças

  │ │ └── relatorios/      --- Relatórios financeiros e operacionais

  │ ├── (admin)/           --- Painel administrativo separado

  │ │ ├── dashboard/       --- Métricas e KPIs gerenciais

  │ │ ├── usuarios/        --- Gerenciar usuários e permissões

  │ │ ├── rotas/           --- Gerenciar rotas de cobrança

  │ │ ├── dispositivos/    --- Equipamentos móveis registrados

  │ │ └── sync/            --- Monitor de sincronização

  │ └── api/               --- API Routes (backend)

  │ ├── auth/              --- Login, logout, refresh token

  │ ├── sync/              --- /push e /pull (usado pelo mobile)

  │ ├── clientes/          --- CRUD completo

  │ ├── produtos/          --- CRUD completo

  │ ├── locacoes/          --- CRUD completo

  │ ├── cobrancas/         --- CRUD completo

  │ └── health/            --- Healthcheck (já esperado pelo mobile)

  ├── prisma/              --- Schema e migrations do banco

  ├── shared/              --- Tipos TypeScript compartilhados com mobile

  ├── lib/                 --- Prisma client, auth, helpers

  └── components/          --- Componentes de UI reutilizáveis
  ------------------------ ----------------------------------------------

**4. Banco de Dados --- PostgreSQL + Prisma**

O PostgreSQL é a fonte central de verdade. O mobile sincroniza seu
SQLite local com este banco através dos endpoints de sync. O schema do
Prisma espelha exatamente os tipos TypeScript já definidos no mobile.

**4.1 Entidades Principais**

  --------------- ------------------ -------------------------------------
  **Entidade**    **Tabela           **Descrição**
                  PostgreSQL**       

  Cliente         clientes           Pessoas físicas e jurídicas --- com
                                     endereço e contatos

  Produto         produtos           Equipamentos (bilhares, jukeboxes,
                                     mesas) com relógio/contador

  Locação         locacoes           Contrato cliente × produto --- define
                                     forma de pagamento

  Cobrança        cobrancas          Registro de cada cobrança realizada
                                     em campo

  Rota            rotas              Agrupamento de clientes por rota de
                                     visitação

  Usuário         usuarios           Usuários com tipo de permissão e
                                     rotas autorizadas

  Dispositivo     dispositivos       Equipamentos móveis registrados para
                                     sincronização

  ChangeLog       change_logs        Log de alterações para sincronização
                                     bidirecional

  SyncConflict    sync_conflicts     Conflitos detectados aguardando
                                     resolução
  --------------- ------------------ -------------------------------------

**4.2 Campos de Sincronização (em todas as tabelas)**

Todo modelo herda os seguintes campos obrigatórios, que espelham a
interface SyncableEntity já definida no mobile:

  --------------- ------------------ -------------------------------------
  **Campo**       **Tipo**           **Descrição**

  id              String (UUID)      Identificador único --- gerado no
                                     mobile, mantido no servidor

  createdAt       DateTime           Data de criação original

  updatedAt       DateTime           Data da última alteração

  deletedAt       DateTime?          Soft delete --- null = ativo

  syncStatus      Enum               pending \| synced \| conflict \|
                                     error

  version         Int                Incrementado a cada alteração ---
                                     detecta conflitos

  deviceId        String             ID do dispositivo que originou a
                                     mudança

  needsSync       Boolean            Indica se precisa ser enviado aos
                                     dispositivos
  --------------- ------------------ -------------------------------------

**4.3 Trecho do Schema Prisma**

> // prisma/schema.prisma
>
> model Cliente {
>
> id String \@id \@default(uuid())
>
> tipoPessoa String
>
> nomeExibicao String
>
> email String?
>
> rotaId String
>
> status String \@default(\"Ativo\")
>
> // Campos de sync
>
> syncStatus String \@default(\"synced\")
>
> version Int \@default(1)
>
> deviceId String
>
> needsSync Boolean \@default(false)
>
> deletedAt DateTime?
>
> createdAt DateTime \@default(now())
>
> updatedAt DateTime \@updatedAt
>
> // Relações
>
> rota Rota \@relation(fields: \[rotaId\], references: \[id\])
>
> locacoes Locacao\[\]
>
> cobrancas Cobranca\[\]
>
> }

**5. API de Sincronização Bidirecional**

Esta é a peça central que conecta o mobile ao servidor. O mobile já tem
o ApiService implementado esperando exatamente estes endpoints. Basta o
backend implementá-los corretamente.

**5.1 Endpoints de Sync (já consumidos pelo mobile)**

  ------------ ---------------------- ---------------------------------------
  **Método**   **Endpoint**           **Função**

  POST         /api/sync/push         Mobile envia suas alterações locais
                                      (ChangeLog\[\]) ao servidor

  POST         /api/sync/pull         Mobile solicita alterações do servidor
                                      desde o último sync

  POST         /api/equipamentos      Mobile se registra com deviceId e
                                      deviceKey

  GET          /api/health            Verificação de disponibilidade da API

  POST         /api/auth/login        Login de usuários web e mobile

  POST         /api/auth/refresh      Renovação de token JWT
  ------------ ---------------------- ---------------------------------------

**5.2 Fluxo de Push (Mobile → Servidor)**

  --------------------- -------------------------------------------------
  **Passo**             **O que acontece**

  1\. Mobile detecta    Qualquer create/update/delete grava um ChangeLog
  mudança               local com operation e changes

  2\. Mobile chama POST Envia { deviceId, deviceKey, lastSyncAt, changes:
  /sync/push            ChangeLog\[\] }

  3\. Servidor valida o Verifica deviceId e deviceKey na tabela
  dispositivo           dispositivos

  4\. Servidor processa Para cada item: aplica no PostgreSQL ou detecta
  cada change           conflito por version

  5\. Conflito          Se version do servidor \> version do mobile:
  detectado             grava em sync_conflicts

  6\. Resposta ao       Retorna { success, lastSyncAt, conflicts\[\] }
  mobile                para o mobile processar
  --------------------- -------------------------------------------------

**5.3 Fluxo de Pull (Servidor → Mobile)**

  --------------------- -------------------------------------------------
  **Passo**             **O que acontece**

  1\. Mobile chama POST Envia { deviceId, deviceKey, lastSyncAt }
  /sync/pull            

  2\. Servidor busca    SELECT \* WHERE updatedAt \> lastSyncAt AND
  mudanças              deviceId != deviceId_solicitante

  3\. Agrupa por        Retorna { clientes\[\], produtos\[\],
  entidade              locacoes\[\], cobrancas\[\], rotas\[\] }

  4\. Mobile aplica     Para cada entidade: INSERT OR REPLACE no SQLite
  mudanças              local

  5\. Mobile atualiza   Salva o novo timestamp para o próximo pull
  lastSyncAt            
  --------------------- -------------------------------------------------

**5.4 Resolução de Conflitos**

A estratégia ConflictResolutionStrategy já está definida nos tipos do
mobile. O servidor segue a mesma lógica:

  ---------------- -------------------------------------------------------
  **Estratégia**   **Comportamento**

  newest           Vence quem tem o updatedAt mais recente --- padrão para
                   a maioria dos casos

  remote           Servidor sempre vence --- usado para entidades críticas
                   como cobranças já pagas

  local            Mobile vence --- usado quando o usuário edita
                   conscientemente offline

  manual           Grava o conflito em sync_conflicts --- admin resolve
                   pelo painel web
  ---------------- -------------------------------------------------------

**6. Autenticação e Permissões**

O sistema de permissões do mobile (Administrador, Secretario,
AcessoControlado) é replicado exatamente na web. O mesmo JWT é aceito
por ambas as plataformas.

**6.1 Fluxo de Autenticação**

  ------------- ---------------------------- ----------------------------
  **Passo**     **Mobile**                   **Web**

  Login         POST /api/auth/login → JWT   POST /api/auth/login → JWT
                armazenado em AsyncStorage   em httpOnly cookie

  Sessão        Token enviado no header      NextAuth.js gerencia sessão
                Authorization: Bearer        automaticamente

  Expiração     Token com 30 dias ---        Renovação transparente pelo
                refresh automático pelo      NextAuth
                mobile                       

  Logout        Remove token do AsyncStorage NextAuth.js invalida a
                                             sessão
  ------------- ---------------------------- ----------------------------

**6.2 Matriz de Permissões**

  ------------------------ ------------------- ---------------- ---------------------
  **Funcionalidade**       **Administrador**   **Secretario**   **Acesso Controlado**

  Dashboard e métricas     ✅                  ✅               ❌

  Cadastro de clientes     ✅                  ✅               ❌

  Cadastro de produtos     ✅                  ✅               ❌

  Contratos de locação     ✅                  ✅               ❌

  Registro de cobranças    ✅                  ✅               ✅ (rotas permitidas)

  Relatórios financeiros   ✅                  ✅               ❌

  Gerenciar usuários       ✅                  ❌               ❌

  Gerenciar rotas          ✅                  ❌               ❌

  Monitor de sync          ✅                  ❌               ❌

  Resolver conflitos       ✅                  ❌               ❌
  ------------------------ ------------------- ---------------- ---------------------

**7. Módulos da Aplicação Web**

+---+------------------------------------------------------------------+
| 🌐 | **App Web --- para usuários operacionais**                      |
|   |                                                                  |
|   | Acesso por secretários e administradores no escritório           |
+---+------------------------------------------------------------------+

**7.1 Dashboard Principal**

-   Cards de KPIs: total de clientes ativos, produtos locados, cobranças
    do mês, saldo devedor

-   Gráfico de receita por período (recharts)

-   Tabela de últimas cobranças com status

-   Alertas: cobranças atrasadas, conflitos de sync pendentes, produtos
    em manutenção

**7.2 Módulo de Clientes**

-   Listagem com busca, filtros por rota e status --- paginação
    server-side

-   Página de detalhes: dados do cliente, contratos ativos, histórico de
    cobranças

-   Formulário de cadastro/edição com validação Zod --- mesmo schema do
    mobile

-   Exportação para Excel/CSV

**7.3 Módulo de Produtos**

-   Listagem por tipo, estado de conservação e status
    (Ativo/Manutenção/Estoque)

-   Rastreamento de localização: em qual cliente está locado

-   Histórico de alterações do relógio/contador

-   Registro de manutenções

**7.4 Módulo de Cobranças**

-   Histórico completo de cobranças com filtros por período, cliente e
    rota

-   Detalhamento: leitura do relógio, cálculo de fichas, descontos e
    valor pago

-   Registro manual de cobranças pela web (mesmo fluxo do mobile)

-   Quitação de saldo devedor

**7.5 Relatórios**

-   Financeiro: receitas por período, por rota, por produto

-   Saldo devedor: clientes com débitos em aberto

-   Rota diária: clientes a visitar por rota

-   Manutenções: produtos com necessidade de manutenção

-   Exportação em PDF e Excel

+---+------------------------------------------------------------------+
| 🔧 | **Painel Admin --- separado por rota de acesso**                |
|   |                                                                  |
|   | Exclusivo para Administradores --- /admin/\*                     |
+---+------------------------------------------------------------------+

**7.6 Gerenciamento de Usuários**

-   Listagem de todos os usuários com tipo de permissão e status

-   Criar/editar usuário com definição de tipo e rotas permitidas

-   Bloqueio/desbloqueio de acesso

-   Reset de senha

**7.7 Monitor de Sincronização**

-   Listagem de dispositivos registrados com status do último sync

-   Log de operações de sync em tempo real

-   Lista de conflitos pendentes com interface para resolução manual

-   Histórico de erros de sincronização por dispositivo

**7.8 Configurações do Sistema**

-   White label: nome da empresa, cores, logo

-   Valores padrão: preço de ficha, percentual empresa, dias de alerta
    de atraso

-   Gerenciamento de rotas de cobrança

-   Atributos de produto: tipos, descrições, tamanhos

**8. Deploy e Infraestrutura**

**8.1 Opções de Deploy**

  -------------------- ---------------------------- -------------------------
  **Opção**            **Vantagens**                **Indicado para**

  Vercel (recomendado) Deploy automático via Git,   Início rápido e projetos
                       SSL gratuito, CDN global,    em crescimento
                       zero configuração            

  Railway              PostgreSQL gerenciado        Quando quer banco e app
                       integrado, deploy simples,   no mesmo provider
                       bom custo-benefício          

  VPS                  Controle total, menor custo  Quando há requisito de
  (DigitalOcean/AWS)   a longo prazo, dados no      dados on-premise
                       Brasil                       
  -------------------- ---------------------------- -------------------------

**8.2 Variáveis de Ambiente do Backend**

  ------------------------ ------------------------------------------------
  **Variável**             **Descrição**

  DATABASE_URL             Connection string do PostgreSQL

  NEXTAUTH_SECRET          Chave secreta para assinar JWTs (mín. 32
                           caracteres)

  NEXTAUTH_URL             URL pública da aplicação (ex:
                           https://cobrancas.suaempresa.com.br)

  JWT_EXPIRES_IN           Tempo de expiração do token (ex: 30d)

  SYNC_CONFLICT_STRATEGY   Estratégia padrão de conflito: newest \| remote
                           \| local

  BCRYPT_ROUNDS            Rounds do bcrypt para hash de senha
                           (recomendado: 12)
  ------------------------ ------------------------------------------------

**8.3 Ordem de Desenvolvimento Sugerida**

  ------------------ --------------------------------- -------------------
  **Fase**           **Entregável**                    **Prioridade**

  1 --- Backend Core Schema Prisma, migrations,        🔴 Crítico
                     endpoints /auth e /health         

  2 --- Sync API     POST /sync/push e /sync/pull      🔴 Crítico
                     funcionando com o mobile real     

  3 --- CRUD API     Endpoints REST para clientes,     🟠 Alta
                     produtos, locações e cobranças    

  4 --- Auth Web     NextAuth.js configurado, tela de  🟠 Alta
                     login, proteção de rotas          

  5 --- Dashboard    Página inicial com KPIs e         🟡 Média
                     gráficos                          

  6 --- Módulos Web  Clientes, Produtos, Cobranças,    🟡 Média
                     Relatórios                        

  7 --- Painel Admin Usuários, Monitor de Sync,        🟡 Média
                     Configurações                     

  8 --- Polimento    Exportações, notificações, PWA,   🔵 Baixa
                     testes E2E                        
  ------------------ --------------------------------- -------------------

**9. Próximos Passos Imediatos**

Para iniciar o desenvolvimento, os primeiros arquivos a criar são:

**9.1 Setup Inicial**

-   npx create-next-app@latest app-cobrancas-web \--typescript
    \--tailwind \--app

-   npx prisma init --- configura o schema e o client

-   npm install next-auth \@prisma/client zod bcryptjs shadcn-ui

-   npx shadcn@latest init --- configura componentes de UI

**9.2 Shared Types**

Copiar src/types/index.ts do mobile para shared/types.ts no projeto web.
Ambos os projetos passam a importar deste arquivo compartilhado,
garantindo que SyncPayload, ChangeLog, Cliente, Produto, etc. sejam
idênticos nas duas plataformas.

**9.3 Primeira validação de integração**

Antes de construir qualquer tela, o primeiro milestone de sucesso é:

-   Backend rodando localmente na porta 3000

-   Mobile apontando EXPO_PUBLIC_API_URL para http://localhost:3000

-   GET /api/health retornando { ok: true }

-   POST /api/auth/login autenticando com as mesmas credenciais do
    SQLite

-   POST /api/sync/push processando um ChangeLog real do mobile

-   POST /api/sync/pull retornando dados ao mobile

Com esses seis pontos funcionando, a integração bidirecional está
validada e o desenvolvimento do frontend web pode avançar com segurança.
