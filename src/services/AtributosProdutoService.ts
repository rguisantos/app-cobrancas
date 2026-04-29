/**
 * AtributosProdutoService.ts
 * Serviço para gerenciar atributos de produto (Tipos, Descrições, Tamanhos)
 * Persistência local usando SQLite (DatabaseService)
 */

import { databaseService } from './DatabaseService';
import { apiService } from './ApiService';

// Tipos
export type TipoAtributo = 'tipo' | 'descricao' | 'tamanho';

export interface AtributoItem {
  id: string;
  nome: string;
}

class AtributosProdutoService {
  /**
   * Inicializa dados padrão se não existirem
   */
  async inicializar(): Promise<void> {
    try {
      await databaseService.inicializarAtributosPadrao();
      console.log('[AtributosService] Dados inicializados');
    } catch (error) {
      console.error('[AtributosService] Erro ao inicializar:', error);
    }
  }

  /**
   * Busca todos os itens de um tipo
   */
  async getAll(tipo: TipoAtributo): Promise<AtributoItem[]> {
    switch (tipo) {
      case 'tipo':
        return databaseService.getTiposProduto();
      case 'descricao':
        return databaseService.getDescricoesProduto();
      case 'tamanho':
        return databaseService.getTamanhosProduto();
      default:
        return [];
    }
  }

  /**
   * Salva todos os itens de um tipo (substitui)
   */
  async salvarTodos(tipo: TipoAtributo, itens: AtributoItem[]): Promise<void> {
    try {
      for (const item of itens) {
        switch (tipo) {
          case 'tipo':
            await databaseService.saveTipoProduto(String(item.id), item.nome);
            break;
          case 'descricao':
            await databaseService.saveDescricaoProduto(String(item.id), item.nome);
            break;
          case 'tamanho':
            await databaseService.saveTamanhoProduto(String(item.id), item.nome);
            break;
        }
      }
      console.log(`[AtributosService] ${itens.length} itens de ${tipo} salvos`);
    } catch (error) {
      console.error(`[AtributosService] Erro ao salvar ${tipo}:`, error);
      throw error;
    }
  }

  /**
   * Adiciona um novo item
   */
  async adicionar(tipo: TipoAtributo, nome: string): Promise<AtributoItem> {
    try {
      // Tentar criar no servidor primeiro (online) → obter UUID real.
      // Sem UUID real, o produto criado com este tipoId ficaria com FK inválida após sync.
      // O applyRemoteChanges.reconciliarAtributosTemporarios() corrige o fallback offline.
      const endpointMap: Record<string, string> = {
        tipo:           '/api/tipos-produto',
        descricao:      '/api/descricoes-produto',
        tamanho:        '/api/tamanhos-produto',
        estabelecimento: '/api/estabelecimentos',
      };

      let finalId: string | null = null;
      const endpoint = endpointMap[tipo];
      if (endpoint) {
        try {
          const res = await apiService.post<{ id: string; nome: string }>(
            endpoint, { nome: nome.trim() }
          );
          if (res.success && res.data?.id) {
            finalId = res.data.id;
            console.log(`[AtributosService] UUID real obtido do servidor: ${finalId}`);
          }
        } catch {
          // Offline — fallback para ID temporário (reconciliado no próximo pull)
          console.warn(`[AtributosService] Offline ao criar ${tipo} — usando ID temporário`);
        }
      }

      // Fallback: prefixo 'tmp_' é reconhecido por reconciliarAtributosTemporarios()
      const novoId = finalId ?? `tmp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const novoItem: AtributoItem = { id: novoId, nome: nome.trim() };

      switch (tipo) {
        case 'tipo':
          await databaseService.saveTipoProduto(novoId, nome);
          break;
        case 'descricao':
          await databaseService.saveDescricaoProduto(novoId, nome);
          break;
        case 'tamanho':
          await databaseService.saveTamanhoProduto(novoId, nome);
          break;
      }

      console.log(`[AtributosService] Item adicionado: ${tipo} | nome: "${nome}" | id: ${novoId}`);
      return novoItem;
    } catch (error) {
      console.error(`[AtributosService] Erro ao adicionar ${tipo}:`, error);
      throw error;
    }
  }

  /**
   * Atualiza um item existente
   */
  async atualizar(tipo: TipoAtributo, id: string, novoNome: string): Promise<AtributoItem | null> {
    try {
      const idStr = String(id);
      
      switch (tipo) {
        case 'tipo':
          await databaseService.saveTipoProduto(idStr, novoNome);
          break;
        case 'descricao':
          await databaseService.saveDescricaoProduto(idStr, novoNome);
          break;
        case 'tamanho':
          await databaseService.saveTamanhoProduto(idStr, novoNome);
          break;
      }
      
      console.log(`[AtributosService] Item atualizado em ${tipo}:`, novoNome);
      return { id, nome: novoNome.trim() };
    } catch (error) {
      console.error(`[AtributosService] Erro ao atualizar ${tipo}:`, error);
      throw error;
    }
  }

  /**
   * Remove um item (soft delete)
   */
  async remover(tipo: TipoAtributo, id: string): Promise<boolean> {
    try {
      const idStr = String(id);
      
      switch (tipo) {
        case 'tipo':
          await databaseService.deleteTipoProduto(idStr);
          break;
        case 'descricao':
          await databaseService.deleteDescricaoProduto(idStr);
          break;
        case 'tamanho':
          await databaseService.deleteTamanhoProduto(idStr);
          break;
      }
      
      console.log(`[AtributosService] Item removido de ${tipo}:`, id);
      return true;
    } catch (error) {
      console.error(`[AtributosService] Erro ao remover ${tipo}:`, error);
      throw error;
    }
  }

  /**
   * Busca item por ID
   */
  async getById(tipo: TipoAtributo, id: string): Promise<AtributoItem | null> {
    try {
      const itens = await this.getAll(tipo);
      return itens.find(item => String(item.id) === String(id)) || null;
    } catch (error) {
      console.error(`[AtributosService] Erro ao buscar por ID:`, error);
      return null;
    }
  }

  /**
   * Verifica se nome já existe
   */
  async nomeExiste(tipo: TipoAtributo, nome: string, excluirId?: string): Promise<boolean> {
    try {
      const itens = await this.getAll(tipo);
      const nomeLower = nome.toLowerCase().trim();
      
      return itens.some(item => 
        item.nome.toLowerCase() === nomeLower && 
        (!excluirId || String(item.id) !== String(excluirId))
      );
    } catch (error) {
      console.error(`[AtributosService] Erro ao verificar nome:`, error);
      return false;
    }
  }
}

export const atributosProdutoService = new AtributosProdutoService();
export default atributosProdutoService;
