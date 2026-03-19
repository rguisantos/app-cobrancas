/**
 * PrintService.ts
 * Impressão via Bluetooth para impressoras térmicas ESC/POS
 *
 * INSTALAÇÃO (quando pronto para produção):
 *   npm install react-native-bluetooth-escpos-printer
 *   + Expo Dev Client com plugin nativo
 *
 * Enquanto a biblioteca não estiver instalada, o serviço exibe
 * um preview do comprovante em Alert.
 */

import { Alert } from 'react-native';
import { formatarMoeda } from '../utils/currency';

export interface DadosComprovante {
  empresaNome?:         string;
  empresaTelefone?:     string;
  clienteNome:          string;
  produtoTipo:          string;
  produtoIdentificador: string;
  formaPagamento:       string;
  dataCobranca:         string;
  relogioAnterior?:     number;
  relogioAtual?:        number;
  fichasRodadas?:       number;
  totalBruto?:          number;
  descontoPartidas?:    number;
  descontoDinheiro?:    number;
  percentualEmpresa?:   number;
  valorEmpresaRecebe?:  number;
  totalClientePaga:     number;
  valorRecebido?:       number;
  saldoDevedor?:        number;
  troco?:               number;
  observacao?:          string;
}

class PrintServiceClass {
  private isConnected = false;
  private printerAddress: string | null = null;

  /** Carrega a biblioteca somente quando necessário (evita crash no bundle) */
  private async getBLEPrinter(): Promise<any | null> {
    try {
      const lib = require('react-native-bluetooth-escpos-printer');
      return lib.BluetoothEscposPrinter ?? null;
    } catch {
      return null;
    }
  }

  async getDispositivosPareados(): Promise<{ address: string; name: string }[]> {
    const BLE = await this.getBLEPrinter();
    if (!BLE) return [];
    try {
      return await BLE.getDeviceList();
    } catch {
      return [];
    }
  }

  async conectar(address: string): Promise<boolean> {
    const BLE = await this.getBLEPrinter();
    if (!BLE) return false;
    try {
      await BLE.connect(address);
      this.isConnected = true;
      this.printerAddress = address;
      return true;
    } catch {
      this.isConnected = false;
      return false;
    }
  }

  private linha(label: string, valor: string, largura = 32): string {
    const esp = largura - label.length - valor.length;
    return `${label}${esp > 0 ? ' '.repeat(esp) : ' '}${valor}\n`;
  }

  gerarTexto(dados: DadosComprovante): string {
    const empresa = dados.empresaNome || 'Cobrança';
    const dataFmt = (() => {
      try { return new Date(dados.dataCobranca).toLocaleString('pt-BR'); }
      catch { return dados.dataCobranca; }
    })();
    const formaNome: Record<string, string> = {
      PercentualReceber: '% a Receber',
      PercentualPagar:   '% a Pagar',
      Periodo:           'Período Fixo',
    };
    const SEP  = '-'.repeat(32);
    const SEP2 = '='.repeat(32);
    let t = '';
    t += `\x1B@`;                          // init
    t += `\x1Ba\x01\x1BE\x01`;             // center + bold
    t += `${empresa}\n`;
    t += `\x1BE\x00\x1Ba\x01`;             // bold off, still center
    if (dados.empresaTelefone) t += `${dados.empresaTelefone}\n`;
    t += `${SEP2}\n`;
    t += `COMPROVANTE DE COBRANÇA\n`;
    t += `${dataFmt}\n`;
    t += `\x1Ba\x00`;                      // left
    t += `${SEP}\n`;
    t += `\x1BE\x01CLIENTE\x1BE\x00\n`;
    t += `${dados.clienteNome}\n`;
    t += `${SEP}\n`;
    t += `\x1BE\x01PRODUTO\x1BE\x00\n`;
    t += `${dados.produtoTipo} N° ${dados.produtoIdentificador}\n`;
    t += `Forma: ${formaNome[dados.formaPagamento] ?? dados.formaPagamento}\n`;
    if (dados.fichasRodadas !== undefined) {
      t += `${SEP}\n`;
      if (dados.relogioAnterior) t += this.linha('Relógio Ant.', String(dados.relogioAnterior));
      if (dados.relogioAtual)    t += this.linha('Relógio Atu.', String(dados.relogioAtual));
      t += this.linha('Fichas', String(dados.fichasRodadas));
    }
    t += `${SEP}\n`;
    if (dados.totalBruto) t += this.linha('Total Bruto', formatarMoeda(dados.totalBruto));
    if (dados.descontoPartidas && dados.descontoPartidas > 0)
      t += this.linha('- Desc. Partidas', formatarMoeda(dados.descontoPartidas));
    if (dados.descontoDinheiro && dados.descontoDinheiro > 0)
      t += this.linha('- Desc. Dinheiro', formatarMoeda(dados.descontoDinheiro));
    if (dados.percentualEmpresa && dados.valorEmpresaRecebe !== undefined)
      t += this.linha(`Empresa(${dados.percentualEmpresa}%)`, formatarMoeda(dados.valorEmpresaRecebe));
    t += `${SEP}\n`;
    t += `\x1BE\x01\x1D!\x11`;             // bold + double size
    t += this.linha('TOTAL', formatarMoeda(dados.totalClientePaga));
    t += `\x1D!\x00\x1BE\x00`;             // normal
    if (dados.valorRecebido && dados.valorRecebido > 0)
      t += this.linha('Recebido', formatarMoeda(dados.valorRecebido));
    if (dados.troco && dados.troco > 0)
      t += this.linha('Troco', formatarMoeda(dados.troco));
    if (dados.saldoDevedor && dados.saldoDevedor > 0) {
      t += `${SEP}\n`;
      t += `\x1BE\x01` + this.linha('SALDO DEVEDOR', formatarMoeda(dados.saldoDevedor)) + `\x1BE\x00`;
    }
    if (dados.observacao) { t += `${SEP}\nObs: ${dados.observacao}\n`; }
    t += `${SEP2}\n`;
    t += `\x1Ba\x01Obrigado!\n\n\n`;
    t += `\x1DV\x41\x03`;                  // cut
    return t;
  }

  mostrarPreview(dados: DadosComprovante): void {
    const linhas = [
      `${dados.empresaNome || 'Cobrança'}`,
      new Date(dados.dataCobranca).toLocaleString('pt-BR'),
      `--------------------------------`,
      `Cliente: ${dados.clienteNome}`,
      `Produto: ${dados.produtoTipo} N°${dados.produtoIdentificador}`,
      dados.fichasRodadas !== undefined ? `Fichas: ${dados.fichasRodadas}` : null,
      `--------------------------------`,
      dados.totalBruto ? `Bruto: ${formatarMoeda(dados.totalBruto)}` : null,
      `TOTAL: ${formatarMoeda(dados.totalClientePaga)}`,
      dados.valorRecebido && dados.valorRecebido > 0 ? `Recebido: ${formatarMoeda(dados.valorRecebido)}` : null,
      dados.troco && dados.troco > 0 ? `Troco: ${formatarMoeda(dados.troco)}` : null,
      dados.saldoDevedor && dados.saldoDevedor > 0 ? `SALDO DEVEDOR: ${formatarMoeda(dados.saldoDevedor)}` : null,
    ].filter(Boolean).join('\n');
    Alert.alert('Preview do Comprovante', linhas, [{ text: 'Fechar' }]);
  }

  async imprimirComprovante(dados: DadosComprovante): Promise<boolean> {
    const BLE = await this.getBLEPrinter();
    if (!BLE) {
      this.mostrarPreview(dados);
      return false;
    }
    if (!this.isConnected) {
      const dispositivos = await this.getDispositivosPareados();
      if (dispositivos.length === 0) {
        Alert.alert('Impressora', 'Nenhuma impressora Bluetooth pareada.\nPareie a impressora nas configurações do Android.');
        return false;
      }
      const ok = await this.conectar(dispositivos[0].address);
      if (!ok) { Alert.alert('Erro', 'Não foi possível conectar à impressora.'); return false; }
    }
    try {
      await BLE.printerText(this.gerarTexto(dados), {
        encoding: 'GBK', codepage: 0, widthtimes: 0, heigthtimes: 0, fonttype: 1,
      });
      return true;
    } catch (e: any) {
      Alert.alert('Erro ao imprimir', e?.message || 'Verifique a conexão com a impressora');
      return false;
    }
  }
}

export const printService = new PrintServiceClass();
export default printService;
