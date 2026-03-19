/**
 * PrintService.ts
 * Impressão via Bluetooth para impressoras térmicas ESC/POS
 * Requer: react-native-bluetooth-escpos-printer (instalar via npm)
 *
 * npm install react-native-bluetooth-escpos-printer
 * Para Expo: usar expo-dev-client com plugin nativo
 */

import { Alert, Platform } from 'react-native';
import { formatarMoeda }   from '../utils/currency';

// Tipos do comprovante
export interface DadosComprovante {
  empresaNome?:        string;
  empresaTelefone?:    string;
  clienteNome:         string;
  produtoTipo:         string;
  produtoIdentificador:string;
  formaPagamento:      string;
  dataCobranca:        string;
  relogioAnterior?:    number;
  relogioAtual?:       number;
  fichasRodadas?:      number;
  totalBruto?:         number;
  descontoPartidas?:   number;
  descontoDinheiro?:   number;
  percentualEmpresa?:  number;
  valorEmpresaRecebe?: number;
  totalClientePaga:    number;
  valorRecebido?:      number;
  saldoDevedor?:       number;
  troco?:              number;
  observacao?:         string;
}

// Verificar se a biblioteca está disponível
let BLEPrinter: any = null;
let printerAvailable = false;

try {
  // A biblioteca será instalada separadamente
  const lib = require('react-native-bluetooth-escpos-printer');
  BLEPrinter = lib.BluetoothEscposPrinter;
  printerAvailable = true;
} catch {
  console.log('[PrintService] react-native-bluetooth-escpos-printer não instalada');
  printerAvailable = false;
}

// Comandos ESC/POS básicos (fallback manual se necessário)
const ESC  = '\x1B';
const GS   = '\x1D';
const INIT = `${ESC}@`;
const BOLD_ON    = `${ESC}E\x01`;
const BOLD_OFF   = `${ESC}E\x00`;
const CENTER     = `${ESC}a\x01`;
const LEFT       = `${ESC}a\x00`;
const RIGHT      = `${ESC}a\x02`;
const LARGE      = `${GS}!\x11`;
const NORMAL     = `${GS}!\x00`;
const CUT        = `${GS}V\x41\x03`;
const LINE = '-'.repeat(32);
const DLINE = '='.repeat(32);

class PrintServiceClass {
  private isConnected = false;

  /**
   * Verifica se há dispositivos Bluetooth disponíveis
   */
  async getDispositivosPareados(): Promise<{ address: string; name: string }[]> {
    if (!printerAvailable) {
      Alert.alert(
        'Biblioteca não instalada',
        'Para imprimir, instale:\nnpm install react-native-bluetooth-escpos-printer\n\nE use o Expo Dev Client.',
        [{ text: 'OK' }]
      );
      return [];
    }
    try {
      return await BLEPrinter.getDeviceList();
    } catch (e) {
      console.error('[PrintService] Erro ao listar dispositivos:', e);
      return [];
    }
  }

  /**
   * Conectar a uma impressora pelo endereço MAC
   */
  async conectar(address: string): Promise<boolean> {
    if (!printerAvailable) return false;
    try {
      await BLEPrinter.connect(address);
      this.isConnected = true;
      console.log('[PrintService] Conectado:', address);
      return true;
    } catch (e) {
      console.error('[PrintService] Erro ao conectar:', e);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Desconectar
   */
  async desconectar(): Promise<void> {
    if (!printerAvailable || !this.isConnected) return;
    try {
      await BLEPrinter.disconnect();
      this.isConnected = false;
    } catch (e) {
      console.error('[PrintService] Erro ao desconectar:', e);
    }
  }

  /**
   * Formata uma linha com label e valor alinhados
   */
  private linha(label: string, valor: string, largura = 32): string {
    const espacos = largura - label.length - valor.length;
    if (espacos <= 0) return `${label}: ${valor}\n`;
    return `${label}${' '.repeat(espacos)}${valor}\n`;
  }

  /**
   * Gera o texto do comprovante formatado ESC/POS
   */
  gerarTextoComprovante(dados: DadosComprovante): string {
    const empresa = dados.empresaNome || 'Cobrança';
    const dataFmt = (() => {
      try {
        return new Date(dados.dataCobranca).toLocaleString('pt-BR');
      } catch { return dados.dataCobranca; }
    })();

    const formaNome: Record<string, string> = {
      PercentualReceber: '% a Receber',
      PercentualPagar:   '% a Pagar',
      Periodo:           'Período Fixo',
    };

    let txt = '';
    txt += INIT;
    txt += CENTER + LARGE + BOLD_ON + `${empresa}\n` + BOLD_OFF + NORMAL;
    if (dados.empresaTelefone) txt += CENTER + `Tel: ${dados.empresaTelefone}\n`;
    txt += CENTER + `${DLINE}\n`;
    txt += CENTER + BOLD_ON + 'COMPROVANTE DE COBRANÇA\n' + BOLD_OFF;
    txt += CENTER + `${dataFmt}\n`;
    txt += CENTER + `${LINE}\n`;

    txt += LEFT;
    txt += BOLD_ON + `CLIENTE\n` + BOLD_OFF;
    txt += `${dados.clienteNome}\n`;
    txt += `${LINE}\n`;

    txt += BOLD_ON + `PRODUTO\n` + BOLD_OFF;
    txt += `${dados.produtoTipo} N° ${dados.produtoIdentificador}\n`;
    txt += `Pagamento: ${formaNome[dados.formaPagamento] ?? dados.formaPagamento}\n`;
    txt += `${LINE}\n`;

    // Relógio (só se tiver)
    if (dados.fichasRodadas !== undefined) {
      txt += BOLD_ON + `LEITURA\n` + BOLD_OFF;
      if (dados.relogioAnterior !== undefined)
        txt += this.linha('Anterior', String(dados.relogioAnterior));
      if (dados.relogioAtual !== undefined)
        txt += this.linha('Atual', String(dados.relogioAtual));
      txt += this.linha('Fichas rodadas', String(dados.fichasRodadas));
      txt += `${LINE}\n`;
    }

    // Valores
    txt += BOLD_ON + `VALORES\n` + BOLD_OFF;
    if (dados.totalBruto) txt += this.linha('Total Bruto', formatarMoeda(dados.totalBruto));
    if (dados.descontoPartidas && dados.descontoPartidas > 0)
      txt += this.linha('- Desc. Partidas', formatarMoeda(dados.descontoPartidas));
    if (dados.descontoDinheiro && dados.descontoDinheiro > 0)
      txt += this.linha('- Desc. Dinheiro', formatarMoeda(dados.descontoDinheiro));
    if (dados.percentualEmpresa && dados.valorEmpresaRecebe !== undefined)
      txt += this.linha(`Empresa (${dados.percentualEmpresa}%)`, formatarMoeda(dados.valorEmpresaRecebe));
    txt += `${LINE}\n`;

    txt += BOLD_ON + LARGE;
    txt += this.linha('TOTAL', formatarMoeda(dados.totalClientePaga));
    txt += NORMAL + BOLD_OFF;

    if (dados.valorRecebido !== undefined && dados.valorRecebido > 0)
      txt += this.linha('Recebido', formatarMoeda(dados.valorRecebido));
    if (dados.troco && dados.troco > 0)
      txt += this.linha('Troco', formatarMoeda(dados.troco));
    if (dados.saldoDevedor && dados.saldoDevedor > 0) {
      txt += `${LINE}\n`;
      txt += BOLD_ON + this.linha('SALDO DEVEDOR', formatarMoeda(dados.saldoDevedor)) + BOLD_OFF;
    }

    if (dados.observacao) {
      txt += `${LINE}\n`;
      txt += `Obs: ${dados.observacao}\n`;
    }

    txt += `${DLINE}\n`;
    txt += CENTER + `Obrigado!\n\n\n`;
    txt += CUT;
    return txt;
  }

  /**
   * Imprimir comprovante — método principal
   */
  async imprimirComprovante(dados: DadosComprovante): Promise<boolean> {
    if (!printerAvailable) {
      // Mostrar preview em modo debug
      this.mostrarPreview(dados);
      return false;
    }

    if (!this.isConnected) {
      // Tentar reconectar com último dispositivo salvo
      const dispositivos = await this.getDispositivosPareados();
      if (dispositivos.length === 0) {
        Alert.alert('Impressora', 'Nenhuma impressora Bluetooth pareada encontrada.\nPareie a impressora nas configurações do Android.');
        return false;
      }
      if (dispositivos.length === 1) {
        const ok = await this.conectar(dispositivos[0].address);
        if (!ok) {
          Alert.alert('Erro', 'Não foi possível conectar à impressora. Verifique se está ligada.');
          return false;
        }
      } else {
        // Mostrar seleção (simplificado)
        Alert.alert(
          'Selecionar impressora',
          dispositivos.map((d, i) => `${i+1}. ${d.name}`).join('\n'),
          dispositivos.slice(0, 3).map((d, i) => ({
            text: d.name,
            onPress: () => this.conectarEImprimir(d.address, dados),
          }))
        );
        return false;
      }
    }

    return this.enviarParaImpressora(dados);
  }

  private async conectarEImprimir(address: string, dados: DadosComprovante): Promise<void> {
    const ok = await this.conectar(address);
    if (ok) await this.enviarParaImpressora(dados);
  }

  private async enviarParaImpressora(dados: DadosComprovante): Promise<boolean> {
    try {
      const texto = this.gerarTextoComprovante(dados);
      await BLEPrinter.printerText(texto, {
        encoding: 'GBK',
        codepage: 0,
        widthtimes: 0,
        heigthtimes: 0,
        fonttype: 1,
      });
      return true;
    } catch (e: any) {
      console.error('[PrintService] Erro ao imprimir:', e);
      Alert.alert('Erro ao imprimir', e?.message || 'Verifique a conexão com a impressora');
      return false;
    }
  }

  /**
   * Preview do comprovante (quando sem impressora)
   */
  mostrarPreview(dados: DadosComprovante): void {
    const empresa = dados.empresaNome || 'Cobrança';
    const dataFmt = new Date(dados.dataCobranca).toLocaleString('pt-BR');
    const linhas = [
      `${empresa}`,
      `${dataFmt}`,
      `------------------------`,
      `Cliente: ${dados.clienteNome}`,
      `Produto: ${dados.produtoTipo} N°${dados.produtoIdentificador}`,
      dados.fichasRodadas !== undefined ? `Fichas: ${dados.fichasRodadas}` : null,
      `------------------------`,
      dados.totalBruto ? `Bruto: ${formatarMoeda(dados.totalBruto)}` : null,
      `TOTAL: ${formatarMoeda(dados.totalClientePaga)}`,
      dados.valorRecebido ? `Recebido: ${formatarMoeda(dados.valorRecebido)}` : null,
      dados.troco && dados.troco > 0 ? `Troco: ${formatarMoeda(dados.troco)}` : null,
      dados.saldoDevedor && dados.saldoDevedor > 0 ? `SALDO DEVEDOR: ${formatarMoeda(dados.saldoDevedor)}` : null,
    ].filter(Boolean).join('\n');

    Alert.alert('Preview do Comprovante', linhas, [
      { text: 'Fechar' },
    ]);
  }
}

export const printService = new PrintServiceClass();
export default printService;
