# 🎱 App Cobranças

Aplicativo mobile completo para gestão de locações e cobranças de equipamentos (bilhares, jukeboxes, mesas), desenvolvido com React Native e Expo SDK 55.

## 📱 Sobre o Sistema

O **App Cobranças** é uma solução mobile-first projetada para empresas de locação de equipamentos que necessitam gerenciar clientes, produtos, contratos de locação e cobranças de campo. O sistema funciona totalmente offline e sincroniza automaticamente quando há conexão com a internet.

### Principais Diferenciais

- **100% Offline** - Funciona sem conexão, ideal para trabalho em campo
- **Sincronização Automática** - Dados sincronizados quando online
- **Multi-usuário** - Sistema de permissões granular
- **Cálculos Automáticos** - Fichas rodadas, percentuais, descontos
- **Gestão de Rotas** - Organização por rotas de visitação

---

## 🎯 Funcionalidades

### 👥 Gestão de Clientes

- Cadastro completo de pessoas físicas e jurídicas
- Múltiplos contatos por cliente (telefone, WhatsApp, email)
- Endereço completo com geolocalização
- Vinculação a rotas de cobrança
- Histórico de locações e cobranças
- Status Ativo/Inativo

### 🎱 Gestão de Produtos

- Controle de equipamentos (bilhares, jukeboxes, mesas)
- Características: tipo, descrição, tamanho
- Número do relógio/contador mecânico
- Estado de conservação (Ótima, Boa, Regular, Ruim, Péssima)
- Status: Ativo, Inativo, Em Manutenção
- Histórico de alteração de relógio
- Rastreamento de localização (locado/estoque)

### 📋 Gestão de Locações

- Contratos de locação cliente × produto
- Diferentes formas de pagamento:
  - **Ficha/Partida** - Cobrança por uso do equipamento
  - **Valor Fixo** - Cobrança por período (mensal, semanal, quinzenal, diário)
- Percentuais configuráveis (empresa × cliente)
- Controle de leitura do relógio
- Histórico de cobranças por locação
- Encerramento e relocação de produtos

### 💰 Módulo de Cobranças

#### Fluxo de Cobrança

1. **Selecione uma Rota** de cobrança
2. **Escolha um Cliente** da rota
3. **Selecione o Produto** locado
4. **Informe a leitura do Relógio** atual
5. **Sistema calcula automaticamente**:
   - Fichas rodadas (leitura atual - leitura anterior)
   - Total bruto (fichas × valor da ficha)
   - Percentual da empresa
   - Descontos aplicados (partidas ou dinheiro)
   - Total a pagar
6. **Registre o pagamento** e gere recibo

#### Modalidades de Cobrança

| Modalidade | Descrição | Cálculo |
|------------|-----------|---------|
| **Ficha/Partida** | Cobrança por uso | (Relógio Atual - Relógio Anterior) × Valor da Ficha |
| **Valor Fixo** | Cobrança periódica | Valor fixo conforme periodicidade |

#### Formas de Pagamento

| Forma | Descrição |
|-------|-----------|
| **PercentualPagar** | Cliente paga percentual do total |
| **PercentualReceber** | Cliente recebe percentual do total |
| **Período** | Valor fixo por período |

#### Status de Pagamento

- **Pago** - Pagamento total realizado
- **Parcial** - Pagamento parcial, gera saldo devedor
- **Pendente** - Aguardando pagamento
- **Atrasado** - Pagamento em atraso

### 🗺️ Rotas de Cobrança

- Organização de clientes por rotas
- Sequenciamento de visitação
- Controle de acesso por usuário
- Relatório de rota diária

### 📊 Relatórios

| Relatório | Descrição |
|-----------|-----------|
| **Financeiro** | Resumo de receitas, despesas e totais |
| **Saldo Devedor** | Clientes com débitos em aberto |
| **Cobranças** | Histórico de cobranças por período |
| **Rota Diária** | Clientes a visitar por rota |
| **Manutenções** | Produtos em manutenção |

### ⚙️ Administração

- **Gerenciamento de Rotas** - Criar, editar, ativar/inativar
- **Atributos de Produto** - Tipos, descrições, tamanhos
- **Gerenciamento de Usuários** - Criar, editar, definir permissões
- **Configurações** - Preferências do aplicativo
- **Sincronização** - Status e controle manual

---

## 🖥️ Telas do Aplicativo

### Navegação Principal (Tabs)

| Tab | Telas | Descrição |
|-----|-------|-----------|
| **Home** | Dashboard | Resumo de métricas, cards rápidos |
| **Clientes** | Lista → Detalhes → Formulário | Gestão completa de clientes |
| **Produtos** | Lista → Detalhes → Formulário | Gestão completa de produtos |
| **Cobranças** | Lista → Rotas → Clientes → Cobrança | Fluxo completo de cobrança |
| **Mais** | Menu | Acesso a relatórios e configurações |

### Telas de Cadastro

```
ClientesListScreen     → Lista de clientes com busca e filtros
ClienteDetailScreen    → Detalhes, locações, histórico
ClienteFormScreen      → Cadastro/edição de cliente

ProdutosListScreen     → Lista de produtos com busca e filtros
ProdutoDetailScreen    → Detalhes, locação ativa, histórico
ProdutoFormScreen      → Cadastro/edição de produto
ProdutoAlterarRelogioScreen → Alteração de número do relógio
```

### Telas de Locação

```
LocacoesListScreen     → Locações por cliente
LocacaoDetailScreen    → Detalhes da locação
LocacaoFormScreen      → Nova locação / edição / relocação
EnviarEstoqueScreen    → Encerrar locação e enviar para estoque
```

### Telas de Cobrança

```
CobrancasListScreen    → Lista de cobranças com filtros
RotasCobrancaScreen    → Seleção de rota
ClientesRotaScreen     → Clientes da rota
CobrancaClienteScreen  → Cobrança do cliente
ConfirmacaoPagamentoScreen → Confirmação e recibo
CobrancaDetailScreen   → Detalhes da cobrança
HistoricoCobrancaScreen → Histórico por cliente
QuitacaoSaldoScreen    → Quitação de saldo devedor
```

### Telas de Relatórios

```
RelatorioFinanceiroScreen   → Resumo financeiro
RelatorioSaldoDevedorScreen → Saldos em aberto
RelatorioCobrancasScreen    → Cobranças por período
RelatorioRotaDiariaScreen   → Rota do dia
RelatorioManutencaoScreen   → Produtos em manutenção
RelatorioPeriodoScreen      → Análise por período
```

### Telas de Administração

```
RotasGerenciarScreen          → Gerenciar rotas
AtributosProdutoGerenciarScreen → Tipos, descrições, tamanhos
UsuariosGerenciarScreen       → Gerenciar usuários
SettingsScreen                → Configurações
SyncStatusScreen              → Status da sincronização
```

---

## 🔐 Sistema de Permissões

### Tipos de Usuário

| Tipo | Acesso |
|------|--------|
| **Administrador** | Acesso total a todas as funcionalidades |
| **Secretário** | Cadastros, locações e cobranças |
| **Acesso Controlado** | Apenas cobranças nas rotas permitidas |

### Matriz de Permissões Mobile

| Funcionalidade | Admin | Secretário | Controlado |
|----------------|:-----:|:----------:|:----------:|
| Cadastro de clientes | ✅ | ✅ | ❌ |
| Cadastro de produtos | ✅ | ✅ | ❌ |
| Alteração de relógio | ✅ | ❌ | ❌ |
| Locação/Relocação | ✅ | ✅ | ❌ |
| Cobranças | ✅ | ✅ | ✅ |
| Relatórios | ✅ | ✅ | ✅ |
| Gerenciar usuários | ✅ | ❌ | ❌ |
| Gerenciar rotas | ✅ | ❌ | ❌ |

### Permissões por Rota

Usuários com **Acesso Controlado** só podem realizar cobranças nas rotas que foram autorizados. Isso permite que funcionários externos trabalhem apenas em suas áreas designadas.

---

## 🛠️ Tecnologias

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| React Native | 0.83.2 | Framework mobile |
| Expo SDK | 55 | Plataforma de desenvolvimento |
| TypeScript | 5.9 | Tipagem estática |
| React Navigation | 7.x | Navegação |
| SQLite (expo-sqlite) | - | Banco de dados local |
| Context API | - | Gerenciamento de estado |
| React Native Paper | - | Componentes UI |
| Expo Vector Icons | - | Ícones |

---

## 📁 Estrutura do Projeto

```
app-cobrancas/
├── src/
│   ├── components/          # Componentes reutilizáveis
│   │   ├── cards/           # Cards de listagem
│   │   └── forms/           # Componentes de formulário
│   ├── config/              # Configurações e environment
│   ├── contexts/            # Context API (state management)
│   │   ├── AuthContext      # Autenticação e permissões
│   │   ├── SyncContext      # Sincronização
│   │   ├── ClienteContext   # Estado de clientes
│   │   ├── ProdutoContext   # Estado de produtos
│   │   └── CobrancaContext  # Estado de cobranças
│   ├── hooks/               # Custom hooks
│   ├── navigation/          # Navegação (stacks e tabs)
│   │   ├── AppNavigator     # Navegação raiz
│   │   ├── ClientesStack    # Stack de clientes
│   │   ├── ProdutosStack    # Stack de produtos
│   │   └── CobrancasStack   # Stack de cobranças
│   ├── repositories/        # Acesso a dados (SQLite)
│   ├── screens/             # Telas da aplicação
│   ├── services/            # Lógica de negócio e APIs
│   │   ├── DatabaseService  # Operações SQLite
│   │   └── SyncService      # Sincronização
│   ├── types/               # Tipagens TypeScript
│   └── utils/               # Utilitários
│       ├── masks            # Máscaras de input
│       ├── currency         # Formatação monetária
│       └── validators       # Validadores
├── assets/                  # Ícones e imagens
├── App.tsx                  # Componente raiz
├── app.json                 # Configuração Expo
├── eas.json                 # Configuração EAS Build/Update
└── package.json
```

---

## 🚀 Instalação

### Pré-requisitos

- Node.js 18+
- npm ou yarn
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)

### Setup Inicial

```bash
# Clone o repositório
git clone https://github.com/rguisantos/app-cobrancas.git
cd app-cobrancas

# Instale as dependências
npm install

# Copie o arquivo de ambiente
cp .env.example .env

# Inicie o projeto
npm start
```

### Rodar em Plataformas Específicas

```bash
# Android (emulador ou dispositivo)
npm run android

# iOS (apenas macOS)
npm run ios

# Web (navegador)
npm run web
```

---

## 📋 Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `EXPO_PUBLIC_API_URL` | URL da API backend | - |
| `EXPO_PUBLIC_USE_MOCK` | Usar dados mock | `true` |
| `EXPO_PUBLIC_DEBUG` | Modo debug | `true` |
| `EXPO_PUBLIC_APP_NAME` | Nome do app | `App Cobranças` |
| `EXPO_PUBLIC_SYNC_INTERVAL` | Intervalo sync (min) | `15` |
| `EXPO_PUBLIC_PRIMARY_COLOR` | Cor primária (hex sem #) | `2563EB` |

---

## 👤 Login (Modo Mock)

Quando executando em modo mock (`EXPO_PUBLIC_USE_MOCK=true`), as credenciais são definidas no arquivo `.env`. Copie o `.env.example` e configure conforme necessário.

> ⚠️ **Importante**: Nunca use credenciais reais de produção em arquivos .env!

---

## 🏗️ Build e Deploy

### Desenvolvimento

```bash
# Iniciar com hot reload
npm start

# Iniciar limpar cache
npm start --clear
```

### Build com EAS

```bash
# Build para Android (APK - preview)
eas build --platform android --profile preview

# Build para Android (AAB - produção)
eas build --platform android --profile production

# Build para iOS
eas build --platform ios --profile production
```

### Atualização OTA (Over-the-Air)

```bash
# Publicar update para o canal preview
eas update --branch preview --environment preview --message "Descrição da alteração"

# Publicar para produção
eas update --branch production --environment production --message "Versão X.X.X"
```

---

## 📊 Arquitetura

### Offline-first

O app foi projetado para funcionar totalmente offline:

```
┌─────────────────────────────────────────────────────────────┐
│                      DISPOSITIVO MOBILE                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│   │   Screens   │───▶│  Contexts   │───▶│ Repositories│    │
│   └─────────────┘    └─────────────┘    └─────────────┘    │
│         │                   │                   │            │
│         │                   ▼                   ▼            │
│         │            ┌─────────────┐    ┌─────────────┐     │
│         │            │   Services  │    │   SQLite    │     │
│         │            └─────────────┘    └─────────────┘     │
│         │                   │                                │
└─────────┼───────────────────┼────────────────────────────────┘
          │                   │
          │                   ▼
          │            ┌─────────────┐
          │            │  API (Sync) │
          │            └─────────────┘
          │                   │
          └───────────────────┘
```

### Fluxo de Dados

1. **Leitura**: Screens → Contexts → Repositories → SQLite
2. **Escrita**: Screens → Contexts → Repositories → SQLite → Marca para sync
3. **Sincronização**: SyncService → API → SQLite (bidirecional)

### Controle de Conflitos

O sistema utiliza versionamento e timestamps para detectar e resolver conflitos de sincronização:

- Cada entidade tem `version`, `deviceId`, `lastSyncedAt`
- Mudanças são registradas em `ChangeLog`
- Conflitos são detectados por versão diferente
- Estratégias: `local`, `remote`, `newest`, `manual`

---

## 📱 Fluxos de Trabalho

### Fluxo de Cadastro de Cliente

```
ClientesListScreen
       │
       ▼ (botão +)
ClienteFormScreen (modo: criar)
       │
       ▼ (salvar)
SQLite → Marca para sync
       │
       ▼
ClientesListScreen (cliente aparece na lista)
```

### Fluxo de Nova Locação

```
ClienteDetailScreen
       │
       ▼ (botão Nova Locação)
LocacaoFormScreen
       │
       ├─ Selecionar produto disponível
       ├─ Configurar forma de pagamento
       ├─ Definir percentuais
       └─ Informar leitura inicial do relógio
       │
       ▼ (salvar)
SQLite → Produto marcado como locado
       │
       ▼
ClienteDetailScreen (locação aparece na lista)
```

### Fluxo de Cobrança Completo

```
HomeScreen (card Cobranças)
       │
       ▼
CobrancasListScreen
       │
       ▼ (selecionar rota)
RotasCobrancaScreen
       │
       ▼ (selecionar cliente)
ClientesRotaScreen
       │
       ▼ (selecionar cliente)
CobrancaClienteScreen
       │
       ├─ Lista locações ativas
       ├─ Informar leitura do relógio
       ├─ Sistema calcula valores
       ├─ Aplicar descontos (opcional)
       └─ Informar valor recebido
       │
       ▼ (confirmar)
ConfirmacaoPagamentoScreen
       │
       ├─ Resumo da cobrança
       └─ Opção de imprimir/compartilhar
       │
       ▼ (confirmar)
SQLite → Atualiza locação, cria cobrança
       │
       ▼
CobrancasListScreen
```

### Fluxo de Quitação de Saldo

```
RelatorioSaldoDevedorScreen
       │
       ▼ (selecionar cliente com saldo)
CobrancaClienteScreen
       │
       ▼ (selecionar locação com saldo)
QuitacaoSaldoScreen
       │
       ├─ Mostra saldo devedor
       └─ Informar valor da quitação
       │
       ▼ (confirmar)
SQLite → Atualiza saldo da locação
```

---

## 🔧 Scripts Disponíveis

```bash
npm start          # Inicia o Expo
npm run android    # Inicia no Android
npm run ios        # Inicia no iOS
npm run web        # Inicia no navegador
npm run lint       # Executa ESLint
npm run type-check # Verifica tipos TypeScript
npm test           # Executa testes
```

---

## 📦 Principais Dependências

```json
{
  "expo": "~55.0.0",
  "expo-sqlite": "~15.0.0",
  "expo-updates": "~0.28.0",
  "@react-navigation/native": "^7.0.0",
  "@react-navigation/native-stack": "^7.0.0",
  "@react-navigation/bottom-tabs": "^7.0.0",
  "react-native-safe-area-context": "^5.0.0",
  "react-native-screens": "~4.0.0",
  "@expo/vector-icons": "^14.0.0"
}
```

---

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Add nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está sob a licença MIT.

---

## 📞 Suporte

Para dúvidas ou problemas, abra uma issue no repositório.
