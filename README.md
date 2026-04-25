# 📱 App Cobranças — Aplicativo Mobile

Sistema mobile offline-first para gestão de cobranças de equipamentos em locação (bilhares, jukeboxes, mesas e similares). Desenvolvido com **React Native + Expo**, com banco local SQLite e sincronização bidirecional com o servidor web (PostgreSQL via Next.js).

---

## 📑 Índice

- [Visão Geral](#visão-geral)
- [Stack Tecnológica](#stack-tecnológica)
- [Início Rápido](#início-rápido)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Banco de Dados Local (SQLite)](#banco-de-dados-local-sqlite)
- [Arquitetura de Repositórios](#arquitetura-de-repositórios)
- [Serviços Principais](#serviços-principais)
- [Lógica de Negócio — Cobranças](#lógica-de-negócio--cobranças)
- [Sistema de Autenticação](#sistema-de-autenticação)
- [Sistema de Sincronização](#sistema-de-sincronização)
- [Navegação e Telas](#navegação-e-telas)
- [Contextos (State Management)](#contextos-state-management)
- [Componentes](#componentes)
- [Permissões e Controle de Acesso](#permissões-e-controle-de-acesso)
- [Impressão Bluetooth (ESC/POS)](#impressão-bluetooth-escpos)
- [Utilitários](#utilitários)
- [Estrutura de Pastas](#estrutura-de-pastas)
- [Build e Deploy (EAS)](#build-e-deploy-eas)
- [Integração com o Backend Web](#integração-com-o-backend-web)

---

## Visão Geral

O **App Cobranças Mobile** é o ponto de entrada de campo da operação. Os cobradores/operadores o utilizam para:

- 🔓 Fazer login com autenticação offline-first (funciona sem internet)
- 🗺️ Consultar rotas e clientes de sua área de atuação
- 🎱 Visualizar e gerenciar produtos locados
- 💰 Registrar cobranças com leitura de relógio/contador
- 📋 Consultar histórico de cobranças e saldo devedor
- 🔄 Sincronizar dados com o servidor central quando houver conexão
- 🖨️ Imprimir comprovantes em impressoras térmicas Bluetooth (ESC/POS)
- 📊 Gerar relatórios financeiros, de manutenção e de rota diária

---

## Stack Tecnológica

| Tecnologia | Versão | Finalidade |
|---|---|---|
| **Expo** | ~55.0.0 | Plataforma de build e execução |
| **React Native** | 0.83.2 | Framework de UI mobile |
| **React** | 19.2.0 | Biblioteca de interface |
| **TypeScript** | ~5.9.2 | Tipagem estática |
| **expo-sqlite** | ~55.0.10 | Banco de dados local SQLite |
| **React Navigation** | ^7.x | Navegação entre telas |
| **AsyncStorage** | 2.2.0 | Persistência de sessão/token |
| **expo-device** | ~55.0.9 | Informações do dispositivo |
| **expo-constants** | ~55.0.7 | Variáveis de ambiente |
| **Zod** | ^3.25 | Validação de schema de env |
| **Ionicons** | via @expo/vector-icons | Ícones |

---

## Início Rápido

### Pré-requisitos

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Android Studio ou Xcode (para emulação)
- Conta Expo (para builds EAS)

### Instalação

```bash
# 1. Clonar o repositório
git clone https://github.com/rguisantos/app-cobrancas.git
cd app-cobrancas

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas configurações
```

### Executar

```bash
# Desenvolvimento
npm start          # Expo Go (limitado - sem módulos nativos)
npm run android    # Emulador Android
npm run ios        # Simulador iOS

# Testes
npm test
npm run test:coverage
```

---

## Variáveis de Ambiente

O arquivo `.env` configura o comportamento do app via `expo-constants` e `process.env`. Todas as variáveis têm o prefixo `EXPO_PUBLIC_`.

| Variável | Tipo | Padrão | Descrição |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | string | `https://api.seuservidor.com.br` | URL base do backend web |
| `EXPO_PUBLIC_USE_MOCK` | boolean | `false` | Ativa modo de desenvolvimento com dados locais |
| `EXPO_PUBLIC_APP_VERSION` | string | `1.0.0` | Versão do app |
| `EXPO_PUBLIC_APP_NAME` | string | `App Cobranças` | Nome exibido |
| `EXPO_PUBLIC_DEBUG` | boolean | `false` | Logs detalhados no console |
| `EXPO_PUBLIC_SYNC_INTERVAL` | number | `15` | Intervalo de auto-sync em minutos |
| `EXPO_PUBLIC_MAX_RECORDS_PER_SYNC` | number | `100` | Máximo de registros por sync |
| `EXPO_PUBLIC_TIMEOUT` | number | `30000` | Timeout HTTP em ms |
| `EXPO_PUBLIC_MOCK_EMAIL` | string | — | Email do usuário admin de desenvolvimento |
| `EXPO_PUBLIC_MOCK_PASSWORD` | string | — | Senha do usuário admin de desenvolvimento |
| `EXPO_PUBLIC_MOCK_PERMISSION` | enum | `Administrador` | Permissão do usuário mock |

> ⚠️ **CRÍTICO:** Se `USE_MOCK=false` e `API_URL` não estiver configurado, o app logará erro e não conseguirá sincronizar. Configure sempre o `.env` antes de usar em produção.

A validação das variáveis é feita com **Zod** no arquivo `src/config/env.ts`, que emite avisos e erros no console caso a configuração esteja inconsistente.

---

## Banco de Dados Local (SQLite)

O app usa **expo-sqlite** com a classe singleton `DatabaseService` (`src/services/DatabaseService.ts`). O banco se chama `locacao.db` e é criado automaticamente na primeira inicialização.

### Configurações Gerais

- Foreign keys habilitadas via `PRAGMA foreign_keys = ON`
- Soft delete em todas as entidades (campo `deletedAt`)
- Todos os queries de leitura filtram `WHERE deletedAt IS NULL`
- Transações atômicas via `withTransactionAsync`

### Tabelas

#### `clientes`

Armazena clientes (pessoas físicas e jurídicas) que recebem equipamentos em locação.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | TEXT PK | UUID único |
| `tipo` | TEXT | Tipo de entidade para sync (`'cliente'`) |
| `tipoPessoa` | TEXT | `'Fisica'` ou `'Juridica'` |
| `identificador` | TEXT | Código numérico para busca rápida (ex: `"10365"`) |
| `nomeExibicao` | TEXT | Nome curto para listagens |
| `nomeCompleto` | TEXT | Nome completo (PF) |
| `razaoSocial` | TEXT | Razão social (PJ) |
| `nomeFantasia` | TEXT | Nome fantasia (PJ) |
| `cpf` | TEXT | CPF (PF) |
| `cnpj` | TEXT | CNPJ (PJ) |
| `rg` | TEXT | RG |
| `inscricaoEstadual` | TEXT | IE (PJ) |
| `email` | TEXT | Email |
| `telefonePrincipal` | TEXT | Telefone principal |
| `contatos` | TEXT | JSON: array de `Contato[]` |
| `cep` | TEXT | CEP |
| `logradouro` | TEXT | Endereço |
| `numero` | TEXT | Número |
| `complemento` | TEXT | Complemento |
| `bairro` | TEXT | Bairro |
| `cidade` | TEXT | Cidade |
| `estado` | TEXT | UF (ex: `"MS"`) |
| `rotaId` | TEXT | FK lógica para `rotas.id` |
| `rotaNome` | TEXT | Nome da rota (cache desnormalizado) |
| `status` | TEXT | `'Ativo'` ou `'Inativo'` |
| `observacao` | TEXT | Observações |
| *(sync fields)* | — | Ver seção Campos de Sincronização |

**Índices:** `rotaId`, `status`, `(syncStatus, needsSync)`

---

#### `produtos`

Equipamentos físicos identificados por placa/número.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | TEXT PK | UUID único |
| `identificador` | TEXT | Número da placa física (ex: `"515"`) |
| `numeroRelogio` | TEXT | Leitura atual do contador mecânico (ex: `"8070"`) |
| `tipoId` | TEXT | FK para `tipos_produto.id` |
| `tipoNome` | TEXT | Nome do tipo (cache — ex: `"Bilhar"`) |
| `descricaoId` | TEXT | FK para `descricoes_produto.id` |
| `descricaoNome` | TEXT | Nome da descrição (cache — ex: `"Azul"`) |
| `tamanhoId` | TEXT | FK para `tamanhos_produto.id` |
| `tamanhoNome` | TEXT | Nome do tamanho (cache — ex: `"2,20"`) |
| `codigoCH` | TEXT | Código interno CH (opcional) |
| `codigoABLF` | TEXT | Código interno ABLF (opcional) |
| `conservacao` | TEXT | `'Ótima'` \| `'Boa'` \| `'Regular'` \| `'Ruim'` \| `'Péssima'` |
| `statusProduto` | TEXT | `'Ativo'` \| `'Inativo'` \| `'Manutenção'` |
| `estabelecimento` | TEXT | Local de estoque quando não locado |
| `observacao` | TEXT | Observações |
| *(sync fields)* | — | Ver seção Campos de Sincronização |

**Índices:** `statusProduto`, `(syncStatus, needsSync)`

---

#### `locacoes`

Contratos de locação que vinculam produto a cliente.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | TEXT PK | UUID único |
| `clienteId` | TEXT | FK lógica para `clientes.id` |
| `clienteNome` | TEXT | Cache do nome do cliente |
| `produtoId` | TEXT | FK lógica para `produtos.id` |
| `produtoIdentificador` | TEXT | Cache do identificador do produto |
| `produtoTipo` | TEXT | Cache do tipo do produto |
| `dataLocacao` | TEXT | Data de início (ISO string) |
| `dataFim` | TEXT | Data de encerramento (se encerrada) |
| `formaPagamento` | TEXT | `'Periodo'` \| `'PercentualPagar'` \| `'PercentualReceber'` |
| `numeroRelogio` | TEXT | Leitura do relógio na data da locação |
| `precoFicha` | REAL | Valor por ficha/partida |
| `percentualEmpresa` | REAL | % que fica com a empresa |
| `percentualCliente` | REAL | % que fica com o cliente |
| `periodicidade` | TEXT | `'Mensal'` \| `'Semanal'` \| `'Quinzenal'` \| `'Diária'` |
| `valorFixo` | REAL | Valor fixo (apenas forma `Periodo`) |
| `dataPrimeiraCobranca` | TEXT | Data prevista da 1ª cobrança |
| `status` | TEXT | `'Ativa'` \| `'Finalizada'` \| `'Cancelada'` |
| `ultimaLeituraRelogio` | INTEGER | Última leitura registrada em cobrança |
| `dataUltimaCobranca` | TEXT | Data da última cobrança realizada |
| `trocaPano` | INTEGER | Flag se há troca de pano pendente (`0`/`1`) |
| `dataUltimaManutencao` | TEXT | Data da última manutenção |
| *(sync fields)* | — | Ver seção Campos de Sincronização |

**Índices:** `clienteId`, `produtoId`, `status`, `(syncStatus, needsSync)`

---

#### `cobrancas`

Registros de cada cobrança realizada (leitura de relógio + pagamento).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | TEXT PK | UUID único |
| `locacaoId` | TEXT | FK lógica para `locacoes.id` |
| `clienteId` | TEXT | FK lógica para `clientes.id` |
| `clienteNome` | TEXT | Cache do nome do cliente |
| `produtoIdentificador` | TEXT | Cache do identificador do produto |
| `dataInicio` | TEXT | Início do período cobrado |
| `dataFim` | TEXT | Fim do período cobrado |
| `dataPagamento` | TEXT | Data em que o pagamento foi realizado |
| `relogioAnterior` | INTEGER | Leitura anterior do contador |
| `relogioAtual` | INTEGER | Leitura atual do contador |
| `fichasRodadas` | INTEGER | `relogioAtual - relogioAnterior` |
| `valorFicha` | REAL | Valor por ficha no momento da cobrança |
| `totalBruto` | REAL | `fichasRodadas × valorFicha` |
| `descontoPartidasQtd` | INTEGER | Qtd de fichas de desconto |
| `descontoPartidasValor` | REAL | Valor do desconto em fichas |
| `descontoDinheiro` | REAL | Desconto em R$ |
| `percentualEmpresa` | REAL | % da empresa aplicado |
| `subtotalAposDescontos` | REAL | Base após descontos |
| `valorPercentual` | REAL | Valor calculado pelo percentual |
| `totalClientePaga` | REAL | Valor final que o cliente deve pagar |
| `valorRecebido` | REAL | Valor efetivamente recebido |
| `saldoDevedorGerado` | REAL | `totalClientePaga - valorRecebido` (se parcial) |
| `status` | TEXT | `'Pago'` \| `'Parcial'` \| `'Pendente'` \| `'Atrasado'` |
| `dataVencimento` | TEXT | Data de vencimento |
| `observacao` | TEXT | Observações |
| *(sync fields)* | — | Ver seção Campos de Sincronização |

**Índices:** `locacaoId`, `clienteId`, `status`

---

#### `rotas`

Rotas de visitação para organização geográfica dos clientes.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | TEXT PK | UUID único |
| `descricao` | TEXT | Nome da rota (ex: `"Linha Aquidauana"`) |
| `status` | TEXT | `'Ativo'` ou `'Inativo'` |
| *(sync fields)* | — | Ver seção Campos de Sincronização |

**Índices:** `status`, `(syncStatus, needsSync)`

---

#### `usuarios`

Usuários do sistema com permissões e acesso offline.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | TEXT PK | UUID único |
| `email` | TEXT UNIQUE | Email (login) |
| `senha` | TEXT | Hash bcrypt da senha |
| `nome` | TEXT | Nome completo |
| `cpf` | TEXT | CPF |
| `telefone` | TEXT | Telefone |
| `tipoPermissao` | TEXT | `'Administrador'` \| `'Secretario'` \| `'AcessoControlado'` |
| `permissoesWeb` | TEXT | JSON: objeto `PermissoesWeb` |
| `permissoesMobile` | TEXT | JSON: objeto `PermissoesMobile` |
| `rotasPermitidas` | TEXT | JSON: array de IDs de rotas |
| `status` | TEXT | `'Ativo'` ou `'Inativo'` |
| `bloqueado` | INTEGER | `0` ou `1` |
| `dataUltimoAcesso` | TEXT | Timestamp do último acesso |
| `ultimoAcessoDispositivo` | TEXT | Nome do dispositivo |
| *(sync fields)* | — | Ver seção Campos de Sincronização |

**Índices:** `email`, `status`, `(syncStatus, needsSync)`

---

#### `tipos_produto`, `descricoes_produto`, `tamanhos_produto`

Tabelas de atributos para classificação de produtos. Estrutura idêntica:

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | TEXT PK | UUID único |
| `nome` | TEXT NOT NULL | Nome do atributo |
| *(sync fields)* | — | Ver seção Campos de Sincronização |

Exemplos de dados:
- **Tipos:** Bilhar, Jukebox Padrão Grande, Jukebox Padrão Pequena, Mesa
- **Descrições:** Azul, Branco/Carijo, Preto, Vermelho
- **Tamanhos:** 2,00m, 2,20m, Grande, Média

---

#### `estabelecimentos`

Locais de armazenamento/estoque para produtos não locados.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | TEXT PK | UUID único |
| `nome` | TEXT NOT NULL | Nome do estabelecimento (ex: `"Barracão Principal"`) |
| *(sync fields)* | — | Ver seção Campos de Sincronização |

---

#### `manutencoes`

Registro de manutenções e trocas de pano nos produtos.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | TEXT PK | UUID único |
| `produtoId` | TEXT NOT NULL | FK lógica para `produtos.id` |
| `produtoIdentificador` | TEXT | Cache do identificador |
| `produtoTipo` | TEXT | Cache do tipo |
| `clienteId` | TEXT | FK lógica para `clientes.id` (se locado) |
| `clienteNome` | TEXT | Cache do nome do cliente |
| `locacaoId` | TEXT | FK lógica para `locacoes.id` |
| `cobrancaId` | TEXT | FK lógica para `cobrancas.id` |
| `tipo` | TEXT NOT NULL | `'trocaPano'` ou `'manutencao'` |
| `descricao` | TEXT | Descrição detalhada |
| `data` | TEXT NOT NULL | Data da manutenção |
| `registradoPor` | TEXT | Nome/ID do responsável |
| `createdAt` | TEXT | Data de criação |
| `updatedAt` | TEXT | Data de atualização |
| `deletedAt` | TEXT | Soft delete |

**Índices:** `produtoId`, `data`

---

#### `change_log`

Log de todas as alterações locais para envio ao servidor (PUSH).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | TEXT PK | UUID gerado localmente |
| `entityId` | TEXT NOT NULL | ID da entidade alterada |
| `entityType` | TEXT NOT NULL | Tipo (`cliente`, `produto`, etc.) |
| `operation` | TEXT NOT NULL | `'create'` \| `'update'` \| `'delete'` |
| `changes` | TEXT NOT NULL | JSON com os dados alterados |
| `timestamp` | TEXT NOT NULL | ISO timestamp da alteração |
| `deviceId` | TEXT NOT NULL | ID do dispositivo que fez a alteração |
| `synced` | INTEGER | `0` = pendente, `1` = sincronizado |
| `syncedAt` | TEXT | Timestamp de quando foi sincronizado |

**Índices:** `(synced, timestamp)`, `(entityId, entityType)`

---

#### `sync_metadata`

Configurações e estado da sincronização (chave-valor).

| Chave | Descrição |
|---|---|
| `lastSyncAt` | Timestamp da última sync completa |
| `lastPushAt` | Timestamp do último push |
| `lastPullAt` | Timestamp do último pull |
| `syncInProgress` | `true`/`false` |
| `deviceId` | ID único do dispositivo |
| `deviceName` | Nome do dispositivo |
| `deviceKey` | Chave de autenticação para sync |

---

### Campos de Sincronização (em todas as entidades principais)

Todos os campos abaixo existem em `clientes`, `produtos`, `locacoes`, `cobrancas`, `rotas` e `usuarios`:

| Coluna | Tipo | Descrição |
|---|---|---|
| `syncStatus` | TEXT | `'pending'` \| `'syncing'` \| `'synced'` \| `'conflict'` \| `'error'` |
| `lastSyncedAt` | TEXT | ISO timestamp da última sync |
| `needsSync` | INTEGER | `1` = precisa sincronizar, `0` = atualizado |
| `version` | INTEGER | Versão incremental para detecção de conflitos |
| `deviceId` | TEXT | Dispositivo que criou/alterou |
| `createdAt` | TEXT | ISO timestamp de criação |
| `updatedAt` | TEXT | ISO timestamp de última alteração |
| `deletedAt` | TEXT | ISO timestamp de remoção (soft delete) |

---

## Arquitetura de Repositórios

Os repositórios (`src/repositories/`) encapsulam todas as operações de banco de dados, deixando as telas e contextos sem SQL direto.

| Arquivo | Responsabilidade |
|---|---|
| `ClienteRepository.ts` | CRUD de clientes, busca por rota, filtros |
| `ProdutoRepository.ts` | CRUD de produtos, busca de disponíveis, histórico relógio |
| `LocacaoRepository.ts` | CRUD de locações, relocação, envio para estoque |
| `CobrancaRepository.ts` | CRUD de cobranças, histórico, quitação de saldo |
| `UsuarioRepository.ts` | CRUD de usuários, autenticação local |
| `RotaRepository.ts` | CRUD de rotas |
| `AtributosRepository.ts` | Tipos, descrições e tamanhos de produto |
| `ManutencaoRepository.ts` | Registros de manutenção |

Todos os repositórios dependem do singleton `databaseService` e expõem métodos tipados com TypeScript.

---

## Serviços Principais

### `DatabaseService` — `src/services/DatabaseService.ts`

Singleton que gerencia toda a camada SQLite. Inicialização lazy com proteção contra chamadas simultâneas.

**Métodos CRUD Genéricos:**

```typescript
databaseService.save(entityType, entity)        // INSERT ou UPDATE automático
databaseService.getById(entityType, id)          // SELECT por ID
databaseService.getAll(entityType, where, params) // SELECT com filtros
databaseService.update(entityType, entity)        // UPDATE com versionamento
databaseService.delete(entityType, id)            // Soft delete
```

**Métodos de Sincronização:**

```typescript
databaseService.getPendingChanges()              // ChangeLog não sincronizado
databaseService.markAsSynced(changeId)           // Marca como enviado
databaseService.applyRemoteChanges(response)     // Aplica pull do servidor
databaseService.logChange(change)               // Registra no change_log
```

**Métodos de Atributos:**

```typescript
databaseService.getTiposProduto()
databaseService.getDescricoesProduto()
databaseService.getTamanhosProduto()
databaseService.saveTipoProduto(id, nome)
databaseService.saveDescricaoProduto(id, nome)
databaseService.saveTamanhoProduto(id, nome)
databaseService.deleteTipoProduto(id)           // Soft delete
```

**Métodos de Relatório:**

```typescript
databaseService.getResumoFinanceiro(dataInicio?, dataFim?)
// Retorna: totalArrecadado, totalClientePaga, totalDesconto, totalSaldoDevedor, totalCobrancas

databaseService.getCobrancasPorPeriodo(agrupamento, dataInicio?, dataFim?)
// agrupamento: 'dia' | 'semana' | 'mes'
// Usa strftime SQLite para agrupar por período

databaseService.getCobrancasDoDia(data?)
// Retorna cobranças do dia com LEFT JOIN em clientes para buscar rotaNome
```

**Campos Virtuais Excluídos do Banco:**

O `DatabaseService` mantém uma lista de campos que são calculados em memória e nunca persistidos em SQLite:

```
cpfCnpj, rgIe                           (Cliente - campos computados)
locacaoAtiva, estaLocado, locacaoAtual  (Produto - campos de join)
totalLocacoesAtivas, totalLocacoesFinalizadas, saldoDevedorTotal
```

---

### `ApiService` — `src/services/ApiService.ts`

Camada de comunicação HTTP com o backend web. Gerencia token JWT, timeout e erros de rede.

- Envia `Authorization: Bearer <token>` em todas as requisições autenticadas
- Timeout configurável via `ENV.TIMEOUT` (padrão 30s)
- Em modo `USE_MOCK=true`, retorna dados mockados sem chamadas reais

---

### `SyncService` — `src/services/SyncService.ts`

Orquestra a sincronização bidirecional completa.

**Fluxo de Sincronização:**

```
sync()
  ├── ensureDeviceRegistered()       → Verifica se dispositivo está cadastrado
  ├── pushChanges()                  → Envia change_log não sincronizado para /api/sync/push
  │     └── markAsSynced(changeId)  → Marca cada item como enviado
  ├── pullChanges()                  → Busca mudanças em /api/sync/pull
  │     └── applyRemoteChanges()    → Aplica no SQLite sem criar change_log (evita loop)
  └── updateSyncMetadata()          → Atualiza lastSyncAt, lastPushAt, lastPullAt
```

**Auto-sync:**

```typescript
syncService.startAutoSync(15)   // Inicia sync a cada 15 min
syncService.stopAutoSync()       // Para o auto-sync
```

**Eventos de Progresso:**

```typescript
syncService.addListener((progress: SyncProgress) => {
  // progress.phase: 'idle' | 'pushing' | 'pulling' | 'completed' | 'error'
  // progress.message: descrição textual
  // progress.errors: array de erros
})
```

---

### `AuthService` — `src/services/AuthService.ts`

Gerencia autenticação com estratégia offline-first.

**Fluxo de Login:**

```
login(email, password)
  ├── Se USE_MOCK=false:
  │     ├── Tenta POST /api/auth/login
  │     ├── Se sucesso → salva usuário localmente → retorna token
  │     └── Se falha → tenta autenticação local (fallback offline)
  └── Se USE_MOCK=true:
        └── Autentica diretamente no SQLite local
```

**Persistência de Sessão:**

- Token e dados do usuário salvos em `AsyncStorage`
- Chaves configuráveis em `src/config/config.ts`
- `logout()` limpa `tokenStorageKey` e `userStorageKey`

**Inicialização:**

Em `USE_MOCK=true`, o serviço cria automaticamente um usuário `admin@locacao.com` com senha `admin123` e permissão `Administrador`.

---

### `PrintService` — `src/services/PrintService.ts`

Impressão de comprovantes em impressoras térmicas via Bluetooth (protocolo ESC/POS).

A biblioteca `react-native-bluetooth-escpos-printer` é carregada dinamicamente via `require()` para evitar crash quando não instalada. Enquanto não configurada, exibe o comprovante em `Alert`.

**Interface `DadosComprovante`:**

```typescript
{
  empresaNome?, empresaTelefone?,
  clienteNome, produtoTipo, produtoIdentificador,
  formaPagamento, dataCobranca,
  relogioAnterior?, relogioAtual?, fichasRodadas?,
  totalBruto?, descontoPartidas?, descontoDinheiro?,
  percentualEmpresa?, valorEmpresaRecebe?,
  totalClientePaga, valorRecebido?, saldoDevedor?, troco?,
  observacao?
}
```

**Métodos:**

```typescript
PrintService.getDispositivosPareados()         // Lista dispositivos BT pareados
PrintService.conectar(address: string)          // Conecta à impressora
PrintService.imprimirComprovante(dados)         // Imprime comprovante ESC/POS
```

---

## Lógica de Negócio — Cobranças

Todo o cálculo de cobrança está centralizado em `src/services/CobrancaService.ts`.

### Formas de Pagamento

#### `PercentualReceber` — Empresa recebe % do cliente

O cliente paga à empresa um percentual do faturamento bruto.

```
fichasRodadas       = relogioAtual - relogioAnterior
totalBruto          = fichasRodadas × valorFicha
subtotalPartidas    = totalBruto - (descontoPartidasQtd × valorFicha)
valorEmpresaBase    = subtotalPartidas × (percentualEmpresa / 100)
valorPercentual     = valorEmpresaBase - descontoDinheiro  (min. 0)
totalClientePaga    = valorPercentual
valorClienteFica    = subtotalPartidas - valorEmpresaBase
```

#### `PercentualPagar` — Empresa paga % ao cliente

A empresa paga ao cliente um percentual do que o equipamento faturou.

```
fichasRodadas               = relogioAtual - relogioAnterior
totalBruto                  = fichasRodadas × valorFicha
subtotalPartidas            = totalBruto - (descontoPartidasQtd × valorFicha)
subtotalAposDescDinheiro    = subtotalPartidas - descontoDinheiro  (min. 0)
valorPercentual             = subtotalAposDescDinheiro × (percentualEmpresa / 100)
totalClientePaga            = valorPercentual + bonificacao
valorEmpresaRecebe          = subtotalAposDescDinheiro - totalClientePaga
```

#### `Periodo` — Valor fixo periódico

```
totalClientePaga = valorFixo - descontoDinheiro  (min. 0)
```

### Status de Cobrança

| Status | Condição |
|---|---|
| `Pago` | `valorRecebido >= totalClientePaga` |
| `Parcial` | `valorRecebido > 0 AND valorRecebido < totalClientePaga` |
| `Pendente` | `valorRecebido == 0` |
| `Atrasado` | Definido externamente (ex: data de vencimento ultrapassada) |

### Saldo Devedor

```
saldoDevedorGerado = max(0, totalClientePaga - valorRecebido)
```

O saldo devedor de cada locação considera apenas a cobrança mais recente com `status != 'Pago'`, calculado via window function `ROW_NUMBER()` no SQLite.

### Validações

O `CobrancaService.validarCobranca()` retorna `{ valida, erros[], avisos[] }`:

- **Erros:** relógio atual menor que anterior, valor da ficha ≤ 0, percentual fora de 0–100, descontos negativos, total ≤ 0
- **Avisos:** relógio sem alteração, valor muito baixo (< R$1), descontos > 50% do total

### Detecção de Relógio Reiniciado

O `validarLeituraRelogio()` alerta quando:
- Leitura atual < leitura anterior (erro bloqueante)
- Diferença > 100.000 fichas (aviso — possível erro de digitação)

---

## Sistema de Autenticação

### Login Offline-First

O `AuthContext` (`src/contexts/AuthContext.tsx`) coordena o login:

1. Tenta autenticação via API (`/api/auth/login`)
2. Se sem conexão, autentica contra o SQLite local usando bcrypt
3. Token e dados do usuário são persistidos em AsyncStorage

### Ativação de Dispositivo

Novos dispositivos precisam ser ativados pelo administrador antes de sincronizar:

1. Dispositivo gera um ID único baseado em `expo-device`
2. Administrador cadastra o dispositivo no painel web e gera senha numérica de 6 dígitos
3. Usuário insere a senha na tela `DeviceActivationScreen`
4. App confirma via `/api/dispositivos/ativar` e salva `deviceKey` no `sync_metadata`

### Permissões Padrão por Tipo

```typescript
Administrador: {
  web:    { todosCadastros: true,  locacaoRelocacaoEstoque: true,  relatorios: true },
  mobile: { todosCadastros: true,  alteracaoRelogio: true,  locacaoRelocacaoEstoque: true,  cobrancasFaturas: true },
}

Secretario: {
  web:    { todosCadastros: true,  locacaoRelocacaoEstoque: true,  relatorios: true },
  mobile: { todosCadastros: true,  alteracaoRelogio: false, locacaoRelocacaoEstoque: true,  cobrancasFaturas: true },
}

AcessoControlado: {
  web:    { todosCadastros: false, locacaoRelocacaoEstoque: false, relatorios: false },
  mobile: { todosCadastros: false, alteracaoRelogio: false, locacaoRelocacaoEstoque: false, cobrancasFaturas: true },
}
```

---

## Sistema de Sincronização

### Arquitetura

```
App Mobile (SQLite)          Servidor Web (PostgreSQL)
      │                               │
      │  1. PUSH → /api/sync/push     │
      │──────────────────────────────>│
      │  { deviceKey, changes[] }     │
      │<──────────────────────────────│
      │  { conflicts[], errors[] }    │
      │                               │
      │  2. PULL ← /api/sync/pull     │
      │──────────────────────────────>│
      │  { deviceKey, lastSyncAt }    │
      │<──────────────────────────────│
      │  { changes: {...} }           │
```

### PUSH — Mobile → Servidor

1. `getPendingChanges()` coleta todos os registros do `change_log` com `synced = 0`
2. Envia para `/api/sync/push` com `deviceKey` e `lastSyncAt`
3. Para cada item bem-sucedido, executa `markAsSynced(changeId)`

### PULL — Servidor → Mobile

1. Envia `lastSyncAt` para `/api/sync/pull`
2. Servidor retorna entidades modificadas por **outros dispositivos** após essa data
3. `applyRemoteChanges()` aplica os dados no SQLite via `upsertFromSync()`

**Importante:** `applyRemoteChanges()` **não cria entradas no `change_log`** para evitar loop de sincronização.

### Upsert de Usuários (caso especial)

O método `upsertUsuarioFromSync()` usa `INSERT OR REPLACE`, o que sobrescreve todos os campos, incluindo a senha. Se o servidor não enviar o hash bcrypt (por segurança), a senha local fica vazia, quebrando o login offline. Esse comportamento é um **bug conhecido** documentado na análise de bugs do projeto.

### Resolução de Conflitos

Conflito ocorre quando o mesmo registro foi modificado tanto localmente quanto no servidor. Estratégias disponíveis:

| Estratégia | Comportamento |
|---|---|
| `local` | Mantém versão local |
| `remote` | Substitui pela versão do servidor |
| `newest` | Usa o timestamp mais recente |
| `manual` | Dados fornecidos manualmente |

---

## Navegação e Telas

O app usa **React Navigation v7** com estrutura em camadas:

```
RootNavigator
├── Auth (AuthStack)
│   ├── Login
│   └── RecoverPassword
├── DeviceActivation
└── App (ModalStack)
    ├── AppTabs (Bottom Tab Navigator)
    │   ├── Home
    │   ├── ClientesStack
    │   │   ├── ClientesList
    │   │   └── ClientesRotaScreen
    │   ├── ProdutosStack
    │   │   └── ProdutosList
    │   ├── CobrancasStack
    │   │   ├── CobrancasList
    │   │   └── RotasCobranca
    │   └── Mais (MaisScreen)
    └── Modais (NativeStack)
        ├── ClienteDetail
        ├── ClienteForm
        ├── ProdutoDetail
        ├── ProdutoForm
        ├── ProdutoAlterarRelogio
        ├── LocacoesList
        ├── LocacaoForm
        ├── LocacaoDetail
        ├── EnviarEstoque
        ├── CobrancaConfirm         ← Registro principal de cobrança
        ├── CobrancaDetail
        ├── SyncStatus
        ├── Settings
        ├── RotasGerenciar
        ├── AtributosProdutoGerenciar
        ├── UsuariosGerenciar
        ├── RelatorioManutencao
        ├── RelatorioCobrancas
        └── RelatorioSaldoDevedor
```

### Temas

O app suporta tema claro e escuro via `useColorScheme()`:

| Token | Claro | Escuro |
|---|---|---|
| Primary | `#2563EB` | `#3B82F6` |
| Background | `#F8FAFC` | `#0F172A` |
| Card | `#FFFFFF` | `#1E293B` |
| Text | `#1E293B` | `#F1F5F9` |
| Border | `#E2E8F0` | `#334155` |

### Parâmetros de Tela (ModalStackParamList)

```typescript
ClienteDetail:        { clienteId: string }
ClienteForm:          { clienteId?: string; modo: 'criar' | 'editar' }
ProdutoDetail:        { produtoId: string }
ProdutoForm:          { produtoId?: string; modo: 'criar' | 'editar' }
ProdutoAlterarRelogio:{ produtoId: string }
LocacoesList:         { clienteId: string }
LocacaoForm:          { clienteId: string; produtoId?: string; locacaoId?: string; modo: 'criar' | 'editar' | 'relocar' }
LocacaoDetail:        { locacaoId: string }
EnviarEstoque:        { locacaoId: string; produtoId: string }
CobrancaConfirm:      { locacaoId: string; cobrancaId?: string; modo?: 'nova' | 'editar' | 'parcial' }
CobrancaDetail:       { cobrancaId: string }
```

### Telas Principais

| Tela | Arquivo | Função |
|---|---|---|
| **HomeScreen** | `HomeScreen.tsx` | Dashboard com KPIs, cobranças recentes e acesso rápido |
| **ClientesListScreen** | `ClientesListScreen.tsx` | Lista de clientes com busca e filtro por rota/status |
| **ClienteDetailScreen** | `ClienteDetailScreen.tsx` | Detalhes do cliente, locações ativas e histórico |
| **ClienteFormScreen** | `ClienteFormScreen.tsx` | Cadastro/edição com validação de CPF/CNPJ |
| **ClientesRotaScreen** | `ClientesRotaScreen.tsx` | Clientes agrupados por rota |
| **ProdutosListScreen** | `ProdutosListScreen.tsx` | Lista de produtos com filtros de status e disponibilidade |
| **ProdutoDetailScreen** | `ProdutoDetailScreen.tsx` | Detalhes do produto, locação atual e manutenções |
| **ProdutoFormScreen** | `ProdutoFormScreen.tsx` | Cadastro/edição de produto |
| **ProdutoAlterarRelogioScreen** | `ProdutoAlterarRelogioScreen.tsx` | Alteração justificada do contador (requer permissão) |
| **LocacoesListScreen** | `LocacoesListScreen.tsx` | Lista de locações com filtros |
| **LocacaoFormScreen** | `LocacaoFormScreen.tsx` | Nova locação / edição / relocação |
| **LocacaoDetailScreen** | `LocacaoDetailScreen.tsx` | Detalhes da locação e cobranças vinculadas |
| **EnviarEstoqueScreen** | `EnviarEstoqueScreen.tsx` | Encerrar locação e devolver produto ao estoque |
| **CobrancaClienteScreen** | `CobrancaClienteScreen.tsx` | Seleção do cliente para iniciar cobrança |
| **CobrancaConfirmScreen** | `CobrancaConfirmScreen.tsx` | Registro completo da cobrança (leitura + cálculo + pagamento) |
| **CobrancaDetailScreen** | `CobrancaDetailScreen.tsx` | Detalhes de uma cobrança |
| **CobrancasListScreen** | `CobrancasListScreen.tsx` | Histórico de cobranças com filtros |
| **ConfirmacaoPagamentoScreen** | `ConfirmacaoPagamentoScreen.tsx` | Confirmação de pagamento de cobrança pendente |
| **QuitacaoSaldoScreen** | `QuitacaoSaldoScreen.tsx` | Quitar saldo devedor de cobrança parcial |
| **HistoricoCobrancaScreen** | `HistoricoCobrancaScreen.tsx` | Histórico de cobranças por locação |
| **MaisScreen** | `MaisScreen.tsx` | Menu com acesso a sync, configurações, relatórios e admin |
| **SyncStatusScreen** | `SyncStatusScreen.tsx` | Status de sincronização e conflitos |
| **SettingsScreen** | `SettingsScreen.tsx` | Configurações do app |
| **RotasGerenciarScreen** | `RotasGerenciarScreen.tsx` | CRUD de rotas (requer permissão admin) |
| **AtributosProdutoGerenciarScreen** | `AtributosProdutoGerenciarScreen.tsx` | CRUD de tipos, descrições e tamanhos |
| **UsuariosGerenciarScreen** | `UsuariosGerenciarScreen.tsx` | Gestão de usuários (requer permissão admin) |
| **DeviceActivationScreen** | `DeviceActivationScreen.tsx` | Ativação do dispositivo com senha numérica |
| **LoginScreen** | `LoginScreen.tsx` | Login com email e senha |
| **RecoverPasswordScreen** | `RecoverPasswordScreen.tsx` | Recuperação de senha |

### Telas de Relatórios

| Tela | Função |
|---|---|
| `RelatorioFinanceiroScreen` | Resumo financeiro: arrecadado, saldo devedor, descontos por período |
| `RelatorioCobrancasScreen` | Cobranças agrupadas por período (dia/semana/mês) |
| `RelatorioPeriodoScreen` | Cobranças dentro de um intervalo de datas |
| `RelatorioSaldoDevedorScreen` | Clientes com saldo devedor em aberto |
| `RelatorioManutencaoScreen` | Histórico de manutenções e trocas de pano |
| `RelatorioRotaDiariaScreen` | Cobranças do dia agrupadas por rota |

---

## Contextos (State Management)

O app usa exclusivamente React Context API com hooks customizados.

| Contexto | Arquivo | Responsabilidade |
|---|---|---|
| `AuthContext` | `AuthContext.tsx` | Estado de autenticação, login/logout, dados do usuário |
| `DatabaseContext` | `DatabaseContext.tsx` | Inicialização e estado do banco SQLite |
| `SyncContext` | `SyncContext.tsx` | Estado de sincronização, conflitos, ativação de dispositivo |
| `ClienteContext` | `ClienteContext.tsx` | Lista de clientes, filtros, CRUD |
| `ProdutoContext` | `ProdutoContext.tsx` | Lista de produtos, filtros, CRUD |
| `LocacaoContext` | `LocacaoContext.tsx` | Lista de locações, CRUD, relocação |
| `CobrancaContext` | `CobrancaContext.tsx` | Lista de cobranças, CRUD |
| `RotaContext` | `RotaContext.tsx` | Lista de rotas |
| `DashboardContext` | `DashboardContext.tsx` | Métricas e KPIs do dashboard |

### Hooks de Acesso

```typescript
import { useAuth }     from '../contexts/AuthContext';
import { useCliente }  from '../hooks/useCliente';
import { useProduto }  from '../hooks/useProduto';
import { useCobranca } from '../hooks/useCobranca';
import { useSync }     from '../contexts/SyncContext';
```

---

## Componentes

### Componentes Base (`src/components/`)

| Componente | Função |
|---|---|
| `BrandingProvider` | Aplica tema e identidade visual configurável |
| `ConfirmDialog` | Modal de confirmação reutilizável |
| `EmptyState` | Tela de estado vazio com ícone e mensagem |
| `ErrorBoundary` | Captura erros de React e exibe tela de fallback |
| `ErrorScreen` | Tela de erro com opção de retry |
| `FilterChip` | Chip clicável para seleção de filtros |
| `Loading` | Indicador de carregamento |
| `LoadingSpinner` | Spinner simples |
| `MetricCard` | Card para exibição de KPI/métrica |
| `QuickAction` | Botão de ação rápida |
| `SearchBar` | Barra de busca com debounce |
| `StatusBadge` | Badge colorido para status (`Pago`, `Pendente`, etc.) |
| `SyncIndicator` | Indicador de estado de sincronização no header |

### Cards (`src/components/cards/`)

| Componente | Exibe |
|---|---|
| `ClienteCard` | Resumo do cliente (nome, rota, telefone, status) |
| `CobrancaCard` | Resumo da cobrança (produto, valor, status) |
| `LocacaoCard` | Resumo da locação (cliente, produto, forma de pagamento) |
| `ProdutoCard` | Resumo do produto (identificador, tipo, status, cliente) |

### Formulários (`src/components/forms/`)

| Componente | Função |
|---|---|
| `FormActions` | Barra de ações (Salvar/Cancelar) |
| `FormDatePicker` | Seletor de data com validação |
| `FormInput` | Input com label, validação e máscara |
| `FormSection` | Seção com título para agrupar campos |
| `FormSelect` | Seletor dropdown |

---

## Permissões e Controle de Acesso

### Tipos de Permissão

| Tipo | Acesso Mobile |
|---|---|
| `Administrador` | Acesso completo: todos os cadastros, alteração de relógio, locações, cobranças |
| `Secretario` | Todos os cadastros e locações, **sem** alteração de relógio |
| `AcessoControlado` | Apenas cobranças e clientes das rotas permitidas |

### Estrutura de Permissões Mobile

```typescript
interface PermissoesMobile {
  todosCadastros:         boolean; // Criar/editar clientes, produtos
  alteracaoRelogio:       boolean; // Alterar numeração do contador
  locacaoRelocacaoEstoque: boolean; // Criar/encerrar locações
  cobrancasFaturas:       boolean; // Registrar cobranças
}
```

### Filtro por Rota (AcessoControlado)

Usuários com `tipoPermissao = 'AcessoControlado'` só visualizam clientes e cobranças das rotas definidas em `rotasPermitidas` (array de IDs sincronizado do servidor).

---

## Impressão Bluetooth (ESC/POS)

O `PrintService` gera comprovantes formatados para impressoras térmicas de 32 colunas.

**Estrutura do comprovante:**

```
================================
       NOME DA EMPRESA         
================================
Cliente: João da Silva
Produto: Bilhar #515
Data: 28/03/2026
--------------------------------
Relógio Ant:        8.000
Relógio Atu:        8.120
Fichas Rodadas:       120
--------------------------------
Total Bruto:        R$ 60,00
Desc. Partidas:     R$  2,00
Percentual (50%):   R$ 29,00
--------------------------------
TOTAL A PAGAR:      R$ 29,00
Valor Recebido:     R$ 30,00
TROCO:              R$  1,00
================================
```

**Instalação da biblioteca nativa:**

```bash
npm install react-native-bluetooth-escpos-printer
# + Expo Dev Client com plugin nativo
```

---

## Utilitários

### `currency.ts` — Formatação monetária

```typescript
formatarMoeda(1234.56)           // "R$ 1.234,56"
formatarNumero(8000)             // "8.000"
formatarPorcentagem(50)          // "50%"
parseCurrency("R$ 1.234,56")    // 1234.56
```

### `masks.ts` — Máscaras de entrada

```typescript
mascaraCPF("12345678901")        // "123.456.789-01"
mascaraCNPJ("12345678000195")    // "12.345.678/0001-95"
mascaraTelefone("11999999999")   // "(11) 99999-9999"
mascaraCEP("01234567")           // "01234-567"
```

### `validators.ts` — Validações

```typescript
validarCPF(cpf)                  // boolean
validarCNPJ(cnpj)                // boolean
validarEmail(email)              // boolean
validarTelefone(tel)             // boolean
```

### `logger.ts` — Log estruturado

```typescript
logger.info('Mensagem', { dados })
logger.warn('Aviso', { dados })
logger.error('Erro', error)
// Em DEBUG=false, logs são suprimidos em produção
```

---

## Estrutura de Pastas

```
app-cobrancas/
├── src/
│   ├── __mocks__/               # Mocks para testes (expo-sqlite)
│   ├── components/              # Componentes reutilizáveis
│   │   ├── cards/               # Cards de entidades
│   │   └── forms/               # Componentes de formulário
│   ├── config/
│   │   ├── branding.ts          # Identidade visual configurável
│   │   ├── config.ts            # Chaves do AsyncStorage e constantes
│   │   └── env.ts               # Variáveis de ambiente com validação Zod
│   ├── contexts/                # React Contexts (state management)
│   ├── hooks/                   # Hooks de acesso aos contextos
│   ├── navigation/              # Configuração de navegação
│   │   ├── AppNavigator.tsx     # Navegador principal (Auth + App + Modais)
│   │   ├── AuthNavigator.tsx    # Stack de autenticação
│   │   ├── ClientesStack.tsx    # Stack de clientes
│   │   ├── CobrancasStack.tsx   # Stack de cobranças
│   │   ├── ProdutosStack.tsx    # Stack de produtos
│   │   └── RootNavigator.tsx    # Raiz da navegação
│   ├── repositories/            # Camada de acesso ao banco (SQLite)
│   ├── screens/                 # Telas da aplicação
│   ├── services/
│   │   ├── ApiService.ts        # Comunicação HTTP
│   │   ├── AtributosProdutoService.ts
│   │   ├── AuthService.ts       # Autenticação offline-first
│   │   ├── CobrancaService.ts   # Cálculos e regras de cobrança
│   │   ├── DatabaseService.ts   # SQLite singleton
│   │   ├── LocalizacaoService.ts # ViaCEP e IBGE
│   │   ├── PrintService.ts      # Impressão Bluetooth ESC/POS
│   │   └── SyncService.ts       # Sincronização bidirecional
│   ├── types/
│   │   └── index.ts             # Todos os tipos TypeScript
│   └── utils/
│       ├── currency.ts          # Formatação monetária
│       ├── logger.ts            # Logger estruturado
│       ├── masks.ts             # Máscaras de entrada
│       └── validators.ts        # Validações de CPF, CNPJ, etc.
├── assets/                      # Ícones e splash screen
├── App.tsx                      # Ponto de entrada, providers
├── index.ts                     # Entry point Expo
├── app.json                     # Configuração Expo
├── eas.json                     # Configuração EAS Build
├── babel.config.js
├── metro.config.js
├── tsconfig.json
└── package.json
```

---

## Build e Deploy (EAS)

O projeto usa **Expo Application Services (EAS)** para builds.

```bash
# Instalar EAS CLI
npm install -g eas-cli

# Login
eas login

# Build de desenvolvimento (APK com Dev Client)
eas build --profile development --platform android

# Build de produção
eas build --profile production --platform android
eas build --profile production --platform ios

# Submit para lojas
eas submit --platform android
eas submit --platform ios
```

Perfis configurados em `eas.json`:

| Perfil | Uso |
|---|---|
| `development` | APK com Expo Dev Client para testes com módulos nativos |
| `preview` | APK distribuição interna (TestFlight / arquivo APK) |
| `production` | Bundle para Google Play / App Store |

---

## Integração com o Backend Web

Endpoints consumidos pelo app mobile:

| Endpoint | Método | Uso |
|---|---|---|
| `/api/health` | GET | Verificar conectividade |
| `/api/auth/login` | POST | Login com email/senha |
| `/api/sync/push` | POST | Enviar mudanças locais |
| `/api/sync/pull` | POST | Receber mudanças remotas |
| `/api/dispositivos/ativar` | POST | Ativar dispositivo com senha numérica |
| `/api/dispositivos/status` | POST | Verificar status de ativação pendente |
| `/api/dashboard/mobile` | GET | Métricas do dashboard |

Configurar `EXPO_PUBLIC_API_URL` com a URL do servidor web para habilitar a sincronização.

---

## Licença

Propriedade privada. Todos os direitos reservados.
