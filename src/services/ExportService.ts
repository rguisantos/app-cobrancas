/**
 * ExportService.ts
 * Serviço de exportação CSV para o mobile
 *
 * Gera arquivos CSV a partir de dados e permite compartilhar
 * usando expo-share / expo-file-system.
 *
 * Uso:
 * import ExportService from '../services/ExportService';
 * await ExportService.exportCSV(clientes, 'clientes', columns)
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { formatarMoeda } from '@cobrancas/shared';

// ============================================================================
// TYPES
// ============================================================================

export interface CSVColumn<T = any> {
  /** Chave do objeto */
  key: keyof T;
  /** Header da coluna */
  header: string;
  /** Função de formatação opcional */
  format?: (value: any, row: T) => string;
}

export interface ExportOptions<T = any> {
  /** Dados a exportar */
  data: T[];
  /** Nome do arquivo (sem extensão) */
  filename: string;
  /** Colunas a incluir */
  columns: CSVColumn<T>[];
  /** Título do documento (adicionado como primeira linha) */
  title?: string;
  /** Se deve compartilhar após gerar */
  share?: boolean;
}

// ============================================================================
// SERVICE
// ============================================================================

class ExportService {
  /**
   * Gera CSV a partir de dados e colunas
   */
  generateCSV<T extends Record<string, any>>(
    data: T[],
    columns: CSVColumn<T>[]
  ): string {
    const lines: string[] = [];

    // Header
    const headers = columns.map(col => this.escapeCSV(String(col.header)));
    lines.push(headers.join(';'));

    // Dados
    for (const row of data) {
      const values = columns.map(col => {
        const rawValue = row[col.key];
        if (col.format) {
          return this.escapeCSV(col.format(rawValue, row));
        }
        return this.escapeCSV(this.formatValue(rawValue));
      });
      lines.push(values.join(';'));
    }

    return lines.join('\n');
  }

  /**
   * Exporta dados como CSV e compartilha o arquivo
   */
  async exportCSV<T extends Record<string, any>>(
    data: T[],
    filename: string,
    columns: CSVColumn<T>[],
    options?: { title?: string; share?: boolean }
  ): Promise<string | null> {
    try {
      let csv = '';

      // Adicionar título se fornecido
      if (options?.title) {
        csv += `${options.title}\n\n`;
      }

      // Adicionar metadata
      csv += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n`;
      csv += `Total de registros: ${data.length}\n\n`;

      // Gerar CSV
      csv += this.generateCSV(data, columns);

      // BOM para Excel reconhecer UTF-8
      const bom = '\uFEFF';
      const csvWithBom = bom + csv;

      // Salvar arquivo
      const filePath = `${FileSystem.cacheDirectory}${filename}_${this.getDateStamp()}.csv`;
      await FileSystem.writeAsStringAsync(filePath, csvWithBom, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Compartilhar
      if (options?.share !== false) {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(filePath, {
            mimeType: 'text/csv',
            dialogTitle: `Exportar ${filename}`,
          });
        }
      }

      return filePath;
    } catch (error) {
      console.error('[Export] Erro ao exportar CSV:', error);
      return null;
    }
  }

  /**
   * Formata valor para exibição no CSV
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (value instanceof Date) return value.toLocaleDateString('pt-BR');
    if (typeof value === 'number') {
      // Detectar se é valor monetário (heurística simples)
      return String(value);
    }
    return String(value);
  }

  /**
   * Escapa valor CSV (lida com separadores, aspas e quebras de linha)
   */
  private escapeCSV(value: string): string {
    if (!value) return '';
    // Se contém ;, " ou quebra de linha, envolver em aspas
    if (value.includes(';') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Gera timestamp para nome do arquivo
   */
  private getDateStamp(): string {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  }

  // ============================================================================
  // PRESETS — Colunas prontas para cada entidade
  // ============================================================================

  static readonly CLIENTE_COLUMNS: CSVColumn<any>[] = [
    { key: 'identificador', header: 'Identificador' },
    { key: 'nomeExibicao', header: 'Nome' },
    { key: 'cpfCnpj', header: 'CPF/CNPJ' },
    { key: 'telefonePrincipal', header: 'Telefone' },
    { key: 'email', header: 'E-mail' },
    { key: 'cidade', header: 'Cidade' },
    { key: 'estado', header: 'Estado' },
    { key: 'rotaNome', header: 'Rota' },
    { key: 'status', header: 'Status' },
  ];

  static readonly PRODUTO_COLUMNS: CSVColumn<any>[] = [
    { key: 'identificador', header: 'Identificador' },
    { key: 'tipoNome', header: 'Tipo' },
    { key: 'descricaoNome', header: 'Descrição' },
    { key: 'tamanhoNome', header: 'Tamanho' },
    { key: 'numeroRelogio', header: 'Relógio' },
    { key: 'conservacao', header: 'Conservação' },
    { key: 'statusProduto', header: 'Status' },
    { key: 'estabelecimento', header: 'Estabelecimento' },
  ];

  static readonly COBRANCA_COLUMNS: CSVColumn<any>[] = [
    { key: 'clienteNome', header: 'Cliente' },
    { key: 'produtoIdentificador', header: 'Produto' },
    { key: 'dataInicio', header: 'Data Início' },
    { key: 'dataFim', header: 'Data Fim' },
    { key: 'fichasRodadas', header: 'Fichas' },
    { key: 'totalBruto', header: 'Total Bruto', format: (v: number) => formatarMoeda(v) },
    { key: 'totalClientePaga', header: 'Cliente Paga', format: (v: number) => formatarMoeda(v) },
    { key: 'valorRecebido', header: 'Valor Recebido', format: (v: number) => formatarMoeda(v) },
    { key: 'saldoDevedorGerado', header: 'Saldo Devedor', format: (v: number) => formatarMoeda(v) },
    { key: 'status', header: 'Status' },
  ];

  static readonly LOCACAO_COLUMNS: CSVColumn<any>[] = [
    { key: 'clienteNome', header: 'Cliente' },
    { key: 'produtoIdentificador', header: 'Produto' },
    { key: 'formaPagamento', header: 'Forma Pagamento' },
    { key: 'dataLocacao', header: 'Data Locação' },
    { key: 'status', header: 'Status' },
  ];

  static readonly MANUTENCAO_COLUMNS: CSVColumn<any>[] = [
    { key: 'produtoIdentificador', header: 'Produto' },
    { key: 'tipo', header: 'Tipo' },
    { key: 'descricao', header: 'Descrição' },
    { key: 'data', header: 'Data' },
    { key: 'clienteNome', header: 'Cliente' },
  ];
}

export default new ExportService();
