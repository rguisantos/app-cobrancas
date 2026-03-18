/**
 * AtributosRepository.ts
 * Repositório para Tipos, Descrições e Tamanhos de Produto
 * Persistência local usando SQLite (DatabaseService)
 */

import { databaseService } from '../services/DatabaseService';

// Tipos
export interface AtributoItem {
  id: string;
  nome: string;
}

type TipoAtributo = 'tipo' | 'descricao' | 'tamanho' | 'estabelecimento';

class AtributosRepository {
  /**
   * Inicializa dados padrão se não existirem
   */
  async inicializar(): Promise<void> {
    try {
      await databaseService.inicializarAtributosPadrao();
      console.log('[AtributosRepository] Atributos inicializados');
    } catch (error) {
      console.error('[AtributosRepository] Erro ao inicializar:', error);
    }
  }

  /**
   * Buscar todos os tipos de produto
   */
  async getTipos(): Promise<AtributoItem[]> {
    return databaseService.getTiposProduto();
  }

  /**
   * Buscar todas as descrições de produto
   */
  async getDescricoes(): Promise<AtributoItem[]> {
    return databaseService.getDescricoesProduto();
  }

  /**
   * Buscar todos os tamanhos de produto
   */
  async getTamanhos(): Promise<AtributoItem[]> {
    return databaseService.getTamanhosProduto();
  }

  /**
   * Buscar todos os itens de um tipo específico
   */
  async getAll(tipo: TipoAtributo): Promise<AtributoItem[]> {
    switch (tipo) {
      case 'tipo':
        return this.getTipos();
      case 'descricao':
        return this.getDescricoes();
      case 'tamanho':
        return this.getTamanhos();
      case 'estabelecimento':
        return this.getEstabelecimentos();
    }
  }

  /**
   * Salvar tipos de produto
   */
  async salvarTipos(itens: AtributoItem[]): Promise<void> {
    for (const item of itens) {
      await databaseService.saveTipoProduto(item.id, item.nome);
    }
    console.log(`[AtributosRepository] ${itens.length} tipos salvos`);
  }

  /**
   * Salvar descrições de produto
   */
  async salvarDescricoes(itens: AtributoItem[]): Promise<void> {
    for (const item of itens) {
      await databaseService.saveDescricaoProduto(item.id, item.nome);
    }
    console.log(`[AtributosRepository] ${itens.length} descrições salvas`);
  }

  /**
   * Salvar tamanhos de produto
   */
  async salvarTamanhos(itens: AtributoItem[]): Promise<void> {
    for (const item of itens) {
      await databaseService.saveTamanhoProduto(item.id, item.nome);
    }
    console.log(`[AtributosRepository] ${itens.length} tamanhos salvos`);
  }

  /**
   * Adicionar item
   */
  async adicionar(tipo: TipoAtributo, nome: string): Promise<AtributoItem> {
    const novoId = `novo_${Date.now()}`;
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
      case 'estabelecimento':
        await databaseService.saveEstabelecimento(novoId, nome);
        break;
    }

    console.log(`[AtributosRepository] Item adicionado em ${tipo}:`, nome);
    return novoItem;
  }

  /**
   * Atualizar item
   */
  async atualizar(
    tipo: TipoAtributo,
    id: string,
    nome: string
  ): Promise<boolean> {
    try {
      switch (tipo) {
        case 'tipo':
          await databaseService.saveTipoProduto(id, nome);
          break;
        case 'descricao':
          await databaseService.saveDescricaoProduto(id, nome);
          break;
        case 'tamanho':
          await databaseService.saveTamanhoProduto(id, nome);
          break;
        case 'estabelecimento':
          await databaseService.saveEstabelecimento(id, nome);
          break;
      }

      console.log(`[AtributosRepository] Item atualizado em ${tipo}:`, nome);
      return true;
    } catch (error) {
      console.error(`[AtributosRepository] Erro ao atualizar ${tipo}:`, error);
      return false;
    }
  }

  /**
   * Remover item (soft delete)
   */
  async remover(tipo: TipoAtributo, id: string): Promise<boolean> {
    try {
      switch (tipo) {
        case 'tipo':
          await databaseService.deleteTipoProduto(id);
          break;
        case 'descricao':
          await databaseService.deleteDescricaoProduto(id);
          break;
        case 'tamanho':
          await databaseService.deleteTamanhoProduto(id);
          break;
        case 'estabelecimento':
          await databaseService.deleteEstabelecimento(id);
          break;
      }

      console.log(`[AtributosRepository] Item removido de ${tipo}:`, id);
      return true;
    } catch (error) {
      console.error(`[AtributosRepository] Erro ao remover ${tipo}:`, error);
      return false;
    }
  }

  /**
   * Buscar por ID
   */
  async getById(tipo: TipoAtributo, id: string): Promise<AtributoItem | null> {
    const itens = await this.getAll(tipo);
    return itens.find(item => item.id === id) || null;
  }

  /**
   * Verificar se nome já existe
   */
  async nomeExiste(tipo: TipoAtributo, nome: string, excludeId?: string): Promise<boolean> {
    const itens = await this.getAll(tipo);
    const nomeLower = nome.toLowerCase().trim();
    
    return itens.some(item => 
      item.nome.toLowerCase() === nomeLower && item.id !== excludeId
    );
  }

  async getEstabelecimentos(): Promise<AtributoItem[]> {
    return databaseService.getEstabelecimentos();
  }

  async salvarEstabelecimentos(itens: AtributoItem[]): Promise<void> {
    for (const item of itens) {
      await databaseService.saveEstabelecimento(item.id, item.nome);
    }
  }

  async salvarEstabelecimento(item: AtributoItem): Promise<void> {
    await databaseService.saveEstabelecimento(item.id, item.nome);
  }

  async deleteEstabelecimento(id: string): Promise<void> {
    await databaseService.deleteEstabelecimento(id);
  }
}

const atributosRepository = new AtributosRepository();
export default atributosRepository;