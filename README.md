# App Cobranças

Aplicativo mobile para gestão de locações e cobranças, desenvolvido com React Native e Expo.

## 📱 Funcionalidades

- **Gestão de Clientes** - Cadastro completo com endereço, contatos e vinculação a rotas
- **Gestão de Produtos** - Controle de equipamentos locados (bilhares, jukeboxes, mesas)
- **Locações** - Contratos com diferentes formas de pagamento (ficha/partida, valor fixo)
- **Cobranças** - Registro de pagamentos com cálculo automático de valores
- **Rotas de Cobrança** - Organização de clientes por rotas de visitação
- **Relatórios** - Financeiro, saldo devedor, rota diária, manutenções
- **Offline-first** - Funciona sem conexão, sincroniza quando online
- **Multi-usuário** - Sistema de permissões (Admin, Secretário, Acesso Controlado)

## 🛠️ Tecnologias

| Tecnologia | Versão |
|------------|--------|
| React Native | 0.83.2 |
| Expo SDK | 55 |
| TypeScript | 5.9 |
| React Navigation | 7.x |
| SQLite (expo-sqlite) | - |

## 📁 Estrutura do Projeto

```
app-cobrancas/
├── src/
│   ├── components/          # Componentes reutilizáveis
│   │   ├── cards/           # Cards de listagem
│   │   └── forms/           # Componentes de formulário
│   ├── config/              # Configurações e environment
│   ├── contexts/            # Context API (state management)
│   ├── hooks/               # Custom hooks
│   ├── navigation/          # Navegação (stacks e tabs)
│   ├── repositories/        # Acesso a dados (SQLite)
│   ├── screens/             # Telas da aplicação
│   ├── services/            # Lógica de negócio e APIs
│   ├── types/               # Tipagens TypeScript
│   └── utils/               # Utilitários (masks, currency, etc)
├── assets/                  # Ícones e imagens
├── App.tsx                  # Componente raiz
├── app.json                 # Configuração Expo
├── eas.json                 # Configuração EAS Build/Update
└── package.json
```

## 🚀 Instalação

### Pré-requisitos

- Node.js 18+
- npm ou yarn
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)

### Setup

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

### Rodar em específico

```bash
# Android
npm run android

# iOS
npm run ios

# Web
npm run web
```

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

## 🔐 Sistema de Permissões

### Tipos de Usuário

| Tipo | Descrição |
|------|-----------|
| **Administrador** | Acesso total a todas as funcionalidades |
| **Secretário** | Cadastros, locações e cobranças |
| **Acesso Controlado** | Apenas cobranças (em rotas permitidas) |

### Permissões Mobile

| Permissão | Admin | Secretário | Controlado |
|-----------|:-----:|:----------:|:----------:|
| `todosCadastros` | ✅ | ✅ | ❌ |
| `alteracaoRelogio` | ✅ | ❌ | ❌ |
| `locacaoRelocacaoEstoque` | ✅ | ✅ | ❌ |
| `cobrancasFaturas` | ✅ | ✅ | ✅ |

## 👤 Login Padrão

```
Email: admin@locacao.com
Senha: admin123
```

## 🏗️ Build e Deploy

### Desenvolvimento

```bash
# Iniciar com hot reload
npm start
```

### Build com EAS

```bash
# Build para Android (APK)
eas build --platform android --profile preview

# Build para produção
eas build --platform android --profile production

# Build para iOS
eas build --platform ios --profile production
```

### Atualização OTA

```bash
# Publicar update para o canal preview
eas update --branch preview --message "Descrição da alteração"

# Publicar para produção
eas update --branch production --message "Versão X.X.X"
```

## 📊 Arquitetura

### Offline-first

O app foi projetado para funcionar totalmente offline:

1. **SQLite Local** - Todos os dados são armazenados localmente
2. **Context API** - Estado global sincronizado com o banco
3. **Sync Service** - Sincronização bidirecional quando online

### Fluxo de Dados

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Screens   │───▶│  Contexts   │───▶│ Repositories│
└─────────────┘    └─────────────┘    └─────────────┘
                          │                   │
                          ▼                   ▼
                   ┌─────────────┐    ┌─────────────┐
                   │   Services  │    │   SQLite    │
                   └─────────────┘    └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │  API (Sync) │
                   └─────────────┘
```

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

## 📝 Fluxo de Cobrança

1. Selecione uma **Rota** de cobrança
2. Escolha um **Cliente** da rota
3. Selecione o **Produto** locado
4. Preencha a leitura do **Relógio**
5. Sistema calcula automaticamente:
   - Fichas rodadas
   - Total bruto
   - Percentual empresa/cliente
   - Descontos aplicados
   - Total a pagar
6. Confirme o **Pagamento**

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Add nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.

---

Desenvolvido por **Diamond Sistemas**
