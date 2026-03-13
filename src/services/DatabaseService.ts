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
  CHANGE_LOG: 'change_log',
  SYNC_METADATA: 'sync_metadata',
};

// ============================================================================
// CLASSE DATABASE SERVICE
// ============================================================================

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitialized = false;

  // ==========================================================================
  // INICIALIZAÇÃO
  // ==========================================================================
  /**
   * Inicializa o banco de dados e cria as tabelas se necessário
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        console.log('[Database] Já inicializado');
        return;
    
  }

      console.log('[Database] Inicializando banco de dados...');
      
      // Abrir/criar banco de dados
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      
      // Habilitar foreign keys
      await this.db.execAsync('PRAGMA foreign_keys = ON;');
      
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
        createdAt TEXT,        updatedAt TEXT
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
      `CREATE INDEX IF NOT EXISTS idx_locacoes_sync ON ${TABLES.LOCACOES}(syncStatus, needsSync)`,
      
      `CREATE INDEX IF NOT EXISTS idx_cobrancas_locacao ON ${TABLES.COBRANCAS}(locacaoId)`,
      `CREATE INDEX IF NOT EXISTS idx_cobrancas_cliente ON ${TABLES.COBRANCAS}(clienteId)`,
      `CREATE INDEX IF NOT EXISTS idx_cobrancas_status ON ${TABLES.COBRANCAS}(status)`,
      
      `CREATE INDEX IF NOT EXISTS idx_change_log_sync ON ${TABLES.CHANGE_LOG}(synced, timestamp)`,
      `CREATE INDEX IF NOT EXISTS idx_change_log_entity ON ${TABLES.CHANGE_LOG}(entityId, entityType)`,
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
            needsSync: true,
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
    if (!this.db) throw new Error('Database não inicializado');

    const tableName = this.getTableName(entityType);
    const now = new Date().toISOString();

    try {
      // Marcar como precisando de sync
      const entityWithSync = {
        ...entity,
        updatedAt: now,
        needsSync: true,
        version: (entity.version || 0) + 1,
      } as T;

      await this.db.runAsync(
        `UPDATE ${tableName} SET 
          updatedAt = ?,
          needsSync = ?,
          version = ?,
          ${this.getUpdateFields(entityWithSync)}
        WHERE id = ?`,
        [now, 1, entityWithSync.version, entity.id]
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
   * Aplica mudanças recebidas do servidor
   */
  async applyRemoteChanges(response: SyncResponse): Promise<void> {
    if (!this.db) throw new Error('Database não inicializado');

    await this.runTransaction(async () => {
      // Aplicar mudanças de cada entidade
      const changes = response.changes || {};
      for (const cliente of changes.clientes || []) {
        await this.save('cliente', cliente);
    
  }

      for (const produto of changes.produtos || []) {
        await this.save('produto', produto);
    
  }

      for (const locacao of changes.locacoes || []) {
        await this.save('locacao', locacao);
    
  }
      for (const cobranca of changes.cobrancas || []) {
        await this.save('cobranca', cobranca);
    
  }

      for (const rota of changes.rotas || []) {
        await this.save('rota', rota);
    
  }

      // Atualizar metadata
      await this.updateSyncMetadata({
        lastSyncAt: response.lastSyncAt,
        lastPullAt: new Date().toISOString(),
      });
    });

    console.log('[Database] Mudanças remotas aplicadas com sucesso');

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
      usuario: 'usuarios', // Se necessário
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

    const fields = Object.keys(entity);
    const placeholders = fields.map(() => '?').join(', ');
    const values = Object.values(entity) as any[];

    await this.db.runAsync(
      `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`,
      ...values
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
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

export const databaseService = new DatabaseService();
export default databaseService;