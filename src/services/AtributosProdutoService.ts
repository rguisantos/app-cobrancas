/**
 * AtributosProdutoService.ts
 * Serviço para gerenciar atributos de produto (Tipos, Descrições, Tamanhos)
 * Persistência local usando SQLite (DatabaseService)
 */

import { databaseService } from './DatabaseService';

// Tipos
export type TipoAtributo = 'tipo' | 'descricao' | 'tamanho';

export interface AtributoItem {
  id: string | number;
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
      const novoId = `novo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const novoItem: AtributoItem = {
        id: novoId,
        nome: nome.trim(),
      };
      
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
      
      console.log(`[AtributosService] Item adicionado em ${tipo}:`, nome);
      return novoItem;
    } catch (error) {
      console.error(`[AtributosService] Erro ao adicionar ${tipo}:`, error);
      throw error;
    }
  }

  /**
   * Atualiza um item existente
   */
  async atualizar(tipo: TipoAtributo, id: string | number, novoNome: string): Promise<AtributoItem | null> {
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
  async remover(tipo: TipoAtributo, id: string | number): Promise<boolean> {
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
  async getById(tipo: TipoAtributo, id: string | number): Promise<AtributoItem | null> {
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
  async nomeExiste(tipo: TipoAtributo, nome: string, excluirId?: string | number): Promise<boolean> {
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
