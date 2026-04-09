/**
 * DatabaseService.ts
 * Serviço de banco de dados local usando expo-sqlite
 * Arquitetura: Offline-first com sincronização bidirecional
 */

import * as SQLite from 'expo-sqlite';
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
      
      // Criar tabelas
      await this.createTables();
      
      // Inicializar metadata de sync
      await this.initializeSyncMetadata();
      
      this.isInitialized = true;
      console.log('[Database] Banco inicializado com sucesso!');
      
    } catch (error) {
      console.error('[Database] Erro ao inicializar:', error);
      throw new Error(`Falha ao inicializar banco de dados: ${error}`);
    }
  }

  /**
   * Cria todas as tabelas do banco
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
        cnpj TEXT,        razaoSocial TEXT,
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
        rotaId TEXT,
        rotaNome TEXT,
        status TEXT,
        dataCadastro TEXT,
        dataUltimaAlteracao TEXT,
        observacao TEXT,
        
        -- Controle de sincronização
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
        dataUltimaManutencao TEXT,        relatorioUltimaManutencao TEXT,
        dataAvaliacao TEXT,
        aprovacao TEXT,
        estabelecimento TEXT,
        observacao TEXT,
        dataCadastro TEXT,
        dataUltimaAlteracao TEXT,
        
        -- Controle de sincronização
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
        ultimaLeituraRelogio INTEGER,
        dataUltimaCobranca TEXT,
        trocaPano INTEGER DEFAULT 0,
        dataUltimaManutencao TEXT,
        
        -- Controle de sincronização
        syncStatus TEXT,
        lastSyncedAt TEXT,
        needsSync INTEGER,
        version INTEGER,
        deviceId TEXT,
        createdAt TEXT,        updatedAt TEXT,
        deletedAt TEXT
      )`,

      // Tabela de Cobranças
      `CREATE TABLE IF NOT EXISTS ${TABLES.COBRANCAS} (
        id TEXT PRIMARY KEY,
        tipo TEXT,
        locacaoId TEXT,
        clienteId TEXT,
        clienteNome TEXT,
        produtoIdentificador TEXT,
        dataInicio TEXT,
        dataFim TEXT,
        dataPagamento TEXT,
        relogioAnterior INTEGER,
        relogioAtual INTEGER,
        fichasRodadas INTEGER,
        valorFicha REAL,
        totalBruto REAL,
        descontoPartidasQtd INTEGER,
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
        
        -- Controle de sincronização
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

      // Sync Metadata
      `CREATE TABLE IF NOT EXISTS ${TABLES.SYNC_METADATA} (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,

      // Índices para performance
      `CREATE INDEX IF NOT EXISTS idx_clientes_rota ON ${TABLES.CLIENTES}(rotaId)`,
      `CREATE INDEX IF NOT EXISTS idx_clientes_status ON ${TABLES.CLIENTES}(status)`,
      `CREATE INDEX IF NOT EXISTS idx_clientes_sync ON ${TABLES.CLIENTES}(syncStatus, needsSync)`,
      
      `CREATE INDEX IF NOT EXISTS idx_produtos_status ON ${TABLES.PRODUTOS}(statusProduto)`,
      `CREATE INDEX IF NOT EXISTS idx_produtos_sync ON ${TABLES.PRODUTOS}(syncStatus, needsSync)`,
      
      `CREATE INDEX IF NOT EXISTS idx_locacoes_cliente ON ${TABLES.LOCACOES}(clienteId)`,
      `CREATE INDEX IF NOT EXISTS idx_locacoes_produto ON ${TABLES.LOCACOES}(produtoId)`,
      `CREATE INDEX IF NOT EXISTS idx_locacoes_status ON ${TABLES.LOCACOES}(status)`,

      // Tabela de Histórico de Manutenções (trocas de pano, etc.)
      `CREATE TABLE IF NOT EXISTS manutencoes (
        id TEXT PRIMARY KEY,
        produtoId TEXT NOT NULL,
        produtoIdentificador TEXT,
        produtoTipo TEXT,
        clienteId TEXT,
        clienteNome TEXT,
        locacaoId TEXT,
        cobrancaId TEXT,
        tipo TEXT NOT NULL,        -- 'trocaPano' | 'manutencao'
        descricao TEXT,
        data TEXT NOT NULL,
        registradoPor TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        deletedAt TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_manutencoes_produto ON manutencoes(produtoId)`,
      `CREATE INDEX IF NOT EXISTS idx_manutencoes_data ON manutencoes(data)`,
      `CREATE INDEX IF NOT EXISTS idx_locacoes_sync ON ${TABLES.LOCACOES}(syncStatus, needsSync)`,
      
      `CREATE INDEX IF NOT EXISTS idx_cobrancas_locacao ON ${TABLES.COBRANCAS}(locacaoId)`,
      `CREATE INDEX IF NOT EXISTS idx_cobrancas_cliente ON ${TABLES.COBRANCAS}(clienteId)`,
      `CREATE INDEX IF NOT EXISTS idx_cobrancas_status ON ${TABLES.COBRANCAS}(status)`,
      
      `CREATE INDEX IF NOT EXISTS idx_change_log_sync ON ${TABLES.CHANGE_LOG}(synced, timestamp)`,
      `CREATE INDEX IF NOT EXISTS idx_change_log_purge ON ${TABLES.CHANGE_LOG}(synced, syncedAt)`,  // Para purge
      `CREATE INDEX IF NOT EXISTS idx_change_log_entity ON ${TABLES.CHANGE_LOG}(entityId, entityType)`,
      
      `CREATE INDEX IF NOT EXISTS idx_usuarios_email ON ${TABLES.USUARIOS}(email)`,
      `CREATE INDEX IF NOT EXISTS idx_usuarios_status ON ${TABLES.USUARIOS}(status)`,
      `CREATE INDEX IF NOT EXISTS idx_usuarios_sync ON ${TABLES.USUARIOS}(syncStatus, needsSync)`,
      
      `CREATE INDEX IF NOT EXISTS idx_rotas_status ON ${TABLES.ROTAS}(status)`,
      `CREATE INDEX IF NOT EXISTS idx_rotas_sync ON ${TABLES.ROTAS}(syncStatus, needsSync)`,
    ];

    for (const table of tables) {
      await this.db.runAsync(table);
  
  }

    console.log('[Database] Tabelas criadas com sucesso');

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
          await this.update(entityType, { ...entity, updatedAt: now });
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
          changes: entity,
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

    try {
      const result = await this.db.getFirstAsync<T>(
        `SELECT * FROM ${tableName} WHERE id = ? AND deletedAt IS NULL`,
        [id]
      );

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
    let query = `SELECT * FROM ${tableName} WHERE deletedAt IS NULL`;

    if (where) {
      query += ` AND ${where}`;
  
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
    entity: T
  ): Promise<void> {
    if (!this.isReady()) {
      await this.waitForReady();
    }
    if (!this.db) throw new Error('Database não inicializado');

    const tableName = this.getTableName(entityType);
    const now = new Date().toISOString();

    // Campos virtuais que não existem como colunas no banco
    const CAMPOS_EXCLUIDOS = new Set([
      'id', 'createdAt',
      'cpfCnpj', 'rgIe',             // Campos computados do Cliente
      'locacaoAtiva', 'estaLocado', 'locacaoAtual', // Campos computados do Produto
      'totalLocacoesAtivas', 'totalLocacoesFinalizadas', 'saldoDevedorTotal' // Campos de join
    ]);

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
        (key) => !CAMPOS_EXCLUIDOS.has(key) && (entityWithSync as any)[key] !== undefined
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

      // Log mudança
      await this.logChange({
        id: `${entityType}_${entity.id}_${now}`,
        entityId: entity.id,
        entityType,
        operation: 'update',
        changes: entity,
        timestamp: now,
        deviceId: await this.getDeviceId(),
        synced: false,
      });

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

    await this.runTransaction(async () => {
      // Aplicar mudanças de cada entidade usando upsert direto
      const changes = response.changes || {};
      
      // Clientes
      for (const cliente of changes.clientes || []) {
        await this.upsertFromSync('cliente', cliente);
      }

      // Produtos
      for (const produto of changes.produtos || []) {
        await this.upsertFromSync('produto', produto);
      }

      // Locações
      for (const locacao of changes.locacoes || []) {
        await this.upsertFromSync('locacao', locacao);
      }

      // Cobranças
      for (const cobranca of changes.cobrancas || []) {
        await this.upsertFromSync('cobranca', cobranca);
      }

      // Rotas
      for (const rota of changes.rotas || []) {
        await this.upsertFromSync('rota', rota);
      }

      // Usuários - sincronizar permissões alteradas no web
      const usuarios = (changes as any).usuarios || [];
      for (const usuario of usuarios) {
        await this.upsertUsuarioFromSync(usuario);
      }

      // Tipos de Produto (atributos)
      const tiposProduto = (response as any).tiposProduto || [];
      for (const tipo of tiposProduto) {
        await this.upsertTipoProdutoFromSync(tipo);
      }

      // Descrições de Produto (atributos)
      const descricoesProduto = (response as any).descricoesProduto || [];
      for (const desc of descricoesProduto) {
        await this.upsertDescricaoProdutoFromSync(desc);
      }

      // Tamanhos de Produto (atributos)
      const tamanhosProduto = (response as any).tamanhosProduto || [];
      for (const tam of tamanhosProduto) {
        await this.upsertTamanhoProdutoFromSync(tam);
      }

      // Reconciliar IDs temporários (tmp_/novo_) criados offline com UUIDs reais do servidor
      // Deve rodar APÓS aplicar todos os atributos do pull
      await this.reconciliarAtributosTemporarios();

      // Atualizar metadata
      await this.updateSyncMetadata({
        lastSyncAt: response.lastSyncAt,
        lastPullAt: new Date().toISOString(),
      });
    });

    console.log('[Database] Mudanças remotas aplicadas com sucesso');
  }

  /**
   * Upsert de entidade recebida do servidor (SEM criar ChangeLog)
   */
  private async upsertFromSync(entityType: EntityType, entity: any): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');

    const tableName = this.getTableName(entityType);
    const now = new Date().toISOString();

    // Campos virtuais que não existem como colunas
    const CAMPOS_EXCLUIDOS = new Set([
      'cpfCnpj', 'rgIe',
      'locacaoAtiva', 'estaLocado', 'locacaoAtual',
      'totalLocacoesAtivas', 'totalLocacoesFinalizadas', 'saldoDevedorTotal'
    ]);

    // Preparar dados
    const data = { ...entity };
    delete data.id;

    // Verificar se existe
    const existing = await this.getById<any>(entityType, entity.id);

    if (existing) {
      // UPDATE - não incrementar version se veio do servidor
      const fields = Object.keys(data).filter(
        (key) => !CAMPOS_EXCLUIDOS.has(key) && data[key] !== undefined
      );
      const setClause = fields.map((field) => `${field} = ?`).join(', ');
      
      const values = fields.map((field) => {
        const val = data[field];
        if (val !== null && val !== undefined && typeof val === 'object') {
          return JSON.stringify(val);
        }
        return val;
      });

      await this.db.runAsync(
        `UPDATE ${tableName} SET ${setClause} WHERE id = ?`,
        [...values, entity.id]
      );
    } else {
      // INSERT
      const fields = Object.keys(data).filter(
        (key) => !CAMPOS_EXCLUIDOS.has(key) && data[key] !== undefined
      );
      const placeholders = fields.map(() => '?').join(', ');

      const values = fields.map((field) => {
        const val = data[field];
        if (val !== null && val !== undefined && typeof val === 'object') {
          return JSON.stringify(val);
        }
        return val;
      });

      await this.db.runAsync(
        `INSERT INTO ${tableName} (id, ${fields.join(', ')}) VALUES (?, ${placeholders})`,
        [entity.id, ...values]
      );
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
            \`[Database] Reconciliado atributo temporário: \${tmp.id} → \${server.id} (nome: "\${tmp.nome}")\`
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
    await this.db.runAsync(
      `INSERT OR REPLACE INTO ${TABLES.TIPOS_PRODUTO} (id, nome, syncStatus, lastSyncedAt, needsSync, version, deviceId, createdAt, updatedAt, deletedAt)
       VALUES (?, ?, 'synced', ?, 0, ?, ?, ?, ?, ?)`,
      [tipo.id, tipo.nome, tipo.lastSyncedAt || new Date().toISOString(), tipo.version || 1, tipo.deviceId || '', tipo.createdAt || new Date().toISOString(), tipo.updatedAt || new Date().toISOString(), tipo.deletedAt || null]
    );
  }

  /**
   * Upsert de descrição de produto (SEM criar ChangeLog)
   */
  private async upsertDescricaoProdutoFromSync(desc: any): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      `INSERT OR REPLACE INTO ${TABLES.DESCRICOES_PRODUTO} (id, nome, syncStatus, lastSyncedAt, needsSync, version, deviceId, createdAt, updatedAt, deletedAt)
       VALUES (?, ?, 'synced', ?, 0, ?, ?, ?, ?, ?)`,
      [desc.id, desc.nome, desc.lastSyncedAt || new Date().toISOString(), desc.version || 1, desc.deviceId || '', desc.createdAt || new Date().toISOString(), desc.updatedAt || new Date().toISOString(), desc.deletedAt || null]
    );
  }

  /**
   * Upsert de tamanho de produto (SEM criar ChangeLog)
   */
  private async upsertTamanhoProdutoFromSync(tam: any): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      `INSERT OR REPLACE INTO ${TABLES.TAMANHOS_PRODUTO} (id, nome, syncStatus, lastSyncedAt, needsSync, version, deviceId, createdAt, updatedAt, deletedAt)
       VALUES (?, ?, 'synced', ?, 0, ?, ?, ?, ?, ?)`,
      [tam.id, tam.nome, tam.lastSyncedAt || new Date().toISOString(), tam.version || 1, tam.deviceId || '', tam.createdAt || new Date().toISOString(), tam.updatedAt || new Date().toISOString(), tam.deletedAt || null]
    );
  }

  /**
   * Upsert de usuário recebido do servidor (SEM criar ChangeLog)
   * Sincroniza permissões alteradas no web para o mobile
   */
  private async upsertUsuarioFromSync(usuario: any): Promise<void> {
    if (!this.db) return;
    
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

    await this.db.runAsync(
      `INSERT OR REPLACE INTO ${TABLES.USUARIOS} 
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
        usuario.deletedAt || null
      ]
    );
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
  async setDeviceId(deviceId: string, deviceName: string, deviceKey: string): Promise<void> {
    await this.updateSyncMetadata({
      deviceId,
      deviceName,
      deviceKey,
    });

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
    };

    return tableMap[entityType];

  }

  private getUpdateFields(entity: any): string {
    const fields = Object.keys(entity).filter(
      (key) => key !== 'id' && key !== 'createdAt'
    );
    return fields.map((field) => `${field} = ?`).join(', ');

  }

  private async insert(tableName: string, entity: any): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');

    // Campos virtuais que não existem como colunas no banco
    const CAMPOS_EXCLUIDOS = new Set([
      'cpfCnpj', 'rgIe',
      'locacaoAtiva', 'estaLocado', 'locacaoAtual',
      'totalLocacoesAtivas', 'totalLocacoesFinalizadas', 'saldoDevedorTotal'
    ]);

    const fields = Object.keys(entity).filter(
      (key) => !CAMPOS_EXCLUIDOS.has(key) && entity[key] !== undefined
    );
    const placeholders = fields.map(() => '?').join(', ');

    // Serializar arrays e objetos para JSON antes de salvar
    const values = fields.map((field) => {
      const val = entity[field];
      if (val !== null && val !== undefined && typeof val === 'object') {
        return JSON.stringify(val);
      }
      return val;
    });

    await this.db.runAsync(
      `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );

  }
  /**
   * Limpa todos os dados locais (útil para logout ou reset)
   */
  async clearLocalData(): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');

    const tables = Object.values(TABLES);

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
    await this.db.runAsync(
      `INSERT OR REPLACE INTO ${TABLES.TIPOS_PRODUTO} (id, nome, updatedAt, needsSync) VALUES (?, ?, ?, 1)`,
      [id, nome.trim(), now]
    );
    console.log('[Database] Tipo de produto salvo:', nome);
  }

  /**
   * Salva descrição de produto
   */
  async saveDescricaoProduto(id: string, nome: string): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');
    const now = new Date().toISOString();
    await this.db.runAsync(
      `INSERT OR REPLACE INTO ${TABLES.DESCRICOES_PRODUTO} (id, nome, updatedAt, needsSync) VALUES (?, ?, ?, 1)`,
      [id, nome.trim(), now]
    );
    console.log('[Database] Descrição de produto salva:', nome);
  }

  /**
   * Salva tamanho de produto
   */
  async saveTamanhoProduto(id: string, nome: string): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');
    const now = new Date().toISOString();
    await this.db.runAsync(
      `INSERT OR REPLACE INTO ${TABLES.TAMANHOS_PRODUTO} (id, nome, updatedAt, needsSync) VALUES (?, ?, ?, 1)`,
      [id, nome.trim(), now]
    );
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
    console.log('[Database] Tamanho de produto removido:', id);
  }

  // ── MANUTENÇÕES ──────────────────────────────────────────────────────────

  async saveManutencao(registro: {
    id: string;
    produtoId: string;
    produtoIdentificador: string;
    produtoTipo: string;
    clienteId?: string;
    clienteNome?: string;
    locacaoId?: string;
    cobrancaId?: string;
    tipo: string;
    descricao?: string;
    data: string;
    registradoPor?: string;
  }): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');
    const now = new Date().toISOString();
    await this.db.runAsync(
      `INSERT OR REPLACE INTO manutencoes
        (id, produtoId, produtoIdentificador, produtoTipo, clienteId, clienteNome,
         locacaoId, cobrancaId, tipo, descricao, data, registradoPor, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [registro.id, registro.produtoId, registro.produtoIdentificador, registro.produtoTipo,
       registro.clienteId || null, registro.clienteNome || null,
       registro.locacaoId || null, registro.cobrancaId || null,
       registro.tipo, registro.descricao || null, registro.data,
       registro.registradoPor || null, now, now]
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

  async getEstabelecimentos(): Promise<Array<{id: string, nome: string}>> {
    if (!this.db) throw new Error('Database não inicializado');
    const rows = await this.db.getAllAsync<{id: string, nome: string}>(
      `SELECT id, nome FROM estabelecimentos WHERE deletedAt IS NULL ORDER BY nome`
    );
    return rows;
  }

  async saveEstabelecimento(id: string, nome: string): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');
    const now = new Date().toISOString();
    await this.db.runAsync(
      `INSERT OR REPLACE INTO estabelecimentos (id, nome, createdAt, updatedAt, needsSync) VALUES (?, ?, ?, ?, 1)`,
      [id, nome, now, now]
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
  async getRotas(): Promise<Array<{id: string, descricao: string, status: string}>> {
    if (!this.isReady()) {
      await this.waitForReady();
    }
    if (!this.db) throw new Error('Database não inicializado');
    try {
      const results = await this.db.getAllAsync<{id: string, descricao: string, status: string}>(
        `SELECT id, descricao, status FROM ${TABLES.ROTAS} WHERE deletedAt IS NULL ORDER BY descricao`
      );
      return results || [];
    } catch (error) {
      console.error('[Database] Erro ao buscar rotas:', error);
      return [];
    }
  }

  /**
   * Salva rota
   */
  async saveRota(id: string, descricao: string, status: string = 'Ativo'): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');
    const now = new Date().toISOString();
    await this.db.runAsync(
      `INSERT OR REPLACE INTO ${TABLES.ROTAS} (id, descricao, status, updatedAt, needsSync) VALUES (?, ?, ?, ?, 1)`,
      [id, descricao.trim(), status, now]
    );
    console.log('[Database] Rota salva:', descricao);
  }

  /**
   * Inicializa rotas padrão se não existirem
   */
  async inicializarRotasPadrao(): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');
    
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