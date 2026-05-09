/**
 * DatabaseService.ts
 * Serviço de banco de dados local usando expo-sqlite
 * Arquitetura: Offline-first com sincronização bidirecional
 */

import * as SQLite from 'expo-sqlite';
import logger from '../utils/logger';
import { 
  SyncableEntity, 
  EntityType, 
  ChangeLog, 
  SyncMetadata,
  SyncResponse,
  Cliente,
  Produto,
  Locacao,
  HistoricoCobranca,
  Rota
} from '../types';
import { ENV } from '../config/env';
import { UPDATE_EXCLUIDOS, serializeForDB } from '../utils/database';

// ============================================================================
// CONFIGURAÇÃO DO BANCO DE DADOS
// ============================================================================

const DB_NAME = 'locacao.db';
const DB_VERSION = 1;

// Tabelas do sistema
const TABLES = {
  CLIENTES: 'clientes',
  PRODUTOS: 'produtos',
  LOCACOES: 'locacoes',
  COBRANCAS: 'cobrancas',
  ROTAS: 'rotas',
  USUARIOS: 'usuarios',
  TIPOS_PRODUTO: 'tipos_produto',
  DESCRICOES_PRODUTO: 'descricoes_produto',
  TAMANHOS_PRODUTO: 'tamanhos_produto',
  MANUTENCOES: 'manutencoes',
  ESTABELECIMENTOS: 'estabelecimentos',
  METAS: 'metas',
  HISTORICO_RELOGIO: 'historico_relogio',
  CHANGE_LOG: 'change_log',
  SYNC_METADATA: 'sync_metadata',
};

// ============================================================================
// CLASSE DATABASE SERVICE
// ============================================================================

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /** Cache de colunas por tabela — evita PRAGMA table_info a cada upsert */
  private tableColumnsCache: Map<string, Set<string>> = new Map();

  /**
   * Verifica se o banco está pronto
   */
  isReady(): boolean {
    return this.isInitialized && this.db !== null;
  }

  /**
   * Aguarda o banco estar pronto
   */
  async waitForReady(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) {
      await this.initPromise;
      return;
    }
    throw new Error('Banco de dados não foi inicializado');
  }

  /**
   * Obtém as colunas de uma tabela (com cache).
   * Usa PRAGMA table_info na primeira chamada e cacheia o resultado.
   * Essencial para filtrar campos do servidor que não existem no SQLite local,
   * evitando erros "table has no column named X" que causam rollback da transação.
   */
  async getTableColumns(tableName: string): Promise<Set<string>> {
    const cached = this.tableColumnsCache.get(tableName);
    if (cached) return cached;

    if (!this.db) throw new Error('Database não inicializado');

    try {
      const columns = await this.db.getAllAsync<{ name: string }>(
        `PRAGMA table_info(${tableName})`
      );
      const columnSet = new Set(columns.map(c => c.name));
      this.tableColumnsCache.set(tableName, columnSet);
      return columnSet;
    } catch (error) {
      console.error(`[Database] Erro ao obter colunas de ${tableName}:`, error);
      return new Set();
    }
  }

  /**
   * Filtra dados para conter apenas colunas que existem na tabela SQLite.
   * Previne erros "table has no column named X" quando o servidor envia
   * campos que não existem no schema local (ex: campos novos no Prisma
   * que ainda não tiveram migration no mobile).
   */
  async filterColumnsForTable(tableName: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const tableColumns = await this.getTableColumns(tableName);
    if (tableColumns.size === 0) {
      // Se não conseguiu obter colunas, passar dados sem filtro (comportamento anterior)
      return data;
    }

    const filtered: Record<string, unknown> = {};
    const removedFields: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (tableColumns.has(key)) {
        filtered[key] = value;
      } else {
        removedFields.push(key);
      }
    }

    if (removedFields.length > 0) {
      logger.warn(`[Database] Campos do servidor removidos (não existem em ${tableName}): ${removedFields.join(', ')}`);
    }

    return filtered;
  }

  // ==========================================================================
  // INICIALIZAÇÃO
  // ==========================================================================
  /**
   * Inicializa o banco de dados e cria as tabelas se necessário
   */
  async initialize(): Promise<void> {
    // Se já inicializado, retorna imediatamente
    if (this.isInitialized) {
      console.log('[Database] Já inicializado');
      return;
    }

    // Se já está inicializando, aguarda
    if (this.initPromise) {
      return this.initPromise;
    }

    // Inicia a inicialização
    this.initPromise = this._doInitialize();
    
    try {
      await this.initPromise;
    } catch (error) {
      this.initPromise = null;
      throw error;
    }
  }

  private async _doInitialize(): Promise<void> {
    try {
      console.log('[Database] Inicializando banco de dados...');
      
      // Abrir/criar banco de dados
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      
      // Habilitar foreign keys
      await this.db.execAsync('PRAGMA foreign_keys = ON;');

      // WAL mode: leituras concorrentes durante escritas (sync não trava a UI)
      await this.db.execAsync('PRAGMA journal_mode = WAL;');
      // Menos fsync (NORMAL: seguro e mais rápido que FULL)
      await this.db.execAsync('PRAGMA synchronous = NORMAL;');
      // Cache de ~8MB (padrão é 2MB)
      await this.db.execAsync('PRAGMA cache_size = -8000;');
      // Aguarda 5s antes de "database is locked"
      await this.db.execAsync('PRAGMA busy_timeout = 5000;');
      
      // Criar tabelas (apenas CREATE TABLE, sem índices)
      await this.createTables();
      
      // Executar migrations (adicionar colunas faltantes em bancos existentes)
      await this.runMigrations();
      
      // Criar índices (APÓS migrations para garantir que colunas existam)
      await this.createIndexes();
      
      // Inicializar metadata de sync
      await this.initializeSyncMetadata();
      
      this.isInitialized = true;
      // Limpar cache de colunas (pode ter mudado após migrations)
      this.tableColumnsCache.clear();
      console.log('[Database] Banco inicializado com sucesso!');
      
    } catch (error) {
      console.error('[Database] Erro ao inicializar:', error);
      throw new Error(`Falha ao inicializar banco de dados: ${error}`);
    }
  }

  /**
   * Cria todas as tabelas do banco (APENAS CREATE TABLE, sem índices)
   * Índices são criados em createIndexes() APÓS runMigrations()
   * para garantir que colunas como syncStatus já existam.
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');

    const tables = [
      // Tabela de Clientes
      `CREATE TABLE IF NOT EXISTS ${TABLES.CLIENTES} (
        id TEXT PRIMARY KEY,
        tipo TEXT,
        tipoPessoa TEXT,
        identificador TEXT,
        cpf TEXT,
        rg TEXT,
        nomeCompleto TEXT,
        cnpj TEXT,
        razaoSocial TEXT,
        nomeFantasia TEXT,
        inscricaoEstadual TEXT,
        nomeExibicao TEXT,
        email TEXT,
        telefonePrincipal TEXT,
        contatos TEXT,
        cep TEXT,
        logradouro TEXT,
        numero TEXT,
        complemento TEXT,
        bairro TEXT,
        cidade TEXT,
        estado TEXT,
        latitude REAL,
        longitude REAL,
        rotaId TEXT,
        rotaNome TEXT,
        status TEXT,
        dataCadastro TEXT,
        dataUltimaAlteracao TEXT,
        observacao TEXT,
        syncStatus TEXT,
        lastSyncedAt TEXT,
        needsSync INTEGER,
        version INTEGER,
        deviceId TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        deletedAt TEXT
      )`,

      // Tabela de Produtos
      `CREATE TABLE IF NOT EXISTS ${TABLES.PRODUTOS} (
        id TEXT PRIMARY KEY,
        tipo TEXT,
        identificador TEXT,
        numeroRelogio TEXT,
        tipoId TEXT,
        tipoNome TEXT,
        descricaoId TEXT,
        descricaoNome TEXT,
        tamanhoId TEXT,
        tamanhoNome TEXT,
        codigoCH TEXT,
        codigoABLF TEXT,
        conservacao TEXT,
        statusProduto TEXT,
        dataFabricacao TEXT,
        dataUltimaManutencao TEXT,
        relatorioUltimaManutencao TEXT,
        dataAvaliacao TEXT,
        aprovacao TEXT,
        estabelecimento TEXT,
        observacao TEXT,
        dataCadastro TEXT,
        dataUltimaAlteracao TEXT,
        syncStatus TEXT,
        lastSyncedAt TEXT,
        needsSync INTEGER,
        version INTEGER,
        deviceId TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        deletedAt TEXT
      )`,

      // Tabela de Locações
      `CREATE TABLE IF NOT EXISTS ${TABLES.LOCACOES} (
        id TEXT PRIMARY KEY,
        tipo TEXT,
        clienteId TEXT,
        clienteNome TEXT,
        produtoId TEXT,
        produtoIdentificador TEXT,
        produtoTipo TEXT,
        dataLocacao TEXT,
        dataFim TEXT,
        observacao TEXT,
        formaPagamento TEXT,
        numeroRelogio TEXT,
        precoFicha REAL,
        percentualEmpresa REAL,
        percentualCliente REAL,
        periodicidade TEXT,
        valorFixo REAL,
        dataPrimeiraCobranca TEXT,
        status TEXT,
        ultimaLeituraRelogio REAL,
        dataUltimaCobranca TEXT,
        trocaPano INTEGER DEFAULT 0,
        dataUltimaManutencao TEXT,
        syncStatus TEXT,
        lastSyncedAt TEXT,
        needsSync INTEGER,
        version INTEGER,
        deviceId TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        deletedAt TEXT
      )`,

      // Tabela de Cobranças
      `CREATE TABLE IF NOT EXISTS ${TABLES.COBRANCAS} (
        id TEXT PRIMARY KEY,
        tipo TEXT,
        locacaoId TEXT,
        clienteId TEXT,
        clienteNome TEXT,
        produtoId TEXT,
        produtoIdentificador TEXT,
        dataInicio TEXT,
        dataFim TEXT,
        dataPagamento TEXT,
        relogioAnterior REAL,
        relogioAtual REAL,
        fichasRodadas REAL,
        valorFicha REAL,
        totalBruto REAL,
        descontoPartidasQtd REAL,
        descontoPartidasValor REAL,
        descontoDinheiro REAL,
        percentualEmpresa REAL,
        subtotalAposDescontos REAL,
        valorPercentual REAL,
        totalClientePaga REAL,
        valorRecebido REAL,
        saldoDevedorGerado REAL,
        status TEXT,
        dataVencimento TEXT,
        observacao TEXT,
        trocaPano INTEGER DEFAULT 0,
        syncStatus TEXT,
        lastSyncedAt TEXT,
        needsSync INTEGER,
        version INTEGER,
        deviceId TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        deletedAt TEXT
      )`,

      // Tabela de Rotas
      `CREATE TABLE IF NOT EXISTS ${TABLES.ROTAS} (
        id TEXT PRIMARY KEY,
        descricao TEXT,
        status TEXT,
        cor TEXT DEFAULT '#2563EB',
        regiao TEXT,
        ordem INTEGER DEFAULT 0,
        observacao TEXT,
        syncStatus TEXT,
        lastSyncedAt TEXT,
        needsSync INTEGER,
        version INTEGER,
        deviceId TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        deletedAt TEXT
      )`,

      // Tabela de Usuários
      `CREATE TABLE IF NOT EXISTS ${TABLES.USUARIOS} (
        id TEXT PRIMARY KEY,
        tipo TEXT,
        nome TEXT,
        cpf TEXT,
        telefone TEXT,
        email TEXT UNIQUE,
        senha TEXT,
        tipoPermissao TEXT,
        permissoesWeb TEXT,
        permissoesMobile TEXT,
        rotasPermitidas TEXT,
        status TEXT,
        bloqueado INTEGER,
        dataUltimoAcesso TEXT,
        ultimoAcessoDispositivo TEXT,
        tentativasLoginFalhas INTEGER DEFAULT 0,
        bloqueadoAte TEXT,
        syncStatus TEXT,
        lastSyncedAt TEXT,
        needsSync INTEGER,
        version INTEGER,
        deviceId TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        deletedAt TEXT
      )`,

      // Tabela de Tipos de Produto
      `CREATE TABLE IF NOT EXISTS ${TABLES.TIPOS_PRODUTO} (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        syncStatus TEXT,
        lastSyncedAt TEXT,
        needsSync INTEGER,
        version INTEGER,
        deviceId TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        deletedAt TEXT
      )`,

      // Tabela de Descrições de Produto
      `CREATE TABLE IF NOT EXISTS ${TABLES.DESCRICOES_PRODUTO} (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        syncStatus TEXT,
        lastSyncedAt TEXT,
        needsSync INTEGER,
        version INTEGER,
        deviceId TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        deletedAt TEXT
      )`,

      // Tabela de Tamanhos de Produto
      `CREATE TABLE IF NOT EXISTS ${TABLES.TAMANHOS_PRODUTO} (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        syncStatus TEXT,
        lastSyncedAt TEXT,
        needsSync INTEGER,
        version INTEGER,
        deviceId TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        deletedAt TEXT
      )`,

      // Tabela de Estabelecimentos (destinos de estoque)
      `CREATE TABLE IF NOT EXISTS ${TABLES.ESTABELECIMENTOS} (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        endereco TEXT,
        observacao TEXT,
        syncStatus TEXT,
        lastSyncedAt TEXT,
        needsSync INTEGER,
        version INTEGER,
        deviceId TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        deletedAt TEXT
      )`,

      // Change Log (para sincronização)
      `CREATE TABLE IF NOT EXISTS ${TABLES.CHANGE_LOG} (
        id TEXT PRIMARY KEY,
        entityId TEXT NOT NULL,
        entityType TEXT NOT NULL,
        operation TEXT NOT NULL,
        changes TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        deviceId TEXT NOT NULL,
        synced INTEGER DEFAULT 0,
        syncedAt TEXT
      )`,

      // Histórico de alteração de relógio
      `CREATE TABLE IF NOT EXISTS ${TABLES.HISTORICO_RELOGIO} (
        id TEXT PRIMARY KEY,
        produtoId TEXT NOT NULL,
        relogioAnterior TEXT,
        relogioNovo TEXT,
        motivo TEXT,
        dataAlteracao TEXT,
        usuarioResponsavel TEXT,
        needsSync INTEGER DEFAULT 1
      )`,

      // Tabela de Manutenções (trocas de pano, etc.)
      `CREATE TABLE IF NOT EXISTS manutencoes (
        id TEXT PRIMARY KEY,
        produtoId TEXT NOT NULL,
        produtoIdentificador TEXT,
        produtoTipo TEXT,
        clienteId TEXT,
        clienteNome TEXT,
        locacaoId TEXT,
        cobrancaId TEXT,
        tipo TEXT NOT NULL,
        descricao TEXT,
        data TEXT NOT NULL,
        registradoPor TEXT,
        syncStatus TEXT,
        lastSyncedAt TEXT,
        needsSync INTEGER,
        version INTEGER,
        deviceId TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        deletedAt TEXT
      )`,

      // Tabela de Metas
      `CREATE TABLE IF NOT EXISTS ${TABLES.METAS} (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        tipo TEXT NOT NULL DEFAULT 'receita',
        valorMeta REAL NOT NULL,
        valorAtual REAL NOT NULL DEFAULT 0,
        dataInicio TEXT NOT NULL,
        dataFim TEXT NOT NULL,
        rotaId TEXT,
        status TEXT NOT NULL DEFAULT 'ativa',
        criadoPor TEXT,
        syncStatus TEXT,
        lastSyncedAt TEXT,
        needsSync INTEGER,
        version INTEGER,
        deviceId TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        deletedAt TEXT
      )`,

      // Sync Metadata
      `CREATE TABLE IF NOT EXISTS ${TABLES.SYNC_METADATA} (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
    ];

    for (const table of tables) {
      try {
        await this.db.execAsync(table);
      } catch (ddlError: any) {
        // DDL errors are critical — log with the SQL for debugging
        console.error(`[Database] DDL error: ${ddlError?.message}`);
        console.error(`[Database] Failing SQL: ${table.substring(0, 120)}...`);
        throw ddlError;
      }
    }

    console.log('[Database] Tabelas criadas com sucesso');

  }

  /**
   * Executa migrations para adicionar colunas faltantes em bancos existentes.
   * Isso garante compatibilidade com versões anteriores do app.
   *
   * IMPORTANTE: Tabelas criadas por versões antigas podem NÃO ter as colunas
   * de sincronização (syncStatus, lastSyncedAt, needsSync, version, deviceId,
   * createdAt, updatedAt, deletedAt). Essas migrations garantem que todas
   * as colunas existam antes da criação de índices.
   */
  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');

    console.log('[Database] Verificando migrations...');

    // Colunas de sincronização que DEVEM existir em todas as tabelas syncáveis
    const SYNC_COLUMNS = [
      { name: 'syncStatus', sql: 'TEXT' },
      { name: 'lastSyncedAt', sql: 'TEXT' },
      { name: 'needsSync', sql: 'INTEGER DEFAULT 0' },
      { name: 'version', sql: 'INTEGER DEFAULT 1' },
      { name: 'deviceId', sql: "TEXT DEFAULT ''" },
      { name: 'createdAt', sql: 'TEXT' },
      { name: 'updatedAt', sql: 'TEXT' },
      { name: 'deletedAt', sql: 'TEXT' },
    ];

    // Tabelas que devem ter as colunas de sincronização
    const SYNCABLE_TABLES = [
      TABLES.CLIENTES,
      TABLES.PRODUTOS,
      TABLES.LOCACOES,
      TABLES.COBRANCAS,
      TABLES.ROTAS,
      TABLES.USUARIOS,
      TABLES.TIPOS_PRODUTO,
      TABLES.DESCRICOES_PRODUTO,
      TABLES.TAMANHOS_PRODUTO,
      TABLES.ESTABELECIMENTOS,
      TABLES.METAS,
      'manutencoes',
      TABLES.HISTORICO_RELOGIO,
    ];

    // Lista de migrations a executar
    const migrations: Array<{ name: string; sql: string }> = [];

    // ── Migrations de colunas de sincronização para TODAS as tabelas ──
    for (const tableName of SYNCABLE_TABLES) {
      for (const col of SYNC_COLUMNS) {
        migrations.push({
          name: `add_${col.name}_to_${tableName}`,
          sql: `ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.sql}`,
        });
      }
    }

    // ── Migrations específicas (colunas de negócio) ──
    migrations.push(
      // Adicionar coluna produtoId na tabela cobrancas
      {
        name: 'add_produtoId_to_cobrancas',
        sql: `ALTER TABLE ${TABLES.COBRANCAS} ADD COLUMN produtoId TEXT`,
      },
      // Colunas enriquecidas na tabela rotas
      {
        name: 'add_cor_to_rotas',
        sql: `ALTER TABLE ${TABLES.ROTAS} ADD COLUMN cor TEXT DEFAULT '#2563EB'`,
      },
      {
        name: 'add_regiao_to_rotas',
        sql: `ALTER TABLE ${TABLES.ROTAS} ADD COLUMN regiao TEXT`,
      },
      {
        name: 'add_ordem_to_rotas',
        sql: `ALTER TABLE ${TABLES.ROTAS} ADD COLUMN ordem INTEGER DEFAULT 0`,
      },
      {
        name: 'add_observacao_to_rotas',
        sql: `ALTER TABLE ${TABLES.ROTAS} ADD COLUMN observacao TEXT`,
      },
      // Coluna trocaPano na tabela cobrancas
      {
        name: 'add_trocaPano_to_cobrancas',
        sql: `ALTER TABLE ${TABLES.COBRANCAS} ADD COLUMN trocaPano INTEGER DEFAULT 0`,
      },
      // Campos enriquecidos em estabelecimentos
      {
        name: 'add_endereco_to_estabelecimentos',
        sql: `ALTER TABLE ${TABLES.ESTABELECIMENTOS} ADD COLUMN endereco TEXT`,
      },
      {
        name: 'add_observacao_to_estabelecimentos',
        sql: `ALTER TABLE ${TABLES.ESTABELECIMENTOS} ADD COLUMN observacao TEXT`,
      },
      // Criar tabela historico_relogio
      {
        name: 'create_historico_relogio_table',
        sql: `CREATE TABLE IF NOT EXISTS ${TABLES.HISTORICO_RELOGIO} (
          id TEXT PRIMARY KEY,
          produtoId TEXT NOT NULL,
          relogioAnterior TEXT,
          relogioNovo TEXT,
          motivo TEXT,
          dataAlteracao TEXT,
          usuarioResponsavel TEXT,
          needsSync INTEGER DEFAULT 1
        )`,
      },
      // Corrigir tipo de ultimaLeituraRelogio
      {
        name: 'fix_ultimaLeituraRelogio_to_real',
        sql: `ALTER TABLE ${TABLES.LOCACOES} ADD COLUMN ultimaLeituraRelogio REAL`,
      },
      // Adicionar tentativasLoginFalhas na tabela usuarios
      {
        name: 'add_tentativasLoginFalhas_to_usuarios',
        sql: `ALTER TABLE ${TABLES.USUARIOS} ADD COLUMN tentativasLoginFalhas INTEGER DEFAULT 0`,
      },
      // Adicionar bloqueadoAte na tabela usuarios
      {
        name: 'add_bloqueadoAte_to_usuarios',
        sql: `ALTER TABLE ${TABLES.USUARIOS} ADD COLUMN bloqueadoAte TEXT`,
      },
      // Colunas de negócio adicionais em clientes
      {
        name: 'add_tipoPessoa_to_clientes',
        sql: `ALTER TABLE ${TABLES.CLIENTES} ADD COLUMN tipoPessoa TEXT`,
      },
      {
        name: 'add_identificador_to_clientes',
        sql: `ALTER TABLE ${TABLES.CLIENTES} ADD COLUMN identificador TEXT`,
      },
      {
        name: 'add_rg_to_clientes',
        sql: `ALTER TABLE ${TABLES.CLIENTES} ADD COLUMN rg TEXT`,
      },
      {
        name: 'add_razaoSocial_to_clientes',
        sql: `ALTER TABLE ${TABLES.CLIENTES} ADD COLUMN razaoSocial TEXT`,
      },
      {
        name: 'add_nomeFantasia_to_clientes',
        sql: `ALTER TABLE ${TABLES.CLIENTES} ADD COLUMN nomeFantasia TEXT`,
      },
      {
        name: 'add_inscricaoEstadual_to_clientes',
        sql: `ALTER TABLE ${TABLES.CLIENTES} ADD COLUMN inscricaoEstadual TEXT`,
      },
      {
        name: 'add_nomeExibicao_to_clientes',
        sql: `ALTER TABLE ${TABLES.CLIENTES} ADD COLUMN nomeExibicao TEXT`,
      },
      {
        name: 'add_contatos_to_clientes',
        sql: `ALTER TABLE ${TABLES.CLIENTES} ADD COLUMN contatos TEXT`,
      },
      // Colunas adicionais em produtos
      {
        name: 'add_codigoCH_to_produtos',
        sql: `ALTER TABLE ${TABLES.PRODUTOS} ADD COLUMN codigoCH TEXT`,
      },
      {
        name: 'add_codigoABLF_to_produtos',
        sql: `ALTER TABLE ${TABLES.PRODUTOS} ADD COLUMN codigoABLF TEXT`,
      },
      {
        name: 'add_conservacao_to_produtos',
        sql: `ALTER TABLE ${TABLES.PRODUTOS} ADD COLUMN conservacao TEXT`,
      },
      {
        name: 'add_dataFabricacao_to_produtos',
        sql: `ALTER TABLE ${TABLES.PRODUTOS} ADD COLUMN dataFabricacao TEXT`,
      },
      {
        name: 'add_dataUltimaManutencao_to_produtos',
        sql: `ALTER TABLE ${TABLES.PRODUTOS} ADD COLUMN dataUltimaManutencao TEXT`,
      },
      {
        name: 'add_relatorioUltimaManutencao_to_produtos',
        sql: `ALTER TABLE ${TABLES.PRODUTOS} ADD COLUMN relatorioUltimaManutencao TEXT`,
      },
      {
        name: 'add_dataAvaliacao_to_produtos',
        sql: `ALTER TABLE ${TABLES.PRODUTOS} ADD COLUMN dataAvaliacao TEXT`,
      },
      {
        name: 'add_aprovacao_to_produtos',
        sql: `ALTER TABLE ${TABLES.PRODUTOS} ADD COLUMN aprovacao TEXT`,
      },
      {
        name: 'add_estabelecimento_to_produtos',
        sql: `ALTER TABLE ${TABLES.PRODUTOS} ADD COLUMN estabelecimento TEXT`,
      },
      // Colunas adicionais em locacoes
      {
        name: 'add_produtoTipo_to_locacoes',
        sql: `ALTER TABLE ${TABLES.LOCACOES} ADD COLUMN produtoTipo TEXT`,
      },
      {
        name: 'add_dataPrimeiraCobranca_to_locacoes',
        sql: `ALTER TABLE ${TABLES.LOCACOES} ADD COLUMN dataPrimeiraCobranca TEXT`,
      },
      {
        name: 'add_trocaPano_to_locacoes',
        sql: `ALTER TABLE ${TABLES.LOCACOES} ADD COLUMN trocaPano INTEGER DEFAULT 0`,
      },
      {
        name: 'add_dataUltimaManutencao_to_locacoes',
        sql: `ALTER TABLE ${TABLES.LOCACOES} ADD COLUMN dataUltimaManutencao TEXT`,
      },
      // Colunas adicionais em cobrancas
      {
        name: 'add_produtoIdentificador_to_cobrancas',
        sql: `ALTER TABLE ${TABLES.COBRANCAS} ADD COLUMN produtoIdentificador TEXT`,
      },
      // Colunas adicionais em usuarios
      {
        name: 'add_tipoPermissao_to_usuarios',
        sql: `ALTER TABLE ${TABLES.USUARIOS} ADD COLUMN tipoPermissao TEXT`,
      },
      {
        name: 'add_permissoesWeb_to_usuarios',
        sql: `ALTER TABLE ${TABLES.USUARIOS} ADD COLUMN permissoesWeb TEXT`,
      },
      {
        name: 'add_permissoesMobile_to_usuarios',
        sql: `ALTER TABLE ${TABLES.USUARIOS} ADD COLUMN permissoesMobile TEXT`,
      },
      {
        name: 'add_rotasPermitidas_to_usuarios',
        sql: `ALTER TABLE ${TABLES.USUARIOS} ADD COLUMN rotasPermitidas TEXT`,
      },
      {
        name: 'add_bloqueado_to_usuarios',
        sql: `ALTER TABLE ${TABLES.USUARIOS} ADD COLUMN bloqueado INTEGER`,
      },
      {
        name: 'add_dataUltimoAcesso_to_usuarios',
        sql: `ALTER TABLE ${TABLES.USUARIOS} ADD COLUMN dataUltimoAcesso TEXT`,
      },
      {
        name: 'add_ultimoAcessoDispositivo_to_usuarios',
        sql: `ALTER TABLE ${TABLES.USUARIOS} ADD COLUMN ultimoAcessoDispositivo TEXT`,
      },
      // Colunas adicionais em manutencoes
      {
        name: 'add_produtoIdentificador_to_manutencoes',
        sql: `ALTER TABLE manutencoes ADD COLUMN produtoIdentificador TEXT`,
      },
      {
        name: 'add_produtoTipo_to_manutencoes',
        sql: `ALTER TABLE manutencoes ADD COLUMN produtoTipo TEXT`,
      },
      {
        name: 'add_clienteId_to_manutencoes',
        sql: `ALTER TABLE manutencoes ADD COLUMN clienteId TEXT`,
      },
      {
        name: 'add_clienteNome_to_manutencoes',
        sql: `ALTER TABLE manutencoes ADD COLUMN clienteNome TEXT`,
      },
      {
        name: 'add_locacaoId_to_manutencoes',
        sql: `ALTER TABLE manutencoes ADD COLUMN locacaoId TEXT`,
      },
      {
        name: 'add_cobrancaId_to_manutencoes',
        sql: `ALTER TABLE manutencoes ADD COLUMN cobrancaId TEXT`,
      },
      {
        name: 'add_descricao_to_manutencoes',
        sql: `ALTER TABLE manutencoes ADD COLUMN descricao TEXT`,
      },
      {
        name: 'add_registradoPor_to_manutencoes',
        sql: `ALTER TABLE manutencoes ADD COLUMN registradoPor TEXT`,
      },
      // Colunas adicionais em metas
      {
        name: 'add_criadoPor_to_metas',
        sql: `ALTER TABLE ${TABLES.METAS} ADD COLUMN criadoPor TEXT`,
      },
    );

    // Verificar e executar cada migration
    for (const migration of migrations) {
      try {
        // Verificar se a migration já foi executada
        const metaKey = `migration_${migration.name}`;
        const existing = await this.db.getFirstAsync<any>(
          `SELECT value FROM ${TABLES.SYNC_METADATA} WHERE key = ?`,
          [metaKey]
        );

        if (existing?.value === 'done') {
          continue;
        }

        // Executar migration
        console.log(`[Database] Executando migration: ${migration.name}`);
        await this.db.execAsync(migration.sql);

        // Marcar como executada
        await this.db.runAsync(
          `INSERT OR REPLACE INTO ${TABLES.SYNC_METADATA} (key, value) VALUES (?, 'done')`,
          [metaKey]
        );
      } catch (error: any) {
        // Ignorar erro se a coluna/tabela já existir
        const msg = error?.message || '';
        if (msg.includes('duplicate column') || msg.includes('already exists')) {
          // Marcar como executada mesmo assim
          await this.db.runAsync(
            `INSERT OR REPLACE INTO ${TABLES.SYNC_METADATA} (key, value) VALUES (?, 'done')`,
            [`migration_${migration.name}`]
          ).catch(() => {}); // ignorar erro ao marcar
        } else {
          console.warn(`[Database] Migration ${migration.name}: ${msg}`);
        }
      }
    }

    console.log('[Database] Migrations verificadas');
  }

  /**
   * Cria índices para performance.
   * DEVE ser chamado APÓS runMigrations() para garantir que todas as
   * colunas referenciadas (como syncStatus, needsSync) já existam.
   */
  private async createIndexes(): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');

    const indexes = [
      // Clientes
      `CREATE INDEX IF NOT EXISTS idx_clientes_rota ON ${TABLES.CLIENTES}(rotaId)`,
      `CREATE INDEX IF NOT EXISTS idx_clientes_status ON ${TABLES.CLIENTES}(status)`,
      `CREATE INDEX IF NOT EXISTS idx_clientes_sync ON ${TABLES.CLIENTES}(syncStatus, needsSync)`,

      // Produtos
      `CREATE INDEX IF NOT EXISTS idx_produtos_status ON ${TABLES.PRODUTOS}(statusProduto)`,
      `CREATE INDEX IF NOT EXISTS idx_produtos_sync ON ${TABLES.PRODUTOS}(syncStatus, needsSync)`,

      // Locações
      `CREATE INDEX IF NOT EXISTS idx_locacoes_cliente ON ${TABLES.LOCACOES}(clienteId)`,
      `CREATE INDEX IF NOT EXISTS idx_locacoes_produto ON ${TABLES.LOCACOES}(produtoId)`,
      `CREATE INDEX IF NOT EXISTS idx_locacoes_status ON ${TABLES.LOCACOES}(status)`,
      `CREATE INDEX IF NOT EXISTS idx_locacoes_sync ON ${TABLES.LOCACOES}(syncStatus, needsSync)`,

      // Cobranças
      `CREATE INDEX IF NOT EXISTS idx_cobrancas_locacao ON ${TABLES.COBRANCAS}(locacaoId)`,
      `CREATE INDEX IF NOT EXISTS idx_cobrancas_cliente ON ${TABLES.COBRANCAS}(clienteId)`,
      `CREATE INDEX IF NOT EXISTS idx_cobrancas_produto ON ${TABLES.COBRANCAS}(produtoId)`,
      `CREATE INDEX IF NOT EXISTS idx_cobrancas_status ON ${TABLES.COBRANCAS}(status)`,

      // Rotas
      `CREATE INDEX IF NOT EXISTS idx_rotas_status ON ${TABLES.ROTAS}(status)`,
      `CREATE INDEX IF NOT EXISTS idx_rotas_sync ON ${TABLES.ROTAS}(syncStatus, needsSync)`,

      // Usuários
      `CREATE INDEX IF NOT EXISTS idx_usuarios_email ON ${TABLES.USUARIOS}(email)`,
      `CREATE INDEX IF NOT EXISTS idx_usuarios_status ON ${TABLES.USUARIOS}(status)`,
      `CREATE INDEX IF NOT EXISTS idx_usuarios_sync ON ${TABLES.USUARIOS}(syncStatus, needsSync)`,

      // Manutenções
      `CREATE INDEX IF NOT EXISTS idx_manutencoes_produto ON manutencoes(produtoId)`,
      `CREATE INDEX IF NOT EXISTS idx_manutencoes_data ON manutencoes(data)`,
      `CREATE INDEX IF NOT EXISTS idx_manutencoes_sync ON manutencoes(syncStatus, needsSync)`,

      // Metas
      `CREATE INDEX IF NOT EXISTS idx_metas_status ON ${TABLES.METAS}(status)`,
      `CREATE INDEX IF NOT EXISTS idx_metas_periodo ON ${TABLES.METAS}(dataInicio, dataFim)`,
      `CREATE INDEX IF NOT EXISTS idx_metas_rota ON ${TABLES.METAS}(rotaId)`,
      `CREATE INDEX IF NOT EXISTS idx_metas_sync ON ${TABLES.METAS}(syncStatus, needsSync)`,

      // Histórico Relógio
      `CREATE INDEX IF NOT EXISTS idx_historico_relogio_produto ON ${TABLES.HISTORICO_RELOGIO}(produtoId)`,
      `CREATE INDEX IF NOT EXISTS idx_historico_relogio_data ON ${TABLES.HISTORICO_RELOGIO}(dataAlteracao)`,
      `CREATE INDEX IF NOT EXISTS idx_historico_relogio_sync ON ${TABLES.HISTORICO_RELOGIO}(needsSync)`,

      // Change Log
      `CREATE INDEX IF NOT EXISTS idx_change_log_sync ON ${TABLES.CHANGE_LOG}(synced, timestamp)`,
      `CREATE INDEX IF NOT EXISTS idx_change_log_purge ON ${TABLES.CHANGE_LOG}(synced, syncedAt)`,
      `CREATE INDEX IF NOT EXISTS idx_change_log_entity ON ${TABLES.CHANGE_LOG}(entityId, entityType)`,
    ];

    for (const indexSql of indexes) {
      try {
        await this.db.execAsync(indexSql);
      } catch (idxError: any) {
        // Índices não são críticos — logar mas não falhar a inicialização
        console.warn(`[Database] Índice não criado (não crítico): ${idxError?.message}`);
      }
    }

    console.log('[Database] Índices verificados');
  }

  /**
   * Inicializa metadata de sincronização
   */
  private async initializeSyncMetadata(): Promise<void> {
    const defaultMetadata: SyncMetadata = {
      lastSyncAt: new Date(0).toISOString(),
      lastPushAt: new Date(0).toISOString(),
      lastPullAt: new Date(0).toISOString(),
      syncInProgress: false,
      deviceId: '',
      deviceName: '',
      deviceKey: '',
      chave: '',
    };

    for (const [key, value] of Object.entries(defaultMetadata)) {
      await this.db!.runAsync(
        `INSERT OR IGNORE INTO ${TABLES.SYNC_METADATA} (key, value) VALUES (?, ?)`,
        [key, typeof value === 'object' ? JSON.stringify(value) : String(value)]
      );
  
  }

  }

  // ==========================================================================
  // OPERAÇÕES CRUD GENÉRICAS
  // ==========================================================================

  /**
   * Salva ou atualiza uma entidade
   */
  async save<T extends SyncableEntity>(
    entityType: EntityType,
    entity: T
  ): Promise<void> {
    if (!this.isReady()) {
      await this.waitForReady();
    }
    if (!this.db) throw new Error('Database não inicializado');

    const tableName = this.getTableName(entityType);
    const now = new Date().toISOString();

    try {
      await this.runTransaction(async () => {
        // Verificar se existe
        const existing = await this.getById<T>(entityType, entity.id);

        if (existing) {
          // UPDATE
          await this.update(entityType, { ...entity, updatedAt: now }, true);
        } else {
          // INSERT
          const newEntity = {
            ...entity,
            createdAt: now,
            updatedAt: now,
            needsSync: 1,
          } as T;
          await this.insert(tableName, newEntity);
      
  }

        // Log mudança para sincronização
        await this.logChange({
          id: `${entityType}_${entity.id}_${now}`,
          entityId: entity.id,
          entityType,
          operation: existing ? 'update' : 'create',
          changes: entity as any,
          timestamp: now,
          deviceId: await this.getDeviceId(),
          synced: false,
        });
      });

      console.log(`[Database] ${entityType} salvo: ${entity.id}`);
    } catch (error) {
      console.error(`[Database] Erro ao salvar ${entityType}:`, error);
      throw error;
  
  }

  }

  /**
   * Busca entidade por ID
   */
  async getById<T>(entityType: EntityType, id: string): Promise<T | null> {
    if (!this.isReady()) {
      await this.waitForReady();
    }
    if (!this.db) throw new Error('Database não inicializado');

    const tableName = this.getTableName(entityType);
    const softDelete = this.hasSoftDelete(entityType);

    try {
      const query = softDelete
        ? `SELECT * FROM ${tableName} WHERE id = ? AND deletedAt IS NULL`
        : `SELECT * FROM ${tableName} WHERE id = ?`;
      const result = await this.db.getFirstAsync<T>(query, [id]);

      return result || null;
    } catch (error) {
      console.error(`[Database] Erro ao buscar ${entityType}:`, error);
      return null;
  
  }

  }

  /**
   * Busca todas as entidades (com filtros opcionais)   */
  async getAll<T>(
    entityType: EntityType,
    where?: string,
    params: any[] = []
  ): Promise<T[]> {
    if (!this.isReady()) {
      await this.waitForReady();
    }
    if (!this.db) throw new Error('Database não inicializado');

    const tableName = this.getTableName(entityType);
    const softDelete = this.hasSoftDelete(entityType);
    let query = softDelete
      ? `SELECT * FROM ${tableName} WHERE deletedAt IS NULL`
      : `SELECT * FROM ${tableName}`;

    if (where) {
      query += softDelete ? ` AND ${where}` : ` WHERE ${where}`;
  
  }

    query += ' ORDER BY updatedAt DESC';

    try {
      const results = await this.db.getAllAsync<T>(query, params);
      return results || [];
    } catch (error) {
      console.error(`[Database] Erro ao buscar ${entityType}:`, error);
      return [];
  
  }

  }

  /**
   * Atualiza entidade existente
   */
  async update<T extends SyncableEntity>(
    entityType: EntityType,
    entity: T,
    skipLog: boolean = false
  ): Promise<void> {
    if (!this.isReady()) {
      await this.waitForReady();
    }
    if (!this.db) throw new Error('Database não inicializado');

    const tableName = this.getTableName(entityType);
    const now = new Date().toISOString();

    try {
      // Marcar como precisando de sync
      const entityWithSync = {
        ...entity,
        updatedAt: now,
        needsSync: 1, // Integer para SQLite
        version: (entity.version || 0) + 1,
      } as T;

      // Construir campos e valores dinamicamente, excluindo campos virtuais
      const fields = Object.keys(entityWithSync).filter(
        (key) => !UPDATE_EXCLUIDOS.has(key) && (entityWithSync as any)[key] !== undefined
      );
      const setClause = fields.map((field) => `${field} = ?`).join(', ');
      
      // Serializar arrays e objetos para JSON antes de salvar
      const values = fields.map((field) => {
        const val = (entityWithSync as any)[field];
        if (val !== null && val !== undefined && typeof val === 'object') {
          return JSON.stringify(val);
        }
        return val;
      });

      await this.db.runAsync(
        `UPDATE ${tableName} SET ${setClause} WHERE id = ?`,
        [...values, entity.id]
      );

      if (!skipLog) {
        // Log mudança
        await this.logChange({
          id: `${entityType}_${entity.id}_${now}`,
          entityId: entity.id,
          entityType,
          operation: 'update',
          changes: entity as any,
          timestamp: now,
          deviceId: await this.getDeviceId(),
          synced: false,
        });
      }

      console.log(`[Database] ${entityType} atualizado: ${entity.id}`);
    } catch (error) {
      console.error(`[Database] Erro ao atualizar ${entityType}:`, error);
      throw error;
    
  }

  }

  /**
   * Remove entidade (soft delete)
   */
  async delete(entityType: EntityType, id: string): Promise<void> {
    if (!this.isReady()) {
      await this.waitForReady();
    }
    if (!this.db) throw new Error('Database não inicializado');

    const tableName = this.getTableName(entityType);
    const now = new Date().toISOString();

    try {
      await this.db.runAsync(
        `UPDATE ${tableName} SET deletedAt = ?, needsSync = 1 WHERE id = ?`,
        [now, id]
      );

      // Log mudança
      await this.logChange({
        id: `${entityType}_${id}_${now}`,
        entityId: id,
        entityType,
        operation: 'delete',
        changes: { id, deletedAt: now },
        timestamp: now,
        deviceId: await this.getDeviceId(),
        synced: false,
      });

      console.log(`[Database] ${entityType} removido: ${id}`);
    } catch (error) {
      console.error(`[Database] Erro ao remover ${entityType}:`, error);
      throw error;
  
  }

  }

  // ==========================================================================
  // SINCRONIZAÇÃO
  // ==========================================================================

  /**
   * Busca mudanças pendentes para enviar ao servidor
   */
  async getPendingChanges(): Promise<ChangeLog[]> {
    if (!this.db) throw new Error('Database não inicializado');

    try {
      const results = await this.db.getAllAsync<ChangeLog>(
        `SELECT * FROM ${TABLES.CHANGE_LOG} 
         WHERE synced = 0 
         ORDER BY timestamp ASC`
      );

      return results || [];
    } catch (error) {
      console.error('[Database] Erro ao buscar mudanças pendentes:', error);
      return [];
  
  }

  }

  /**
   * Conta mudanças pendentes agrupadas por entityType
   * Retorna um mapa: { cliente: 3, produto: 1, ... }
   */
  async getPendingChangesCountByEntity(): Promise<Record<string, number>> {
    if (!this.db) throw new Error('Database não inicializado');

    try {
      const results = await this.db.getAllAsync<{ entityType: string; count: number }>(
        `SELECT entityType, COUNT(*) as count FROM ${TABLES.CHANGE_LOG}
         WHERE synced = 0
         GROUP BY entityType`
      );

      const counts: Record<string, number> = {};
      for (const row of results) {
        counts[row.entityType] = row.count;
      }
      return counts;
    } catch (error) {
      console.error('[Database] Erro ao contar mudanças pendentes por entidade:', error);
      return {};
    }
  }

  /**
   * Marca mudança como sincronizada
   */
  async markAsSynced(changeId: string): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');

    try {
      await this.db.runAsync(
        `UPDATE ${TABLES.CHANGE_LOG} 
         SET synced = 1, syncedAt = ? 
         WHERE id = ?`,
        [new Date().toISOString(), changeId]
      );
    } catch (error) {
      console.error('[Database] Erro ao marcar como sincronizado:', error);
      throw error;  
  }

  }

  /**
   * Registra mudança no change log
   */
  async logChange(change: ChangeLog): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');

    try {
      await this.db.runAsync(
        `INSERT INTO ${TABLES.CHANGE_LOG} 
         (id, entityId, entityType, operation, changes, timestamp, deviceId, synced) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          change.id,
          change.entityId,
          change.entityType,
          change.operation,
          JSON.stringify(change.changes),
          change.timestamp,
          change.deviceId,
          change.synced ? 1 : 0,
        ]
      );
    } catch (error) {
      console.error('[Database] Erro ao logar mudança:', error);
      throw error;
  
  }

  }

  /**
   * Aplica mudanças recebidas do servidor (sem criar ChangeLog)
   * IMPORTANTE: Este método NÃO cria change logs para evitar loop de sincronização
   */
  async applyRemoteChanges(response: SyncResponse): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');

    const changes = response.changes || {};
    
    // Always log for debug terminal (not just ENV.DEBUG)
    const total = (changes.clientes || []).length + (changes.produtos || []).length +
      (changes.locacoes || []).length + (changes.cobrancas || []).length +
      (changes.rotas || []).length +
      (changes.usuarios || []).length + (changes.manutencoes || []).length +
      (changes.metas || []).length;
    logger.info(`[Database] Aplicando ${total} mudanças remotas — lastSyncAt: ${response.lastSyncAt?.substring(0, 19)}`);

    await this.runTransaction(async () => {
      // Contadores de sucesso/falha para diagnóstico
      let successCount = 0;
      let failCount = 0;

      // Aplicar mudanças de cada entidade usando upsert direto
      
      // Clientes
      for (const cliente of changes.clientes || []) {
        const ok = await this.upsertFromSync('cliente', cliente);
        if (ok) successCount++; else failCount++;
      }

      // Produtos
      for (const produto of changes.produtos || []) {
        const ok = await this.upsertFromSync('produto', produto);
        if (ok) successCount++; else failCount++;
      }

      // Locações
      for (const locacao of changes.locacoes || []) {
        const ok = await this.upsertFromSync('locacao', locacao);
        if (ok) successCount++; else failCount++;
      }

      // Cobranças
      for (const cobranca of changes.cobrancas || []) {
        const ok = await this.upsertFromSync('cobranca', cobranca);
        if (ok) successCount++; else failCount++;
      }

      // Rotas
      for (const rota of changes.rotas || []) {
        const ok = await this.upsertFromSync('rota', rota);
        if (ok) successCount++; else failCount++;
      }

      // Usuários - sincronizar permissões alteradas no web
      const usuarios = changes.usuarios || [];
      for (const usuario of usuarios) {
        await this.upsertUsuarioFromSync(usuario);
      }

      // Manutenções - sincronizar com o web
      const manutencoes = changes.manutencoes || [];
      for (const manutencao of manutencoes) {
        await this.upsertManutencaoFromSync(manutencao);
      }

      // Metas - sincronizar com o web
      const metas = changes.metas || [];
      for (const meta of metas) {
        await this.upsertMetaFromSync(meta);
      }

      // Tipos de Produto (atributos)
      const tiposProduto = response.tiposProduto || [];
      for (const tipo of tiposProduto) {
        await this.upsertTipoProdutoFromSync(tipo);
      }

      // Descrições de Produto (atributos)
      const descricoesProduto = response.descricoesProduto || [];
      for (const desc of descricoesProduto) {
        await this.upsertDescricaoProdutoFromSync(desc);
      }

      // Tamanhos de Produto (atributos)
      const tamanhosProduto = response.tamanhosProduto || [];
      for (const tam of tamanhosProduto) {
        await this.upsertTamanhoProdutoFromSync(tam);
      }

      // Estabelecimentos
      const estabelecimentos = response.estabelecimentos || [];
      for (const est of estabelecimentos) {
        await this.upsertEstabelecimentoFromSync(est);
      }

      // Histórico de Relógio
      const historicoRelogio = changes.historicoRelogio || [];
      for (const hr of historicoRelogio) {
        await this.upsertHistoricoRelogioFromSync(hr);
      }

      // Reconciliar IDs temporários (tmp_/novo_) criados offline com UUIDs reais do servidor
      // Deve rodar APÓS aplicar todos os atributos do pull
      await this.reconciliarAtributosTemporarios();

      // Atualizar metadata
      await this.updateSyncMetadata({
        lastSyncAt: response.lastSyncAt,
        lastPullAt: new Date().toISOString(),
      });

      // Log de resultado da transação
      if (failCount > 0) {
        logger.error(`[Database] applyRemoteChanges: ${successCount} sucessos, ${failCount} FALHAS — verifique os logs acima para detalhes`);
      } else {
        logger.info(`[Database] applyRemoteChanges: ${successCount} registros aplicados com sucesso`);
      }
    });

    // Always log post-apply counts for debug terminal
    try {
      const clientesCount = await this.getFirstAsync<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM clientes WHERE deletedAt IS NULL`, []
      );
      const produtosCount = await this.getFirstAsync<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM produtos WHERE deletedAt IS NULL`, []
      );
      const locacoesCount = await this.getFirstAsync<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM locacoes WHERE deletedAt IS NULL`, []
      );
      const cobrancasCount = await this.getFirstAsync<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM cobrancas WHERE deletedAt IS NULL`, []
      );
      const rotasCount = await this.getFirstAsync<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM rotas WHERE deletedAt IS NULL`, []
      );
      logger.info(`[Database] Mudanças remotas aplicadas — clientes: ${clientesCount?.cnt || 0}, produtos: ${produtosCount?.cnt || 0}, locações: ${locacoesCount?.cnt || 0}, cobranças: ${cobrancasCount?.cnt || 0}, rotas: ${rotasCount?.cnt || 0}`);
    } catch (countErr) {
      logger.warn('[Database] Mudanças remotas aplicadas (não foi possível contar registros)');
    }
  }

  /**
   * Upsert de entidade recebida do servidor (SEM criar ChangeLog)
   *
   * IMPORTANTE:
   * 1. Verifica existência SEM o filtro deletedAt IS NULL,
   *    pois o servidor pode enviar um registro que foi reativado
   *    (localmente soft-deletado mas ativo no servidor).
   * 2. Filtra campos usando PRAGMA table_info para evitar erros
   *    "table has no column named X" que causam rollback total.
   * 3. NÃO faz throw em caso de erro — apenas loga. Isso evita que
   *    um registro com problema cause rollback de TODOS os dados do sync.
   */
  private async upsertFromSync(entityType: EntityType, entity: any): Promise<boolean> {
    if (!this.db) {
      logger.error('[Database] upsertFromSync: banco não inicializado');
      return false;
    }

    const tableName = this.getTableName(entityType);
    if (!tableName) {
      logger.error(`[Database] upsertFromSync: tabela não encontrada para entityType "${entityType}"`);
      return false;
    }

    // Preparar dados
    const data = { ...entity };
    delete data.id;

    // CORREÇÃO: Filtrar campos que não existem na tabela SQLite local.
    // Isso previne erros "table has no column named X" que causariam
    // rollback de TODA a transação de applyRemoteChanges.
    const filteredData = await this.filterColumnsForTable(tableName, data);

    // Garantir que deletedAt seja null (não string "null") se o registro está ativo
    if (filteredData.deletedAt === undefined || filteredData.deletedAt === null) {
      filteredData.deletedAt = null;
    }

    // Verificar se o registro existe NO BANCO (sem filtro de deletedAt).
    let existing: any = null;
    try {
      existing = await this.db.getFirstAsync(
        `SELECT id, deletedAt FROM ${tableName} WHERE id = ?`,
        [entity.id]
      );
    } catch {
      // Tabela pode não ter id — ignorar e tentar INSERT
    }

    try {
      const serialized = serializeForDB(filteredData);
      const fields = Object.keys(serialized);

      if (fields.length === 0) {
        logger.warn(`[Database] upsertFromSync: nenhum campo válido para ${entityType}:${entity.id}`);
        return false;
      }

      if (existing) {
        // UPDATE
        const setClause = fields.map((field) => `${field} = ?`).join(', ');
        const values = fields.map((field) => serialized[field]);

        await this.db.runAsync(
          `UPDATE ${tableName} SET ${setClause} WHERE id = ?`,
          [...values, entity.id]
        );
      } else {
        // INSERT
        const placeholders = fields.map(() => '?').join(', ');
        const values = fields.map((field) => serialized[field]);

        await this.db.runAsync(
          `INSERT INTO ${tableName} (id, ${fields.join(', ')}) VALUES (?, ${placeholders})`,
          [entity.id, ...values]
        );
      }
      return true;
    } catch (error: any) {
      // CORREÇÃO CRÍTICA: NÃO fazer throw! Se este registro falhar,
      // logar o erro mas continuar processando os outros. Se fizermos
      // throw, a transação inteira de applyRemoteChanges faz rollback
      // e TODOS os dados do sync são perdidos.
      const errMsg = error?.message || String(error);
      logger.error(`[Database] ❌ ERRO ao salvar ${entityType}:${entity.id}: ${errMsg}`);
      logger.error(`[Database] Campos enviados: ${Object.keys(filteredData).join(', ')}`);
      return false;
    }
  }



  /**
   * Remove entradas do ChangeLog sincronizadas há mais de N dias.
   * Chame após sync para evitar crescimento infinito.
   */
  async purgeOldChangeLogs(diasRetencao: number = 30): Promise<number> {
    if (!this.db) return 0;
    const limite = new Date();
    limite.setDate(limite.getDate() - diasRetencao);
    try {
      const result = await this.db.runAsync(
        `DELETE FROM ${TABLES.CHANGE_LOG} WHERE synced = 1 AND syncedAt < ?`,
        [limite.toISOString()]
      );
      const count = result.changes ?? 0;
      if (count > 0) console.log(`[Database] Purge: ${count} changelogs removidos`);
      return count;
    } catch (error) {
      console.error('[Database] Erro no purge:', error);
      return 0;
    }
  }

  /**
   * Reconcilia IDs temporários (tmp_xxx) criados offline com UUIDs reais vindos do servidor.
   * Executado automaticamente após cada pull de atributos.
   *
   * Fluxo:
   *   1. Mobile cria tipo offline → tipoId = 'tmp_xxx', tipoNome = 'Snooker'
   *   2. Servidor cria o mesmo tipo com UUID real
   *   3. No pull, servidor envia { id: 'uuid-real', nome: 'Snooker' }
   *   4. Este método detecta o tmp_ pelo nome, migra referências e remove o tmp_
   */
  async reconciliarAtributosTemporarios(): Promise<void> {
    if (!this.db) return;
    try {
      // Para cada tabela de atributos, encontrar pares (tmp_, nome) e (uuid, nome)
      const tabelas = [
        { tabela: TABLES.TIPOS_PRODUTO,    colProduto: 'tipoId',      colNome: 'tipoNome'      },
        { tabela: TABLES.DESCRICOES_PRODUTO, colProduto: 'descricaoId', colNome: 'descricaoNome' },
        { tabela: TABLES.TAMANHOS_PRODUTO,  colProduto: 'tamanhoId',   colNome: 'tamanhoNome'   },
      ];

      for (const { tabela, colProduto, colNome } of tabelas) {
        // Encontrar todos os IDs temporários nesta tabela
        const tmps = await this.db.getAllAsync<{ id: string; nome: string }>(
          `SELECT id, nome FROM ${tabela} WHERE id LIKE 'tmp_%' OR id LIKE 'novo_%'`,
          []
        );
        if (tmps.length === 0) continue;

        for (const tmp of tmps) {
          // Procurar se já existe um UUID real com o mesmo nome
          const server = await this.db.getFirstAsync<{ id: string }>(
            `SELECT id FROM ${tabela}
             WHERE nome = ?
               AND id NOT LIKE 'tmp_%'
               AND id NOT LIKE 'novo_%'
             LIMIT 1`,
            [tmp.nome]
          );
          if (!server) continue; // Ainda não sincronizou — aguardar

          // Migrar referências em produtos
          await this.db.runAsync(
            `UPDATE ${TABLES.PRODUTOS} SET ${colProduto} = ? WHERE ${colProduto} = ?`,
            [server.id, tmp.id]
          );
          // Atualizar o nome caso tenha mudado
          await this.db.runAsync(
            `UPDATE ${TABLES.PRODUTOS} SET ${colNome} = (
               SELECT nome FROM ${tabela} WHERE id = ?
             ) WHERE ${colProduto} = ?`,
            [server.id, server.id]
          );
          // Remover o registro temporário
          await this.db.runAsync(
            `DELETE FROM ${tabela} WHERE id = ?`,
            [tmp.id]
          );

          console.log(
            `[Database] Reconciliado atributo temporário: ${tmp.id} → ${server.id} (nome: "${tmp.nome}")`
          );
        }
      }
    } catch (error) {
      console.error('[Database] Erro na reconciliação de IDs temporários:', error);
    }
  }

  /**
   * Upsert de tipo de produto (SEM criar ChangeLog)
   */
  private async upsertTipoProdutoFromSync(tipo: any): Promise<void> {
    if (!this.db) return;
    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.TIPOS_PRODUTO} (id, nome, syncStatus, lastSyncedAt, needsSync, version, deviceId, createdAt, updatedAt, deletedAt)
         VALUES (?, ?, 'synced', ?, 0, ?, ?, ?, ?, ?)`,
        [tipo.id, tipo.nome, tipo.lastSyncedAt || new Date().toISOString(), tipo.version || 1, tipo.deviceId || '', tipo.createdAt || new Date().toISOString(), tipo.updatedAt || new Date().toISOString(), tipo.deletedAt || null]
      );
    } catch (error: any) {
      logger.error(`[Database] Erro upsertTipoProduto ${tipo.id}: ${error?.message || error}`);
    }
  }

  /**
   * Upsert de descrição de produto (SEM criar ChangeLog)
   */
  private async upsertDescricaoProdutoFromSync(desc: any): Promise<void> {
    if (!this.db) return;
    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.DESCRICOES_PRODUTO} (id, nome, syncStatus, lastSyncedAt, needsSync, version, deviceId, createdAt, updatedAt, deletedAt)
         VALUES (?, ?, 'synced', ?, 0, ?, ?, ?, ?, ?)`,
        [desc.id, desc.nome, desc.lastSyncedAt || new Date().toISOString(), desc.version || 1, desc.deviceId || '', desc.createdAt || new Date().toISOString(), desc.updatedAt || new Date().toISOString(), desc.deletedAt || null]
      );
    } catch (error: any) {
      logger.error(`[Database] Erro upsertDescricaoProduto ${desc.id}: ${error?.message || error}`);
    }
  }

  /**
   * Upsert de tamanho de produto (SEM criar ChangeLog)
   */
  private async upsertTamanhoProdutoFromSync(tam: any): Promise<void> {
    if (!this.db) return;
    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.TAMANHOS_PRODUTO} (id, nome, syncStatus, lastSyncedAt, needsSync, version, deviceId, createdAt, updatedAt, deletedAt)
         VALUES (?, ?, 'synced', ?, 0, ?, ?, ?, ?, ?)`,
        [tam.id, tam.nome, tam.lastSyncedAt || new Date().toISOString(), tam.version || 1, tam.deviceId || '', tam.createdAt || new Date().toISOString(), tam.updatedAt || new Date().toISOString(), tam.deletedAt || null]
      );
    } catch (error: any) {
      logger.error(`[Database] Erro upsertTamanhoProduto ${tam.id}: ${error?.message || error}`);
    }
  }

  /**
   * Upsert de estabelecimento recebido do servidor (SEM criar ChangeLog)
   */
  private async upsertEstabelecimentoFromSync(est: any): Promise<void> {
    if (!this.db) return;
    try {
      const existing = await this.getById<any>('estabelecimento' as EntityType, est.id);
      const now = new Date().toISOString();

      if (existing) {
        const serialized = serializeForDB({
          nome: est.nome,
          endereco: est.endereco || null,
          observacao: est.observacao || null,
          syncStatus: 'synced',
          lastSyncedAt: est.lastSyncedAt || now,
          needsSync: 0,
          version: est.version || 1,
          deviceId: est.deviceId || '',
          updatedAt: est.updatedAt || now,
          deletedAt: est.deletedAt || null,
        });
        const fields = Object.keys(serialized);
        const setClause = fields.map((field) => `${field} = ?`).join(', ');
        const values = fields.map((field) => serialized[field]);

        await this.db.runAsync(
          `UPDATE ${TABLES.ESTABELECIMENTOS} SET ${setClause} WHERE id = ?`,
          [...values, est.id]
        );
      } else {
        await this.db.runAsync(
          `INSERT INTO ${TABLES.ESTABELECIMENTOS}
           (id, nome, endereco, observacao, syncStatus, lastSyncedAt, needsSync, version, deviceId, createdAt, updatedAt, deletedAt)
           VALUES (?, ?, ?, ?, 'synced', ?, 0, ?, ?, ?, ?, ?)`,
          [
            est.id,
            est.nome,
            est.endereco || null,
            est.observacao || null,
            est.lastSyncedAt || now,
            est.version || 1,
            est.deviceId || '',
            est.createdAt || now,
            est.updatedAt || now,
            est.deletedAt || null,
          ]
        );
      }
    } catch (error: any) {
      logger.error(`[Database] Erro upsertEstabelecimento ${est.id}: ${error?.message || error}`);
    }
  }

  /**
   * Upsert de historico_relogio recebido do servidor (SEM criar ChangeLog)
   */
  private async upsertHistoricoRelogioFromSync(hr: any): Promise<void> {
    if (!this.db) return;
    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.HISTORICO_RELOGIO} (id, produtoId, relogioAnterior, relogioNovo, motivo, dataAlteracao, usuarioResponsavel, needsSync)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [hr.id, hr.produtoId, hr.relogioAnterior, hr.relogioNovo, hr.motivo, hr.dataAlteracao, hr.usuarioResponsavel]
      );
    } catch (error: any) {
      logger.error(`[Database] Erro upsertHistoricoRelogio ${hr.id}: ${error?.message || error}`);
    }
  }

  /**
   * Upsert de usuário recebido do servidor (SEM criar ChangeLog)
   * Sincroniza permissões alteradas no web para o mobile.
   *
   * BUG FIX: Usa UPDATE + INSERT separados em vez de INSERT OR REPLACE.
   * O servidor NÃO envia o campo `senha` por segurança, e o INSERT OR REPLACE
   * sobrescrevia a senha local com ''/null, impedindo login offline.
   * Agora, no UPDATE, a senha local é preservada se o servidor não enviá-la.
   */
  private async upsertUsuarioFromSync(usuario: any): Promise<void> {
    if (!this.db) return;

    try {
    // Converter objetos JSON para string
    const permissoesWeb = typeof usuario.permissoesWeb === 'object'
      ? JSON.stringify(usuario.permissoesWeb)
      : usuario.permissoesWeb || '{}';
    const permissoesMobile = typeof usuario.permissoesMobile === 'object'
      ? JSON.stringify(usuario.permissoesMobile)
      : usuario.permissoesMobile || '{}';
    const rotasPermitidas = typeof usuario.rotasPermitidas === 'object'
      ? JSON.stringify(usuario.rotasPermitidas)
      : usuario.rotasPermitidas || '[]';

    const existing = await this.getById<any>('usuario', usuario.id);

    if (existing) {
      // UPDATE — preservar senha local se o servidor não enviou
      const updateData: Record<string, unknown> = {
        tipo: usuario.tipo || 'usuario',
        nome: usuario.nome,
        cpf: usuario.cpf || null,
        telefone: usuario.telefone || null,
        email: usuario.email,
        tipoPermissao: usuario.tipoPermissao,
        permissoesWeb,
        permissoesMobile,
        rotasPermitidas,
        status: usuario.status || 'Ativo',
        bloqueado: usuario.bloqueado ? 1 : 0,
        dataUltimoAcesso: usuario.dataUltimoAcesso || null,
        ultimoAcessoDispositivo: usuario.ultimoAcessoDispositivo || null,
        syncStatus: 'synced',
        lastSyncedAt: usuario.lastSyncedAt || new Date().toISOString(),
        needsSync: 0,
        version: usuario.version || 1,
        deviceId: usuario.deviceId || '',
        updatedAt: usuario.updatedAt || new Date().toISOString(),
        deletedAt: usuario.deletedAt || null,
      };

      // Preservar senha local se o servidor não enviou (segurança)
      if (usuario.senha) {
        updateData.senha = usuario.senha;
      }
      // else: keep existing senha — NOT overwriting with empty

      const serialized = serializeForDB(updateData);
      const fields = Object.keys(serialized);
      const setClause = fields.map((field) => `${field} = ?`).join(', ');
      const values = fields.map((field) => serialized[field]);

      await this.db.runAsync(
        `UPDATE ${TABLES.USUARIOS} SET ${setClause} WHERE id = ?`,
        [...values, usuario.id]
      );
    } else {
      // INSERT — novo usuário vindo do servidor
      // Se não tem senha, vazio (usuário precisará redefinir ou será autenticado via token)
      await this.db.runAsync(
        `INSERT INTO ${TABLES.USUARIOS}
         (id, tipo, nome, cpf, telefone, email, senha, tipoPermissao, permissoesWeb, permissoesMobile, rotasPermitidas, status, bloqueado, dataUltimoAcesso, ultimoAcessoDispositivo, syncStatus, lastSyncedAt, needsSync, version, deviceId, createdAt, updatedAt, deletedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, 0, ?, ?, ?, ?, ?)`,
        [
          usuario.id,
          usuario.tipo || 'usuario',
          usuario.nome,
          usuario.cpf || null,
          usuario.telefone || null,
          usuario.email,
          usuario.senha || '',
          usuario.tipoPermissao,
          permissoesWeb,
          permissoesMobile,
          rotasPermitidas,
          usuario.status || 'Ativo',
          usuario.bloqueado ? 1 : 0,
          usuario.dataUltimoAcesso || null,
          usuario.ultimoAcessoDispositivo || null,
          usuario.lastSyncedAt || new Date().toISOString(),
          usuario.version || 1,
          usuario.deviceId || '',
          usuario.createdAt || new Date().toISOString(),
          usuario.updatedAt || new Date().toISOString(),
          usuario.deletedAt || null,
        ]
      );
    }
    } catch (error: any) {
      logger.error(`[Database] Erro upsertUsuario ${usuario.id}: ${error?.message || error}`);
    }
  }

  // ==========================================================================
  // METADATA E UTILITÁRIOS
  // ==========================================================================

  /**
   * Upsert de manutenção recebida do servidor (SEM criar ChangeLog)
   */
  private async upsertManutencaoFromSync(manutencao: any): Promise<void> {
    if (!this.db) return;

    try {
    const existing = await this.getById<any>('manutencao' as EntityType, manutencao.id);
    const now = new Date().toISOString();

    if (existing) {
      // UPDATE
      const serialized = serializeForDB({
        produtoId: manutencao.produtoId,
        produtoIdentificador: manutencao.produtoIdentificador || null,
        produtoTipo: manutencao.produtoTipo || null,
        clienteId: manutencao.clienteId || null,
        clienteNome: manutencao.clienteNome || null,
        locacaoId: manutencao.locacaoId || null,
        cobrancaId: manutencao.cobrancaId || null,
        tipo: manutencao.tipo,
        descricao: manutencao.descricao || null,
        data: manutencao.data,
        registradoPor: manutencao.registradoPor || null,
        syncStatus: 'synced',
        lastSyncedAt: manutencao.lastSyncedAt || now,
        needsSync: 0,
        version: manutencao.version || 1,
        deviceId: manutencao.deviceId || '',
        updatedAt: manutencao.updatedAt || now,
        deletedAt: manutencao.deletedAt || null,
      });
      const fields = Object.keys(serialized);
      const setClause = fields.map((field) => `${field} = ?`).join(', ');
      const values = fields.map((field) => serialized[field]);

      await this.db.runAsync(
        `UPDATE ${TABLES.MANUTENCOES} SET ${setClause} WHERE id = ?`,
        [...values, manutencao.id]
      );
    } else {
      // INSERT
      await this.db.runAsync(
        `INSERT INTO ${TABLES.MANUTENCOES}
         (id, produtoId, produtoIdentificador, produtoTipo, clienteId, clienteNome, locacaoId, cobrancaId, tipo, descricao, data, registradoPor, syncStatus, lastSyncedAt, needsSync, version, deviceId, createdAt, updatedAt, deletedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, 0, ?, ?, ?, ?, ?)`,
        [
          manutencao.id,
          manutencao.produtoId,
          manutencao.produtoIdentificador || null,
          manutencao.produtoTipo || null,
          manutencao.clienteId || null,
          manutencao.clienteNome || null,
          manutencao.locacaoId || null,
          manutencao.cobrancaId || null,
          manutencao.tipo,
          manutencao.descricao || null,
          manutencao.data,
          manutencao.registradoPor || null,
          manutencao.lastSyncedAt || now,
          manutencao.version || 1,
          manutencao.deviceId || '',
          manutencao.createdAt || now,
          manutencao.updatedAt || now,
          manutencao.deletedAt || null,
        ]
      );
    }
    } catch (error: any) {
      logger.error(`[Database] Erro upsertManutencao ${manutencao.id}: ${error?.message || error}`);
    }
  }

  /**
   * Upsert de meta recebida do servidor (SEM criar ChangeLog)
   */
  private async upsertMetaFromSync(meta: any): Promise<void> {
    if (!this.db) return;

    try {
    const existing = await this.getById<any>('meta' as EntityType, meta.id);
    const now = new Date().toISOString();

    if (existing) {
      // UPDATE
      const serialized = serializeForDB({
        nome: meta.nome,
        tipo: meta.tipo || 'receita',
        valorMeta: meta.valorMeta,
        valorAtual: meta.valorAtual || 0,
        dataInicio: meta.dataInicio,
        dataFim: meta.dataFim,
        rotaId: meta.rotaId || null,
        status: meta.status || 'ativa',
        criadoPor: meta.criadoPor || null,
        syncStatus: 'synced',
        lastSyncedAt: meta.lastSyncedAt || now,
        needsSync: 0,
        version: meta.version || 1,
        deviceId: meta.deviceId || '',
        updatedAt: meta.updatedAt || now,
        deletedAt: meta.deletedAt || null,
      });
      const fields = Object.keys(serialized);
      const setClause = fields.map((field) => `${field} = ?`).join(', ');
      const values = fields.map((field) => serialized[field]);

      await this.db.runAsync(
        `UPDATE ${TABLES.METAS} SET ${setClause} WHERE id = ?`,
        [...values, meta.id]
      );
    } else {
      // INSERT
      await this.db.runAsync(
        `INSERT INTO ${TABLES.METAS}
         (id, nome, tipo, valorMeta, valorAtual, dataInicio, dataFim, rotaId, status, criadoPor, syncStatus, lastSyncedAt, needsSync, version, deviceId, createdAt, updatedAt, deletedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, 0, ?, ?, ?, ?, ?)`,
        [
          meta.id,
          meta.nome,
          meta.tipo || 'receita',
          meta.valorMeta,
          meta.valorAtual || 0,
          meta.dataInicio,
          meta.dataFim,
          meta.rotaId || null,
          meta.status || 'ativa',
          meta.criadoPor || null,
          meta.lastSyncedAt || now,
          meta.version || 1,
          meta.deviceId || '',
          meta.createdAt || now,
          meta.updatedAt || now,
          meta.deletedAt || null,
        ]
      );
    }
    } catch (error: any) {
      logger.error(`[Database] Erro upsertMeta ${meta.id}: ${error?.message || error}`);
    }
  }

  // ==========================================================================
  // METADATA E UTILITÁRIOS
  // ==========================================================================

  /**
   * Busca metadata de sincronização
   */
  async getSyncMetadata(): Promise<SyncMetadata> {
    if (!this.db) throw new Error('Database não inicializado');

    try {
      const results = await this.db.getAllAsync<{ key: string; value: string }>(
        `SELECT * FROM ${TABLES.SYNC_METADATA}`
      );

      const metadata: any = {};
      for (const row of results || []) {
        try {
          metadata[row.key] = JSON.parse(row.value);
        } catch {
          metadata[row.key] = row.value;
      
  }
    
  }

      return metadata as SyncMetadata;
    } catch (error) {
      console.error('[Database] Erro ao buscar metadata:', error);
      throw error;
  
  }

  }
  /**
   * Atualiza metadata de sincronização
   */
  async updateSyncMetadata(metadata: Partial<SyncMetadata>): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');

    for (const [key, value] of Object.entries(metadata)) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.SYNC_METADATA} (key, value) VALUES (?, ?)`,
        [key, typeof value === 'object' ? JSON.stringify(value) : String(value)]
      );
  
  }

  }

  /**
   * Busca ID do dispositivo
   */
  async getDeviceId(): Promise<string> {
    const metadata = await this.getSyncMetadata();
    return metadata.deviceId || '';

  }

  /**
   * Define ID do dispositivo
   */
  async setDeviceId(deviceId: string, deviceName: string, deviceKey: string, chave?: string): Promise<void> {
    const update: Partial<SyncMetadata> = {
      deviceId,
      deviceName,
      deviceKey,
    };
    if (chave) {
      update.chave = chave;
    }
    await this.updateSyncMetadata(update);
  }

  // ==========================================================================
  // MÉTODOS DE QUERY DIRETA (RAW SQL)
  // ==========================================================================

  /**
   * Executa uma query SQL direta e retorna todos os resultados
   * Use com cuidado - prefira os métodos CRUD genéricos quando possível
   */
  async getAllAsync<T>(query: string, params: any[] = []): Promise<T[]> {
    if (!this.isReady()) {
      await this.waitForReady();
    }
    if (!this.db) throw new Error('Database não inicializado');

    try {
      const results = await this.db.getAllAsync<T>(query, params);
      return results || [];
    } catch (error) {
      console.error('[Database] Erro na query:', query, error);
      return [];
    }
  }

  /**
   * Executa uma query SQL direta e retorna o primeiro resultado
   */
  async getFirstAsync<T>(query: string, params: any[] = []): Promise<T | null> {
    if (!this.isReady()) {
      await this.waitForReady();
    }
    if (!this.db) throw new Error('Database não inicializado');

    try {
      const result = await this.db.getFirstAsync<T>(query, params);
      return result || null;
    } catch (error) {
      console.error('[Database] Erro na query:', query, error);
      return null;
    }
  }

  /**
   * Executa uma query SQL de escrita (INSERT, UPDATE, DELETE)
   */
  async runAsync(query: string, params: any[] = []): Promise<SQLite.SQLiteRunResult> {
    if (!this.isReady()) {
      await this.waitForReady();
    }
    if (!this.db) throw new Error('Database não inicializado');

    try {
      return await this.db.runAsync(query, params);
    } catch (error) {
      console.error('[Database] Erro na execução:', query, error);
      throw error;
    }
  }

  // ==========================================================================
  // TRANSACÇÕES E BATCH
  // ==========================================================================

  /**
   * Executa operações em transação
   */
  async runTransaction(operations: () => Promise<void>): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');

    try {
      await this.db.withTransactionAsync(operations);
    } catch (error) {
      console.error('[Database] Erro na transação:', error);
      throw error;
  
  }

  }
  /**
   * Salva múltiplas entidades em batch
   */
  async batchSave(
    entities: Array<{ entityType: EntityType; data: SyncableEntity }>
  ): Promise<void> {
    await this.runTransaction(async () => {
      for (const { entityType, data } of entities) {
        await this.save(entityType, data);
    
  }
    });

  }

  // ==========================================================================
  // MÉTODOS AUXILIARES PRIVADOS
  // ==========================================================================

  private getTableName(entityType: EntityType): string {
    const tableMap: Record<EntityType, string> = {
      cliente: TABLES.CLIENTES,
      produto: TABLES.PRODUTOS,
      locacao: TABLES.LOCACOES,
      cobranca: TABLES.COBRANCAS,
      rota: TABLES.ROTAS,
      usuario: TABLES.USUARIOS,
      manutencao: TABLES.MANUTENCOES,
      meta: TABLES.METAS,
      historicoRelogio: TABLES.HISTORICO_RELOGIO,
      tipoProduto: TABLES.TIPOS_PRODUTO,
      descricaoProduto: TABLES.DESCRICOES_PRODUTO,
      tamanhoProduto: TABLES.TAMANHOS_PRODUTO,
      estabelecimento: TABLES.ESTABELECIMENTOS,
    };

    return tableMap[entityType];

  }

  /**
   * Verifica se a tabela do EntityType possui coluna deletedAt (soft delete).
   * Tabelas de metadata (change_log, sync_metadata) NÃO são EntityType,
   * mas historicoRelogio pode não ter a coluna antes da migration.
   * Sempre retorna true após a migration rodar.
   */
  private hasSoftDelete(entityType: EntityType): boolean {
    // Todas as tabelas mapeadas por EntityType têm deletedAt após a migration.
    // As únicas tabelas SEM deletedAt são change_log e sync_metadata,
    // que não são acessadas via EntityType.
    return true;
  }

  private getUpdateFields(entity: any): string {
    const fields = Object.keys(entity).filter(
      (key) => key !== 'id' && key !== 'createdAt'
    );
    return fields.map((field) => `${field} = ?`).join(', ');

  }

  private async insert(tableName: string, entity: any): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');

    const serialized = serializeForDB(entity);
    const fields = Object.keys(serialized);
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map((field) => serialized[field]);

    await this.db.runAsync(
      `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`,
      values as any[]
    );

  }
  /**
   * Limpa todos os dados locais (útil para logout ou reset)
   */
  async clearLocalData(): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');

    const tables = Object.values(TABLES).filter(table => table !== TABLES.SYNC_METADATA);

    await this.runTransaction(async () => {
      for (const table of tables) {
        await this.db!.runAsync(`DELETE FROM ${table}`);
    
  }
    });

    console.log('[Database] Dados locais limpos');

  }

  /**
   * Fecha conexão com o banco
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      this.isInitialized = false;
      console.log('[Database] Banco fechado');
  
  }

  }

  // ==========================================================================
  // MÉTODOS PARA ATRIBUTOS DE PRODUTO (Tipos, Descrições, Tamanhos)
  // ==========================================================================

  /**
   * Busca todos os tipos de produto
   */
  async getTiposProduto(): Promise<Array<{id: string, nome: string}>> {
    if (!this.isReady()) {
      await this.waitForReady();
    }
    if (!this.db) throw new Error('Database não inicializado');
    try {
      const results = await this.db.getAllAsync<{id: string, nome: string}>(
        `SELECT id, nome FROM ${TABLES.TIPOS_PRODUTO} WHERE deletedAt IS NULL ORDER BY nome`
      );
      return results || [];
    } catch (error) {
      console.error('[Database] Erro ao buscar tipos:', error);
      return [];
    }
  }

  /**
   * Busca todas as descrições de produto
   */
  async getDescricoesProduto(): Promise<Array<{id: string, nome: string}>> {
    if (!this.db) throw new Error('Database não inicializado');
    try {
      const results = await this.db.getAllAsync<{id: string, nome: string}>(
        `SELECT id, nome FROM ${TABLES.DESCRICOES_PRODUTO} WHERE deletedAt IS NULL ORDER BY nome`
      );
      return results || [];
    } catch (error) {
      console.error('[Database] Erro ao buscar descrições:', error);
      return [];
    }
  }

  /**
   * Busca todos os tamanhos de produto
   */
  async getTamanhosProduto(): Promise<Array<{id: string, nome: string}>> {
    if (!this.db) throw new Error('Database não inicializado');
    try {
      const results = await this.db.getAllAsync<{id: string, nome: string}>(
        `SELECT id, nome FROM ${TABLES.TAMANHOS_PRODUTO} WHERE deletedAt IS NULL ORDER BY nome`
      );
      return results || [];
    } catch (error) {
      console.error('[Database] Erro ao buscar tamanhos:', error);
      return [];
    }
  }

  /**
   * Salva tipo de produto
   */
  async saveTipoProduto(id: string, nome: string): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');
    const now = new Date().toISOString();
    const deviceId = await this.getDeviceId();

    // Check if this is a create or update
    const existing = await this.db.getFirstAsync<any>(
      `SELECT id FROM ${TABLES.TIPOS_PRODUTO} WHERE id = ?`, [id]
    );
    const operation = existing ? 'update' : 'create';

    await this.db.runAsync(
      `INSERT OR REPLACE INTO ${TABLES.TIPOS_PRODUTO} (id, nome, updatedAt, needsSync) VALUES (?, ?, ?, 1)`,
      [id, nome.trim(), now]
    );

    // Register change_log entry for PUSH pipeline
    await this.logChange({
      id: `tipoProduto_${id}_${now}`,
      entityId: id,
      entityType: 'tipoProduto',
      operation,
      changes: { id, nome: nome.trim() },
      timestamp: now,
      deviceId,
      synced: false,
    });

    console.log('[Database] Tipo de produto salvo:', nome);
  }

  /**
   * Salva descrição de produto
   */
  async saveDescricaoProduto(id: string, nome: string): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');
    const now = new Date().toISOString();
    const deviceId = await this.getDeviceId();

    const existing = await this.db.getFirstAsync<any>(
      `SELECT id FROM ${TABLES.DESCRICOES_PRODUTO} WHERE id = ?`, [id]
    );
    const operation = existing ? 'update' : 'create';

    await this.db.runAsync(
      `INSERT OR REPLACE INTO ${TABLES.DESCRICOES_PRODUTO} (id, nome, updatedAt, needsSync) VALUES (?, ?, ?, 1)`,
      [id, nome.trim(), now]
    );

    // Register change_log entry for PUSH pipeline
    await this.logChange({
      id: `descricaoProduto_${id}_${now}`,
      entityId: id,
      entityType: 'descricaoProduto',
      operation,
      changes: { id, nome: nome.trim() },
      timestamp: now,
      deviceId,
      synced: false,
    });

    console.log('[Database] Descrição de produto salva:', nome);
  }

  /**
   * Salva tamanho de produto
   */
  async saveTamanhoProduto(id: string, nome: string): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');
    const now = new Date().toISOString();
    const deviceId = await this.getDeviceId();

    const existing = await this.db.getFirstAsync<any>(
      `SELECT id FROM ${TABLES.TAMANHOS_PRODUTO} WHERE id = ?`, [id]
    );
    const operation = existing ? 'update' : 'create';

    await this.db.runAsync(
      `INSERT OR REPLACE INTO ${TABLES.TAMANHOS_PRODUTO} (id, nome, updatedAt, needsSync) VALUES (?, ?, ?, 1)`,
      [id, nome.trim(), now]
    );

    // Register change_log entry for PUSH pipeline
    await this.logChange({
      id: `tamanhoProduto_${id}_${now}`,
      entityId: id,
      entityType: 'tamanhoProduto',
      operation,
      changes: { id, nome: nome.trim() },
      timestamp: now,
      deviceId,
      synced: false,
    });

    console.log('[Database] Tamanho de produto salvo:', nome);
  }

  /**
   * Remove tipo de produto (soft delete)
   */
  async deleteTipoProduto(id: string): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');
    const now = new Date().toISOString();
    await this.db.runAsync(
      `UPDATE ${TABLES.TIPOS_PRODUTO} SET deletedAt = ?, needsSync = 1 WHERE id = ?`,
      [now, id]
    );

    // Register change_log entry for PUSH pipeline
    await this.logChange({
      id: `tipoProduto_${id}_${now}`,
      entityId: id,
      entityType: 'tipoProduto',
      operation: 'delete',
      changes: { id, deletedAt: now },
      timestamp: now,
      deviceId: await this.getDeviceId(),
      synced: false,
    });

    console.log('[Database] Tipo de produto removido:', id);
  }

  /**
   * Remove descrição de produto (soft delete)
   */
  async deleteDescricaoProduto(id: string): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');
    const now = new Date().toISOString();
    await this.db.runAsync(
      `UPDATE ${TABLES.DESCRICOES_PRODUTO} SET deletedAt = ?, needsSync = 1 WHERE id = ?`,
      [now, id]
    );

    // Register change_log entry for PUSH pipeline
    await this.logChange({
      id: `descricaoProduto_${id}_${now}`,
      entityId: id,
      entityType: 'descricaoProduto',
      operation: 'delete',
      changes: { id, deletedAt: now },
      timestamp: now,
      deviceId: await this.getDeviceId(),
      synced: false,
    });

    console.log('[Database] Descrição de produto removida:', id);
  }

  /**
   * Remove tamanho de produto (soft delete)
   */
  async deleteTamanhoProduto(id: string): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');
    const now = new Date().toISOString();
    await this.db.runAsync(
      `UPDATE ${TABLES.TAMANHOS_PRODUTO} SET deletedAt = ?, needsSync = 1 WHERE id = ?`,
      [now, id]
    );

    // Register change_log entry for PUSH pipeline
    await this.logChange({
      id: `tamanhoProduto_${id}_${now}`,
      entityId: id,
      entityType: 'tamanhoProduto',
      operation: 'delete',
      changes: { id, deletedAt: now },
      timestamp: now,
      deviceId: await this.getDeviceId(),
      synced: false,
    });

    console.log('[Database] Tamanho de produto removido:', id);
  }

  // ── MANUTENÇÕES ──────────────────────────────────────────────────────────

  async saveManutencao(registro: {
    id: string;
    produtoId: string;
    produtoIdentificador?: string;
    produtoTipo?: string;
    clienteId?: string;
    clienteNome?: string;
    locacaoId?: string;
    cobrancaId?: string;
    tipo: string;
    descricao?: string;
    data: string;
    registradoPor?: string;
    syncStatus?: string;
    lastSyncedAt?: string;
    needsSync?: boolean | number;
    version?: number;
    deviceId?: string;
    createdAt?: string;
    updatedAt?: string;
  }): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');
    const now = new Date().toISOString();
    await this.db.runAsync(
      `INSERT OR REPLACE INTO manutencoes
        (id, produtoId, produtoIdentificador, produtoTipo, clienteId, clienteNome,
         locacaoId, cobrancaId, tipo, descricao, data, registradoPor,
         syncStatus, lastSyncedAt, needsSync, version, deviceId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [registro.id, registro.produtoId, registro.produtoIdentificador || null, registro.produtoTipo || null,
       registro.clienteId || null, registro.clienteNome || null,
       registro.locacaoId || null, registro.cobrancaId || null,
       registro.tipo, registro.descricao || null, registro.data,
       registro.registradoPor || null,
       registro.syncStatus || 'pending', registro.lastSyncedAt || null,
       registro.needsSync ? 1 : 0, registro.version || 1,
       registro.deviceId || '', registro.createdAt || now, registro.updatedAt || now]
    );
  }

  async getManutencoes(filters?: {
    produtoId?: string;
    tipo?: string;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<any[]> {
    if (!this.db) throw new Error('Database não inicializado');
    let query = `SELECT * FROM manutencoes WHERE deletedAt IS NULL`;
    const params: any[] = [];
    if (filters?.produtoId) { query += ` AND produtoId = ?`; params.push(filters.produtoId); }
    if (filters?.tipo)      { query += ` AND tipo = ?`;      params.push(filters.tipo); }
    if (filters?.dataInicio){ query += ` AND data >= ?`;     params.push(filters.dataInicio); }
    if (filters?.dataFim)   { query += ` AND data <= ?`;     params.push(filters.dataFim); }
    query += ` ORDER BY data DESC`;
    return await this.db.getAllAsync(query, params);
  }

  // ── RELATÓRIOS ───────────────────────────────────────────────────────────

  async getResumoFinanceiro(dataInicio?: string, dataFim?: string): Promise<{
    totalArrecadado: number;
    totalClientePaga: number;
    totalDesconto: number;
    totalSaldoDevedor: number;
    totalCobrancas: number;
  }> {
    if (!this.db) throw new Error('Database não inicializado');
    
    // Para valores recebidos, usamos a data de criação/atualização da cobrança
    // pois dataPagamento só é preenchido quando status = 'Pago'
    // Mas o valorRecebido é registrado no momento da cobrança
    let where = `deletedAt IS NULL AND valorRecebido > 0`;
    const params: any[] = [];
    
    // Usar createdAt para filtrar por período (quando a cobrança foi feita)
    if (dataInicio) { where += ` AND DATE(createdAt) >= DATE(?)`; params.push(dataInicio); }
    if (dataFim)    { where += ` AND DATE(createdAt) <= DATE(?)`; params.push(dataFim); }

    // Total arrecadado = valor recebido (dinheiro que entrou)
    // totalClientePaga = valor que o cliente deveria pagar (incluindo saldo anterior)
    const row = await this.db.getFirstAsync<any>(
      `SELECT
        COALESCE(SUM(valorRecebido), 0)         AS totalArrecadado,
        COALESCE(SUM(totalClientePaga), 0)      AS totalClientePaga,
        COALESCE(SUM(COALESCE(descontoDinheiro,0) + COALESCE(descontoPartidasValor,0)), 0) AS totalDesconto,
        COUNT(*) AS totalCobrancas
       FROM cobrancas WHERE ${where}`,
      params
    );
    
    // Calcular saldo devedor total considerando apenas a última cobrança de cada locação
    // Isso evita duplicação pois cada cobrança carrega o saldo anterior
    const saldoDevedorRow = await this.db.getFirstAsync<any>(
      `SELECT COALESCE(SUM(saldoDevedorGerado), 0) AS totalSaldoDevedor
       FROM (
         SELECT locacaoId, saldoDevedorGerado,
                ROW_NUMBER() OVER (PARTITION BY locacaoId ORDER BY updatedAt DESC, createdAt DESC) as rn
         FROM cobrancas 
         WHERE deletedAt IS NULL AND status != 'Pago'
       ) WHERE rn = 1`
    );
    
    return { 
      totalArrecadado: row?.totalArrecadado || 0, 
      totalClientePaga: row?.totalClientePaga || 0, 
      totalDesconto: row?.totalDesconto || 0, 
      totalSaldoDevedor: saldoDevedorRow?.totalSaldoDevedor || 0, 
      totalCobrancas: row?.totalCobrancas || 0
    };
  }

  async getCobrancasPorPeriodo(agrupamento: 'dia' | 'semana' | 'mes', dataInicio?: string, dataFim?: string): Promise<{
    periodo: string; total: number; qtd: number;
  }[]> {
    if (!this.db) throw new Error('Database não inicializado');
    const formatExpr = agrupamento === 'dia'
      ? `strftime('%d/%m/%Y', dataPagamento)`
      : agrupamento === 'mes'
      ? `strftime('%m/%Y', dataPagamento)`
      : `strftime('%W/%Y', dataPagamento)`;

    let where = `deletedAt IS NULL AND dataPagamento IS NOT NULL`;
    const params: any[] = [];
    if (dataInicio) { where += ` AND dataPagamento >= ?`; params.push(dataInicio); }
    if (dataFim)    { where += ` AND dataPagamento <= ?`; params.push(dataFim); }

    // Usar valorRecebido para total (dinheiro que realmente entrou)
    return await this.db.getAllAsync<any>(
      `SELECT ${formatExpr} AS periodo,
        COALESCE(SUM(valorRecebido), 0) AS total,
        COUNT(*) AS qtd
       FROM cobrancas WHERE ${where}
       GROUP BY periodo ORDER BY dataPagamento DESC LIMIT 60`,
      params
    ) || [];
  }

  async getCobrancasDoDia(data?: string): Promise<any[]> {
    if (!this.db) throw new Error('Database não inicializado');
    const dia = data || new Date().toISOString().split('T')[0];
    return await this.db.getAllAsync<any>(
      `SELECT c.*, cl.rotaNome
       FROM cobrancas c
       LEFT JOIN clientes cl ON cl.id = c.clienteId
       WHERE c.deletedAt IS NULL
         AND date(c.dataPagamento) = ?
       ORDER BY c.dataPagamento DESC`,
      [dia]
    ) || [];
  }

  // ── ESTABELECIMENTOS ──────────────────────────────────────────────────────

  async getEstabelecimentos(): Promise<Array<{id: string, nome: string, endereco?: string, observacao?: string}>> {
    if (!this.db) throw new Error('Database não inicializado');
    const rows = await this.db.getAllAsync<{id: string, nome: string, endereco?: string, observacao?: string}>(
      `SELECT id, nome, endereco, observacao FROM estabelecimentos WHERE deletedAt IS NULL ORDER BY nome`
    );
    return rows;
  }

  async saveEstabelecimento(id: string, nome: string, endereco?: string, observacao?: string): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');
    const now = new Date().toISOString();
    await this.db.runAsync(
      `INSERT OR REPLACE INTO estabelecimentos (id, nome, endereco, observacao, createdAt, updatedAt, needsSync) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [id, nome, endereco || null, observacao || null, now, now]
    );
  }

  async deleteEstabelecimento(id: string): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');
    const now = new Date().toISOString();
    await this.db.runAsync(
      `UPDATE estabelecimentos SET deletedAt = ?, needsSync = 1 WHERE id = ?`,
      [now, id]
    );
  }

  /**
   * Inicializa dados padrão de atributos se não existirem
   * Apenas em modo de desenvolvimento (USE_MOCK=true)
   * Em produção, os dados vêm do servidor via sincronização
   */
  async inicializarAtributosPadrao(): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');
    
    // Se USE_MOCK for false, não criar dados mockados
    // Os dados devem vir do servidor via sincronização
    if (!ENV.USE_MOCK) {
      console.log('[Database] Modo produção: Atributos serão sincronizados do servidor');
      return;
    }
    
    console.log('[Database] Modo desenvolvimento: Inicializando atributos padrão...');
    
    const tiposExistentes = await this.getTiposProduto();
    if (tiposExistentes.length === 0) {
      const tiposPadrao = [
        { id: '1', nome: 'Bilhar' },
        { id: '2', nome: 'Jukebox Padrão Grande' },
        { id: '3', nome: 'Jukebox Padrão Pequena' },
        { id: '4', nome: 'Mesa' },
      ];
      for (const tipo of tiposPadrao) {
        await this.saveTipoProduto(tipo.id, tipo.nome);
      }
      console.log('[Database] Tipos padrão inicializados');
    }

    const descricoesExistentes = await this.getDescricoesProduto();
    if (descricoesExistentes.length === 0) {
      const descricoesPadrao = [
        { id: '1', nome: 'Azul' },
        { id: '2', nome: 'Branco/Carijo' },
        { id: '3', nome: 'Preto' },
        { id: '4', nome: 'Vermelho' },
      ];
      for (const desc of descricoesPadrao) {
        await this.saveDescricaoProduto(desc.id, desc.nome);
      }
      console.log('[Database] Descrições padrão inicializadas');
    }

    const tamanhosExistentes = await this.getTamanhosProduto();
    if (tamanhosExistentes.length === 0) {
      const tamanhosPadrao = [
        { id: '1', nome: '2,00' },
        { id: '2', nome: '2,20' },
        { id: '3', nome: 'Grande' },
        { id: '4', nome: 'Média' },
      ];
      for (const tam of tamanhosPadrao) {
        await this.saveTamanhoProduto(tam.id, tam.nome);
      }
      console.log('[Database] Tamanhos padrão inicializados');
    }

    const estabelecimentosExistentes = await this.getEstabelecimentos();
    if (estabelecimentosExistentes.length === 0) {
      const pad = [{ id: 'est_1', nome: 'Barracão Principal' }, { id: 'est_2', nome: 'Depósito' }];
      for (const e of pad) await this.saveEstabelecimento(e.id, e.nome);
    }
  }

  // ==========================================================================
  // MÉTODOS PARA USUÁRIOS
  // ==========================================================================

  /**
   * Busca usuário por email
   */
  async getUsuarioByEmail(email: string): Promise<any | null> {
    if (!this.isReady()) {
      await this.waitForReady();
    }
    if (!this.db) throw new Error('Database não inicializado');
    try {
      const result = await this.db.getFirstAsync(
        `SELECT * FROM ${TABLES.USUARIOS} WHERE email = ? AND deletedAt IS NULL`,
        [email.toLowerCase().trim()]
      );
      return result || null;
    } catch (error) {
      console.error('[Database] Erro ao buscar usuário por email:', error);
      return null;
    }
  }

  /**
   * Salva usuário
   */
  async saveUsuario(usuario: any): Promise<void> {
    if (!this.isReady()) {
      await this.waitForReady();
    }
    if (!this.db) throw new Error('Database não inicializado');
    const now = new Date().toISOString();
    
    const usuarioData: Record<string, any> = {
      id: usuario.id || `usr_${Date.now()}`,
      tipo: usuario.tipo || 'usuario',
      nome: usuario.nome || '',
      cpf: usuario.cpf || '',
      telefone: usuario.telefone || '',
      email: usuario.email?.toLowerCase().trim() || '',
      senha: usuario.senha || '',
      tipoPermissao: usuario.tipoPermissao || 'AcessoControlado',
      permissoesWeb: usuario.permissoesWeb || '{}',
      permissoesMobile: usuario.permissoesMobile || '{}',
      rotasPermitidas: usuario.rotasPermitidas || '[]',
      status: usuario.status || 'Ativo',
      bloqueado: usuario.bloqueado ? 1 : 0,
      dataUltimoAcesso: usuario.dataUltimoAcesso || null,
      ultimoAcessoDispositivo: usuario.ultimoAcessoDispositivo || null,
      syncStatus: usuario.syncStatus || 'pending',
      lastSyncedAt: usuario.lastSyncedAt || null,
      needsSync: 1,
      version: usuario.version || 1,
      deviceId: usuario.deviceId || '',
      createdAt: usuario.createdAt || now,
      updatedAt: now,
      deletedAt: null,
    };
    
    try {
      // Verificar se existe
      const existente = await this.getUsuarioByEmail(usuario.email);
      
      if (existente) {
        // Update
        const fields = Object.keys(usuarioData).filter(k => k !== 'id');
        const setClause = fields.map(f => `${f} = ?`).join(', ');
        await this.db.runAsync(
          `UPDATE ${TABLES.USUARIOS} SET ${setClause} WHERE id = ?`,
          [...fields.map(f => usuarioData[f]), usuarioData.id]
        );
        console.log('[Database] Usuário atualizado:', usuario.email);
      } else {
        // Insert
        const fields = Object.keys(usuarioData);
        const placeholders = fields.map(() => '?').join(', ');
        const values = fields.map(f => usuarioData[f]);
        
        console.log('[Database] Inserindo usuário:', { 
          email: usuario.email, 
          fields: fields.join(', '),
          valuesCount: values.length 
        });
        
        await this.db.runAsync(
          `INSERT INTO ${TABLES.USUARIOS} (${fields.join(', ')}) VALUES (${placeholders})`,
          values
        );
        console.log('[Database] Usuário inserido:', usuario.email);
      }
      
      // Verificar se foi salvo
      const verificado = await this.getUsuarioByEmail(usuario.email);
      if (verificado) {
        console.log('[Database] ✅ Usuário verificado:', { 
          email: (verificado as any).email, 
          senha: (verificado as any).senha ? '***' : 'VAZIA',
          status: (verificado as any).status 
        });
      } else {
        console.error('[Database] ❌ Usuário não encontrado após insert!');
      }
      
    } catch (error) {
      console.error('[Database] Erro ao salvar usuário:', error);
      throw error;
    }
  }

  // ==========================================================================
  // MÉTODOS PARA ROTAS
  // ==========================================================================

  /**
   * Busca todas as rotas ativas
   */
  async getRotas(): Promise<Array<{id: string, descricao: string, status: string, syncStatus?: string, needsSync?: number, version?: number, deviceId?: string, lastSyncedAt?: string | null, createdAt?: string, updatedAt?: string}>> {
    if (!this.isReady()) {
      await this.waitForReady();
    }
    if (!this.db) throw new Error('Database não inicializado');
    try {
      const results = await this.db.getAllAsync<any>(
        `SELECT id, descricao, status, syncStatus, needsSync, version, deviceId, lastSyncedAt, createdAt, updatedAt FROM ${TABLES.ROTAS} WHERE deletedAt IS NULL ORDER BY descricao`
      );
      return results || [];
    } catch (error) {
      console.error('[Database] Erro ao buscar rotas:', error);
      return [];
    }
  }

  /**
   * Salva rota — apenas para CRIAÇÃO de novas rotas
   * Preserva createdAt e campos de sync
   */
  async saveRota(id: string, descricao: string, status: string = 'Ativo', cor: string = '#2563EB', regiao: string | null = null, ordem: number = 0, observacao: string | null = null): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');
    const now = new Date().toISOString();

    // Verificar se já existe uma rota com este ID
    const existing = await this.getAllAsync<{ id: string }>(
      `SELECT id FROM ${TABLES.ROTAS} WHERE id = ? AND deletedAt IS NULL`,
      [id]
    );

    if (existing.length > 0) {
      // Atualização — preserva createdAt, syncStatus, version, deviceId
      await this.db.runAsync(
        `UPDATE ${TABLES.ROTAS} SET descricao = ?, status = ?, cor = ?, regiao = ?, ordem = ?, observacao = ?, updatedAt = ?, needsSync = 1, syncStatus = 'pending' WHERE id = ?`,
        [descricao.trim(), status, cor, regiao, ordem, observacao, now, id]
      );
    } else {
      // Criação — define campos iniciais
      await this.db.runAsync(
        `INSERT INTO ${TABLES.ROTAS} (id, descricao, status, cor, regiao, ordem, observacao, createdAt, updatedAt, needsSync, syncStatus, version, deviceId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending', 1, '')`,
        [id, descricao.trim(), status, cor, regiao, ordem, observacao, now, now]
      );
    }
    console.log('[Database] Rota salva:', descricao);
  }

  /**
   * Inicializa rotas padrão se não existirem
   */
  async inicializarRotasPadrao(): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');

    try {
      const rotasExistentes = await this.getRotas();
      if (rotasExistentes.length === 0) {
        const rotasPadrao = [
          { id: '1', descricao: 'Linha Aquidauana' },
          { id: '2', descricao: 'Linha Miranda' },
          { id: '3', descricao: 'Linha Bonito' },
          { id: '4', descricao: 'Centro' },
        ];
        for (const rota of rotasPadrao) {
          await this.saveRota(rota.id, rota.descricao, 'Ativo');
        }
        console.log('[Database] Rotas padrão inicializadas');
      }
    } catch (error) {
      // Rotas padrão são opcionais — não impedir o app de iniciar
      console.error('[Database] Erro ao inicializar rotas padrão (não crítico):', error);
    }
  }

  /**
   * Diagnóstico do banco de dados - verifica se tudo está funcionando
   */
  async diagnosticar(): Promise<void> {
    console.log('=== DIAGNÓSTICO DO BANCO DE DADOS ===');
    
    try {
      if (!this.db) {
        console.log('❌ Banco não inicializado');
        return;
      }
      
      console.log('✅ Banco está inicializado');
      
      // Verificar tabelas existentes
      const tabelas = await this.db.getAllAsync<{name: string}>(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
      );
      console.log('📋 Tabelas:', tabelas?.map(t => t.name).join(', '));
      
      // Verificar usuários
      const usuarios = await this.db.getAllAsync(
        `SELECT id, email, nome, status, senha FROM ${TABLES.USUARIOS}`
      );
      console.log('👤 Usuários:', JSON.stringify(usuarios, null, 2));
      
      // Verificar rotas
      const rotas = await this.getRotas();
      console.log('🗺️ Rotas:', rotas.length);
      
    } catch (error) {
      console.error('❌ Erro no diagnóstico:', error);
    }
    
    console.log('=== FIM DO DIAGNÓSTICO ===');
  }
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

export const databaseService = new DatabaseService();
export default databaseService;
