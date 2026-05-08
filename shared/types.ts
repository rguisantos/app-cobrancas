// packages/shared/src/types.ts
// ============================================================================
// SISTEMA DE GESTÃO DE LOCAÇÃO - TIPOS TYPESCRIPT (COMPARTILHADOS)
// Arquitetura: Offline-first com sincronização bidirecional
// ============================================================================
// Este arquivo é a fonte de verdade para tipos compartilhados entre
// o web (app-cobrancas-web) e o mobile (app-cobrancas).
// ============================================================================

// ============================================================================
// 📋 ENUMS E TIPOS BASE
// ============================================================================

export type Conservacao = 'Ótima' | 'Boa' | 'Regular' | 'Ruim' | 'Péssima';
export type StatusProduto = 'Ativo' | 'Inativo' | 'Manutenção';
export type StatusLocacao = 'Ativa' | 'Finalizada' | 'Cancelada';
export type Periodicidade = 'Mensal' | 'Semanal' | 'Quinzenal' | 'Diária';
export type ModalidadeCobranca = 'Ficha/Partida' | 'Valor Fixo';
export type FormaPagamentoLocacao = 'Periodo' | 'PercentualPagar' | 'PercentualReceber';
export type TipoPessoa = 'Fisica' | 'Juridica';
export type StatusPagamento = 'Pago' | 'Parcial' | 'Pendente' | 'Atrasado';

// ============================================================================
// 🔄 TIPOS DE SINCRONIZAÇÃO (Offline-first)
// ============================================================================

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'error';
export type SyncDirection = 'push' | 'pull' | 'bidirectional';
export type EntityType = 'cliente' | 'produto' | 'locacao' | 'cobranca' | 'rota' | 'usuario' | 'manutencao' | 'meta' | 'historicoRelogio' | 'tipoProduto' | 'descricaoProduto' | 'tamanhoProduto' | 'estabelecimento';
export type ConflictResolutionStrategy = 'local' | 'remote' | 'newest' | 'manual';

export interface SyncMetadata {
  lastSyncAt: string;
  lastPushAt: string;
  lastPullAt: string;
  syncInProgress: boolean;
  deviceId: string;
  deviceName: string;
  deviceKey: string;
  chave: string;           // Identificador de exibição do dispositivo (ex: "DEV-XXXXXX")
}

export interface SyncableEntity {
  id: string; // UUID único
  createdAt: string;
  updatedAt: string;
  deletedAt?: string; // Soft delete
  
  // Controle de sincronização
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
  needsSync: boolean;
  version: number; // Versionamento para detecção de conflitos
  deviceId: string; // Dispositivo que criou/alterou
}

export interface ChangeLog {
  id: string;
  entityId: string;
  entityType: EntityType;
  operation: 'create' | 'update' | 'delete';
  changes: Record<string, unknown>;
  timestamp: string;
  deviceId: string;
  synced: boolean;
  syncedAt?: string;
}

export interface SyncConflict {
  entityId: string;
  entityType: EntityType;
  localVersion: Record<string, unknown>;
  remoteVersion: Record<string, unknown>;
  conflictType: 'update' | 'delete';
  resolvedAt?: string;
  resolution: ConflictResolutionStrategy | null;
}

// ============================================================================
// 🗺️ ENTIDADES DE APOIO
// ============================================================================

export interface Rota {
  id: string;
  descricao: string; // ex: "Linha Aquidauana"
  status: 'Ativo' | 'Inativo';
  // Identificação visual e operacional
  cor?: string;       // Cor hexadecimal para identificação visual (ex: "#2563EB")
  regiao?: string;    // Região/zona (ex: "Zona Norte", "Centro")
  ordem?: number;     // Ordem de prioridade para cobrança
  observacao?: string; // Anotações operacionais
  // Campos de sincronização
  syncStatus?: SyncStatus;
  lastSyncedAt?: string;
  needsSync?: boolean;
  version?: number;
  deviceId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Contato {
  id?: string;
  nome: string;
  telefone: string;
  whatsapp?: boolean;
  principal?: boolean;
}

export interface TipoProduto {
  id: string;
  nome: string; // ex: "Bilhar", "Jukebox Padrão Grande", "Mesa"
}

export interface DescricaoProduto {
  id: string;
  nome: string; // ex: "Azul", "Branco/Carijo", "Preto"
}

export interface TamanhoProduto {
  id: string;
  nome: string; // ex: "2,00", "2,20", "Grande", "Média"
}

// ============================================================================
// 👥 CLIENTES
// ============================================================================

export interface Cliente extends SyncableEntity {
  tipo: EntityType; // Para sincronização
  
  // Tipo de pessoa
  tipoPessoa: TipoPessoa;
  
  // Identificação
  identificador: string; // ex: "10365" - para busca rápida
  
  // Dados Pessoa Física
  cpf?: string;
  rg?: string;
  nomeCompleto?: string;
  
  // Dados Pessoa Jurídica
  cnpj?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  inscricaoEstadual?: string;
  
  // Campos computados/acessores comuns
  cpfCnpj?: string; // Campo computado (cpf ou cnpj)
  rgIe?: string; // Campo computado (rg ou inscricaoEstadual)
  
  // Campo unificado para exibição
  nomeExibicao: string;
  
  // Contatos
  email: string;
  telefonePrincipal: string;
  contatos?: Contato[];
  
  // Endereço
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string; // Sigla: "MS"

  // Coordenadas geográficas (captura via GPS no mobile)
  latitude?: number;
  longitude?: number;

  // Vínculo com Rota
  rotaId?: string; // Opcional — cliente pode ficar sem rota vinculada
  rotaNome?: string; // Para exibição fácil
  
  // Sistema
  status: 'Ativo' | 'Inativo';
  dataCadastro?: string;
  dataUltimaAlteracao?: string;
  observacao?: string;
}

// Interface leve para listagem
export interface ClienteListItem {
  id: string;
  nomeExibicao: string;
  cpfCnpj?: string;
  rotaId?: string;
  rotaNome: string;
  cidade: string;
  estado: string;
  status: 'Ativo' | 'Inativo';
  totalLocacoesAtivas?: number;
}

// ============================================================================
// 🎱 PRODUTOS
// ============================================================================

export interface Produto extends SyncableEntity {
  tipo: EntityType;
  
  // Identificação (o identificador JÁ É a numeração física)
  identificador: string; // ex: "515", "170" - número da placa física
  
  // Número do relógio/contador (separado do identificador)
  numeroRelogio: string; // ex: "8070" - contador mecânico
  
  // Características (vínculos com tabelas de apoio)
  tipoId: string;
  tipoNome: string; // ex: "Bilhar"
  
  descricaoId: string;
  descricaoNome: string; // ex: "Azul"
  
  tamanhoId: string;
  tamanhoNome: string; // ex: "2,20"
  
  // Códigos internos (opcional)
  codigoCH?: string;
  codigoABLF?: string;
  // Estado do Produto
  conservacao: Conservacao;
  statusProduto: StatusProduto;
  
  // Manutenção
  dataFabricacao?: string;
  dataUltimaManutencao?: string;
  relatorioUltimaManutencao?: string;
  dataAvaliacao?: string;
  aprovacao?: string;
  
  // Localização/Situação
  estabelecimento?: string; // ex: "Barracão" (quando não está locado)
  observacao?: string;
  
  // Locação ativa (se houver)
  locacaoAtiva?: LocacaoAtivaInfo;
  
  // Sistema
  dataCadastro?: string;
  dataUltimaAlteracao?: string;
}

// Informações resumidas da locação ativa
export interface LocacaoAtivaInfo {
  locacaoId: string;
  clienteId: string;
  clienteNome: string;
  dataInicio: string;
  rotaNome?: string;
}

// Interface leve para listagem
export interface ProdutoListItem {
  id: string;
  identificador: string;
  tipoNome: string;
  descricaoNome: string;
  tamanhoNome: string;
  statusProduto: StatusProduto;
  numeroRelogio?: string;
  estaLocado?: boolean;
  clienteNome?: string;
  locacaoId?: string;
}

// Histórico de alteração do número do relógio
export interface ProdutoHistoricoRelogio {
  id: string;
  produtoId: string;
  relogioAnterior: string;
  relogioNovo: string;
  motivo: string;
  dataAlteracao: string;
  usuarioResponsavel: string;
}

// ============================================================================
// 📋 LOCAÇÕES
// ============================================================================

export interface Locacao extends SyncableEntity {
  tipo: EntityType;
  
  // Vínculos
  clienteId: string;
  clienteNome: string;
  produtoId: string;
  produtoIdentificador: string; // ex: "515"
  produtoTipo: string; // ex: "Bilhar"
  
  // Dados da Locação
  dataLocacao: string;
  dataFim?: string; // Se existir, locação foi encerrada
  observacao?: string;
  
  // Forma de Pagamento
  formaPagamento: FormaPagamentoLocacao;
  
  // Dados do Contador
  numeroRelogio: string;
  precoFicha: number; // Valor da ficha/partida
  
  // Percentuais
  percentualEmpresa: number; // % que fica com a empresa
  percentualCliente: number; // % que fica com o cliente
  
  // Para pagamento por Período (valor fixo)
  periodicidade?: Periodicidade;
  valorFixo?: number;
  dataPrimeiraCobranca?: string;
  
  // Status
  status: StatusLocacao;
  
  // Controle de Cobrança
  ultimaLeituraRelogio?: number;
  dataUltimaCobranca?: string;

  // Manutenção
  trocaPano?: boolean;           // Registrado na criação da locação
  dataUltimaManutencao?: string; // Data da última manutenção registrada
}

// Interface leve para listagem por cliente
export interface LocacaoListItem {
  id: string;
  produtoId?: string; // Added for relocar/enviarEstoque actions
  produtoIdentificador: string;
  produtoTipo: string;
  produtoDescricao: string;
  produtoTamanho: string;
  clienteNome?: string;
  
  formaPagamento: FormaPagamentoLocacao;
  numeroRelogio: string;
  percentualEmpresa: number;
  precoFicha: number;
  valorFixo?: number;        // Para locações por período
  periodicidade?: string;    // Para locações por período
  dataLocacao: string;
  ultimaLeituraRelogio?: number;
  dataUltimaCobranca?: string;
  
  status: StatusLocacao;
}

// Interface para resumo de locação
export interface LocacaoResumo {
  id: string;
  produtoIdentificador: string;
  produtoNome: string;
  produtoTipo?: string;
  clienteNome: string;
  dataLocacao: string;
  formaPagamento: FormaPagamentoLocacao;
  percentualEmpresa: number;
  precoFicha: number;
  status: StatusLocacao;
}

// ============================================================================
// 💰 COBRANÇAS E REGRAS
// ============================================================================

export interface RegraCobranca {
  modalidade: ModalidadeCobranca;
  
  // Se modalidade for 'Ficha/Partida'
  valorFicha?: number;
  percentualReceber?: number;
  percentualPagar?: number;
  
  // Se modalidade for 'Valor Fixo'
  valorFixo?: number;
  periodicidade?: Periodicidade;
}

export interface HistoricoCobranca extends SyncableEntity {
  tipo: EntityType;
  
  // Vínculos
  locacaoId: string;
  clienteId: string;
  clienteNome: string;
  produtoId?: string;            // Vínculo opcional com produto
  produtoIdentificador: string;
  
  // Período da cobrança
  dataInicio: string;
  dataFim: string;
  dataPagamento?: string;
  
  // Leitura do Contador
  relogioAnterior: number;
  relogioAtual: number;
  fichasRodadas: number;
  
  // Cálculos
  valorFicha: number;
  totalBruto: number;
  
  // Descontos
  descontoPartidasQtd?: number;
  descontoPartidasValor?: number;
  descontoDinheiro?: number;
  
  // Percentual
  percentualEmpresa: number;
  subtotalAposDescontos: number;
  valorPercentual: number;
  
  // Totais
  totalClientePaga: number;
  valorRecebido: number;
  saldoDevedorGerado: number;
  
  // Status
  status: StatusPagamento;
  dataVencimento?: string;
  observacao?: string;
  trocaPano?: boolean;           // Indica se houve troca de pano nesta cobrança
}

// View auxiliar para tela de cobrança
export interface CobrancaView {
  cliente: Cliente;
  locacoesAtivas: Locacao[];
  locacoesDevedoras: Locacao[];
  totalAPagar: number;
}

// ============================================================================
// 🔧 MANUTENÇÕES
// ============================================================================

export interface Manutencao {
  id: string;
  produtoId: string;
  produtoIdentificador?: string;
  produtoTipo?: string;
  clienteId?: string;
  clienteNome?: string;
  locacaoId?: string;
  cobrancaId?: string;
  tipo: 'trocaPano' | 'manutencao';
  descricao?: string;
  data: string;
  registradoPor?: string;
  // Campos de sincronização
  syncStatus?: SyncStatus;
  lastSyncedAt?: string;
  needsSync?: boolean;
  version?: number;
  deviceId?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}

// ============================================================================
// 🏢 ESTABELECIMENTOS — Locais de armazenamento
// ============================================================================

export interface Estabelecimento {
  id: string;
  nome: string;              // ex: "Barracão", "Depósito Central"
  endereco?: string;        // Endereço do estabelecimento
  observacao?: string;      // Anotações
  // Campos de sincronização
  syncStatus?: SyncStatus;
  lastSyncedAt?: string;
  needsSync?: boolean;
  version?: number;
  deviceId?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}

// ============================================================================
// 🎯 METAS — Metas de arrecadação por período
// ============================================================================

export type StatusMeta = 'ativa' | 'atingida' | 'expirada';
export type TipoMeta = 'receita' | 'cobrancas' | 'adimplencia';

export interface Meta {
  id: string;
  nome: string;              // ex: "Meta Janeiro 2024"
  tipo: TipoMeta;
  valorMeta: number;         // Valor alvo
  valorAtual: number;        // Valor alcançado
  dataInicio: string;        // Início do período
  dataFim: string;           // Fim do período
  rotaId?: string;           // Se null, meta é global
  status: StatusMeta;
  criadoPor?: string;        // ID do usuário que criou
  // Campos de sincronização
  syncStatus?: SyncStatus;
  lastSyncedAt?: string;
  needsSync?: boolean;
  version?: number;
  deviceId?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}

// ============================================================================
// 👤 USUÁRIOS E PERMISSÕES
// ============================================================================

export type TipoPermissaoUsuario = 'Administrador' | 'Secretario' | 'AcessoControlado';

export interface PermissoesWeb {
  // Cadastros
  clientes: boolean;
  produtos: boolean;
  rotas: boolean;
  // Operações
  locacaoRelocacaoEstoque: boolean;
  cobrancas: boolean;
  manutencoes: boolean;
  relogios: boolean;
  // Visualização
  relatorios: boolean;
  dashboard: boolean;
  agenda: boolean;
  mapa: boolean;
  // Admin
  adminCadastros: boolean;
  adminUsuarios: boolean;
  adminDispositivos: boolean;
  adminSincronizacao: boolean;
  adminAuditoria: boolean;
}

export interface PermissoesMobile {
  // Cadastros
  clientes: boolean;
  produtos: boolean;
  // Operações
  alteracaoRelogio: boolean;
  locacaoRelocacaoEstoque: boolean;
  cobrancasFaturas: boolean;
  manutencoes: boolean;
  // Visualização
  relatorios: boolean;
  sincronizacao: boolean;
}

export interface PermissoesUsuario {
  web: PermissoesWeb;
  mobile: PermissoesMobile;
}

export interface Usuario extends SyncableEntity {
  tipo: EntityType;
  
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  
  tipoPermissao: TipoPermissaoUsuario;
  permissoes: PermissoesUsuario;
  
  // Rotas permitidas (para Acesso Controlado)
  rotasPermitidas: string[];
  
  status: 'Ativo' | 'Inativo';
  bloqueado?: boolean;
  
  tentativasLoginFalhas?: number;
  bloqueadoAte?: string;
  
  dataUltimoAcesso?: string;
  ultimoAcessoDispositivo?: 'Web' | 'Mobile';
}

// Versão segura de Usuario para sincronização (sem senha)
export interface UsuarioSyncData {
  id: string;
  tipo: EntityType;
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  tipoPermissao: TipoPermissaoUsuario;
  permissoes: PermissoesUsuario;
  rotasPermitidas: string[];
  status: 'Ativo' | 'Inativo';
  bloqueado?: boolean;
  dataUltimoAcesso?: string;
  ultimoAcessoDispositivo?: 'Web' | 'Mobile';
  // Campos de sincronização
  syncStatus?: SyncStatus;
  lastSyncedAt?: string;
  needsSync?: boolean;
  version?: number;
  deviceId?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}

// ============================================================================
// 📊 DASHBOARD
// ============================================================================

export interface DashboardWebGanhos {
  ganhoAtualMes: number;
  ganhoComPercentual: number;
  ganhoComPeriodo: number;
}

export interface ClienteNaoCobrado {
  clienteId: string;
  clienteNome: string;
  ultimaDataPagamento: string;
  rotaId: string;
  rotaNome: string;
  diasAtraso: number;
}

export interface DashboardProdutosLocadosEstoque {
  totalLocados: number;
  totalEstoque: number;
}

export interface DashboardWebData {
  ganhos: DashboardWebGanhos;
  clientesNaoCobrados: ClienteNaoCobrado[];
  totalClientesNaoCobrados: number;
  produtosLocadosEstoque: DashboardProdutosLocadosEstoque;
  dataReferencia: string;
  mesReferencia: string;
}

export interface DashboardMobileMetricas {
  totalClientes: number;
  cobrancasPendentes: number;
  totalProdutos: number;
  produtosLocados?: number;
  produtosEstoque?: number;
  // Financeiro
  totalRecebidoHoje?: number;
  totalRecebidoMes?: number;
  totalAReceber?: number;
  saldoDevedor?: number;
  cobrancasHoje?: number;
}

export interface DashboardMobileData {
  usuarioNome: string;
  usuarioTipo: string;
  saudacao: string;
  metricas: DashboardMobileMetricas;
  dataAtualizacao: string;
}

// ============================================================================
// ⚙️ CONFIGURAÇÕES E UTILITÁRIOS
// ============================================================================

export interface SyncConfig {
  autoSyncEnabled: boolean;
  autoSyncInterval: number; // minutos
  syncOnAppStart: boolean;
  syncOnAppResume: boolean;
  warnBeforeLargeSync: boolean;
  maxRecordsPerSync: number;
}

export interface Equipamento {
  id: string;
  nome: string;
  chave: string;
  tipo: 'Celular' | 'Tablet' | 'Outro';
  dataCadastro: string;
  ultimaSincronizacao?: string;
  status: 'ativo' | 'inativo' | 'pendente';
  tempoDesdeUltimaSync?: string;
  estaAtrasado?: boolean;
  senhaNumerica?: string;  // Senha de 6 dígitos para ativação
}

// ============================================================================
// 📱 ATIVAÇÃO DE DISPOSITIVO
// ============================================================================

export interface DeviceActivationRequest {
  dispositivoId: string;  // ID do dispositivo cadastrado no web
  deviceKey: string;       // Chave única gerada pelo mobile
  deviceName: string;      // Nome amigável do dispositivo
  senhaNumerica: string;   // Senha de 6 dígitos
}

export interface DeviceActivationResponse {
  success: boolean;
  dispositivo?: {
    id: string;
    nome: string;
    chave: string;
    deviceKey: string;
    status: string;
  };
  error?: string;
}

// ============================================================================
// 🔍 FILTROS DE PESQUISA
// ============================================================================

export interface ClienteFilters {
  rotaId?: string;
  status?: 'Ativo' | 'Inativo';
  cidade?: string;
  estado?: string;
  termoBusca?: string;
}

export interface ProdutoFilters {
  status?: StatusProduto;
  tipoId?: string;
  conservacao?: Conservacao;
  termoBusca?: string;
  comLocacaoAtiva?: boolean;
}

export interface CobrancaFilters {
  status?: StatusPagamento;
  clienteId?: string;
  dataInicio?: string;
  dataFim?: string;
}

export interface LocacaoFilters {
  status?: StatusLocacao;
  clienteId?: string;
  produtoId?: string;
}

// ============================================================================
// 📤 SYNC PAYLOAD TYPES
// ============================================================================

export interface SyncPayload {
  deviceId: string;
  deviceKey: string;
  lastSyncAt: string;
  changes: ChangeLog[];
}

export interface UpdatedVersion {
  entityId: string;
  entityType: string;
  newVersion: number;
}

export interface SyncResponse {
  success: boolean;
  lastSyncAt: string;
  hasMore?: boolean;          // Indica se há mais registros a buscar (paginação)
  isStale?: boolean;          // Indica se o device está stale (>30 dias sem sync)
  changes?: {
    clientes?: Cliente[];
    produtos?: Produto[];
    locacoes?: Locacao[];
    cobrancas?: HistoricoCobranca[];
    rotas?: Rota[];
    usuarios?: UsuarioSyncData[];
    manutencoes?: Manutencao[];
    metas?: Meta[];
    historicoRelogio?: ProdutoHistoricoRelogio[];
  };
  conflicts?: SyncConflict[];
  errors?: string[];
  updatedVersions?: UpdatedVersion[];  // Versões atualizadas no push para o mobile atualizar local
  // Atributos de produto (não seguem o padrão de entidade sync)
  tiposProduto?: TipoProduto[];
  descricoesProduto?: DescricaoProduto[];
  tamanhosProduto?: TamanhoProduto[];
  // Estabelecimentos (entidade de apoio com sync fields)
  estabelecimentos?: Estabelecimento[];
}

export interface SyncSnapshotResponse {
  success: boolean;
  lastSyncAt: string;
  snapshot: {
    clientes: Cliente[];
    produtos: Produto[];
    locacoes: Locacao[];
    cobrancas: HistoricoCobranca[];
    rotas: Rota[];
    usuarios: UsuarioSyncData[];
    tiposProduto: TipoProduto[];
    descricoesProduto: DescricaoProduto[];
    tamanhosProduto: TamanhoProduto[];
    manutencoes: Manutencao[];
    metas: Meta[];
    estabelecimentos: Estabelecimento[];
    historicoRelogio: ProdutoHistoricoRelogio[];
  };
}

export interface RefreshTokenResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    email: string;
    nome: string;
    role: string;
    tipoPermissao: string;
    permissoes: {
      web: PermissoesWeb;
      mobile: PermissoesMobile;
    };
    rotasPermitidas: string[];
    status: string;
  };
}

// ============================================================================
// 💰 COBRANÇAS PENDENTES
// ============================================================================

export interface CobrancaPendente {
  locacaoId: string;
  clienteId: string;
  clienteNome: string;
  produtoIdentificador: string;
  dataVencimento: string;
  valorPrevisto: number;
  diasAtraso: number;
}

// ============================================================================
// 📤 SYNC CHANGES RESPONSE
// ============================================================================

export interface SyncChangesResponse {
  clientes?: Cliente[];
  produtos?: Produto[];
  locacoes?: Locacao[];
  cobrancas?: HistoricoCobranca[];
  rotas?: Rota[];
  lastSyncAt: string;
}
