/**
 * CobrancaService.ts
 * Serviço de cálculos e regras de negócio para Cobranças
 * Baseado nas telas de cobrança do aplicativo
 */

import { 
  Locacao, 
  HistoricoCobranca,
  ModalidadeCobranca,
  FormaPagamentoLocacao
} from '../types';

// ============================================================================
// INTERFACES E TIPOS
// ============================================================================

export interface CalculoCobrancaInput {
  // Leitura do contador
  relogioAnterior: number;
  relogioAtual: number;
  
  // Valor da ficha
  valorFicha: number;
  
  // Percentual da empresa
  percentualEmpresa: number;
  
  // Descontos
  descontoPartidasQtd?: number; // Quantidade de fichas de desconto
  descontoDinheiro?: number;    // Valor em R$ de desconto
  bonificacao?: number;         // Bonificação extra (PercentualPagar: soma ao cliente)
  
  // Para cobrança por período (valor fixo)
  valorFixo?: number;
  formaPagamento: FormaPagamentoLocacao;
}

export interface CalculoCobrancaOutput {
  // Dados do contador
  fichasRodadas: number;
  
  // Cálculos intermediários
  totalBruto: number;
  subtotalAposDescontoPartidas: number;
  subtotalAposDescontoDinheiro: number;
  
  // Descontos aplicados
  descontoPartidasValor: number;
  descontoDinheiroValor: number;
    // Percentual
  valorPercentual: number;
  
  // Totais
  totalClientePaga: number;
  valorEmpresaRecebe: number;
  valorClienteFica: number;
  
  // Resumo
  resumo: string;
}

export interface CobrancaValidacao {
  valida: boolean;
  erros: string[];
  avisos: string[];
}

// ============================================================================
// CLASSE COBRANCA SERVICE
// ============================================================================

class CobrancaService {
  // ==========================================================================
  // CÁLCULOS PRINCIPAIS
  // ==========================================================================

  /**
   * Realiza todos os cálculos de uma cobrança
   * Baseado nas telas de cobrança do app
   */
  calcularCobranca(input: CalculoCobrancaInput): CalculoCobrancaOutput {
    // 1. Calcular fichas rodadas
    const fichasRodadas = Math.max(0, input.relogioAtual - input.relogioAnterior);

    // 2. Calcular total bruto (fichas × valor da ficha)
    const totalBruto = this.arredondar(fichasRodadas * input.valorFicha);

    // 3. Aplicar desconto em partidas (fichas)
    const descontoPartidasQtd = input.descontoPartidasQtd || 0;
    const descontoPartidasValor = this.arredondar(descontoPartidasQtd * input.valorFicha);
    const subtotalAposDescontoPartidas = this.arredondar(totalBruto - descontoPartidasValor);

    const descontoDinheiroValor = input.descontoDinheiro || 0;
    const bonificacaoValor      = input.bonificacao      || 0;
    const forma = input.formaPagamento;

    let subtotalAposDescontoDinheiro: number;
    let valorPercentual: number;
    let totalClientePaga: number;
    let valorEmpresaRecebe: number;
    let valorClienteFica: number;

    if (forma === 'PercentualPagar') {
      // EMPRESA PAGA X% ao cliente
      // descDinheiro reduz a base antes do cálculo do %
      subtotalAposDescontoDinheiro = this.arredondar(
        Math.max(0, subtotalAposDescontoPartidas - descontoDinheiroValor)
      );
      // % que empresa paga ao cliente
      valorPercentual = this.arredondar(
        (subtotalAposDescontoDinheiro * input.percentualEmpresa) / 100
      );
      // Bonificação extra que empresa paga ao cliente
      totalClientePaga  = this.arredondar(valorPercentual + bonificacaoValor);
      valorEmpresaRecebe = this.arredondar(subtotalAposDescontoDinheiro - totalClientePaga);
      valorClienteFica  = totalClientePaga;
    } else {
      // EMPRESA RECEBE X% do cliente (PercentualReceber)
      // descDinheiro reduz a parcela da empresa (não a base do cliente)
      subtotalAposDescontoDinheiro = subtotalAposDescontoPartidas; // base não muda para cliente
      const valorEmpresaBase = this.arredondar(
        (subtotalAposDescontoPartidas * input.percentualEmpresa) / 100
      );
      // descDinheiro sai da parte da empresa
      valorPercentual    = this.arredondar(Math.max(0, valorEmpresaBase - descontoDinheiroValor));
      totalClientePaga   = valorPercentual; // cliente paga o que empresa recebe
      valorEmpresaRecebe = valorPercentual;
      valorClienteFica   = this.arredondar(subtotalAposDescontoPartidas - valorEmpresaBase);
    }

    // 7. Gerar resumo para exibição
    const resumo = this.gerarResumoCobranca({
      ...input,
      fichasRodadas,
      totalBruto,
      descontoPartidasValor,
      descontoDinheiroValor,
      valorPercentual,
      totalClientePaga,
    });

    return {
      fichasRodadas,
      totalBruto,
      subtotalAposDescontoPartidas,
      subtotalAposDescontoDinheiro,
      descontoPartidasValor,
      descontoDinheiroValor,
      bonificacaoValor,
      valorPercentual,
      totalClientePaga,
      valorEmpresaRecebe,
      valorClienteFica,
      resumo,
    };

  }

  /**
   * Calcula cobrança por período (valor fixo)
   */
  calcularCobrancaPeriodo(
    valorFixo: number,
    periodicidade: string,
    descontoDinheiro?: number
  ): CalculoCobrancaOutput {
    const desconto = descontoDinheiro || 0;
    const totalClientePaga = this.arredondar(Math.max(0, valorFixo - desconto));

    return {
      fichasRodadas: 0,
      totalBruto: valorFixo,
      subtotalAposDescontoPartidas: valorFixo,      subtotalAposDescontoDinheiro: totalClientePaga,
      descontoPartidasValor: 0,
      descontoDinheiroValor: desconto,
      valorPercentual: 0,
      totalClientePaga,
      valorEmpresaRecebe: totalClientePaga,
      valorClienteFica: 0,
      resumo: `Cobrança por ${periodicidade}: ${this.formatarMoeda(valorFixo)} - Desconto: ${this.formatarMoeda(desconto)}`,
    };

  }

  // ==========================================================================
  // VALIDAÇÕES
  // ==========================================================================

  /**
   * Valida dados de cobrança antes de registrar
   */
  validarCobranca(input: CalculoCobrancaInput): CobrancaValidacao {
    const erros: string[] = [];
    const avisos: string[] = [];

    // 1. Validar relógio
    if (input.relogioAtual < input.relogioAnterior) {
      erros.push('Relógio atual não pode ser menor que o anterior');
  
  }

    if (input.relogioAtual === input.relogioAnterior) {
      avisos.push('Relógio não teve alteração. Deseja continuar?');
  
  }

    // 2. Validar valor da ficha
    if (input.valorFicha <= 0 && input.formaPagamento !== 'Periodo') {
      erros.push('Valor da ficha deve ser maior que zero');
  
  }

    // 3. Validar percentual
    if (input.percentualEmpresa < 0 || input.percentualEmpresa > 100) {
      erros.push('Percentual da empresa deve estar entre 0 e 100');
  
  }

    // 4. Validar descontos
    const descontoPartidasQtd = input.descontoPartidasQtd || 0;
    const descontoDinheiro = input.descontoDinheiro || 0;

    if (descontoPartidasQtd < 0) {
      erros.push('Desconto em partidas não pode ser negativo');
  
  }

    if (descontoDinheiro < 0) {      erros.push('Desconto em dinheiro não pode ser negativo');
  
  }

    // 5. Calcular e verificar se total não fica negativo
    const calculo = this.calcularCobranca(input);
    
    if (calculo.totalClientePaga <= 0) {
      erros.push('Total a pagar não pode ser zero ou negativo');
  
  }

    if (calculo.totalClientePaga < 1) {
      avisos.push('Valor muito baixo. Verifique se os cálculos estão corretos');
  
  }

    // 6. Verificar desconto muito alto
    const totalBruto = calculo.totalBruto;
    const totalDescontos = calculo.descontoPartidasValor + calculo.descontoDinheiroValor;
    
    if (totalDescontos > totalBruto * 0.5) {
      avisos.push('Descontos representam mais de 50% do total. Verifique se está correto');
  
  }

    return {
      valida: erros.length === 0,
      erros,
      avisos,
    };

  }

  /**
   * Valida leitura do relógio (impede regressão)
   */
  validarLeituraRelogio(atual: number, anterior: number): {
    valida: boolean;
    mensagem?: string;
  }
    {
    if (atual < anterior) {
      return {
        valida: false,
        mensagem: 'Leitura atual não pode ser menor que a anterior. Verifique se o relógio foi reiniciado ou trocado.',
      };
  
  }

    if (atual === anterior) {
      return {
        valida: true,
        mensagem: 'Relógio sem alteração. Cobrança será de R$ 0,00.',
      };
  
  }
    // Verificar se a diferença é muito grande (possível erro de digitação)
    const diferenca = atual - anterior;
    if (diferenca > 100000) {
      return {
        valida: true,
        mensagem: `Diferença muito grande (${diferenca} fichas). Verifique se a leitura está correta.`,
      };
  
  }

    return {
      valida: true,
      mensagem: undefined,
    };

  }

  // ==========================================================================
  // CÁLCULOS AUXILIARES
  // ==========================================================================

  /**
   * Calcula saldo devedor
   */
  calcularSaldoDevedor(totalPagar: number, valorRecebido: number): number {
    return this.arredondar(Math.max(0, totalPagar - valorRecebido));

  }

  /**
   * Calcula valor que o cliente (estabelecimento) fica
   */
  calcularValorCliente(totalClientePaga: number, percentualEmpresa: number): number {
    const valorEmpresa = (totalClientePaga * percentualEmpresa) / 100;
    return this.arredondar(totalClientePaga - valorEmpresa);

  }

  /**
   * Calcula valor que a empresa recebe
   */
  calcularValorEmpresa(totalClientePaga: number, percentualEmpresa: number): number {
    return this.arredondar((totalClientePaga * percentualEmpresa) / 100);

  }

  /**
   * Calcula desconto em partidas convertido para valor
   */
  calcularDescontoPartidas(qtdPartidas: number, valorFicha: number): number {
    return this.arredondar(qtdPartidas * valorFicha);

  }

  /**
   * Aplica desconto no total   */
  aplicarDesconto(total: number, desconto: number): number {
    return this.arredondar(Math.max(0, total - desconto));

  }

  // ==========================================================================
  // UTILITÁRIOS
  // ==========================================================================

  /**
   * Arredonda valor para 2 casas decimais
   */
  private arredondar(valor: number): number {
    return Math.round(valor * 100) / 100;

  }

  /**
   * Formata valor para moeda brasileira
   */
  formatarMoeda(valor: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);

  }

  /**
   * Formata número inteiro com separador de milhar
   */
  formatarNumero(valor: number): string {
    return new Intl.NumberFormat('pt-BR').format(valor);

  }

  /**
   * Gera resumo da cobrança para exibição
   */
  private gerarResumoCobranca(calculo: CalculoCobrancaInput & {
    fichasRodadas: number;
    totalBruto: number;
    descontoPartidasValor: number;
    descontoDinheiroValor: number;
    valorPercentual: number;
    totalClientePaga: number;
  }): string {
    const partes: string[] = [];

    partes.push(`${this.formatarNumero(calculo.fichasRodadas)} fichas × ${this.formatarMoeda(calculo.valorFicha)}`);
    partes.push(`Total Bruto: ${this.formatarMoeda(calculo.totalBruto)}`);

    if (calculo.descontoPartidasValor > 0) {      partes.push(`- Desc. Partidas: ${this.formatarMoeda(calculo.descontoPartidasValor)}`);
  
  }

    if (calculo.descontoDinheiro && calculo.descontoDinheiro > 0) {
      partes.push(`- Desc. Dinheiro: ${this.formatarMoeda(calculo.descontoDinheiro)}`);
  
  }

    partes.push(`(${calculo.percentualEmpresa}% Empresa: ${this.formatarMoeda(calculo.valorPercentual)})`);
    partes.push(`= Total: ${this.formatarMoeda(calculo.totalClientePaga)}`);

    return partes.join(' | ');

  }

  /**
   * Calcula previsão de ganho mensal baseado no histórico
   */
  calcularPrevisaoMensal(
    mediaFichasDiarias: number,
    valorFicha: number,
    percentualEmpresa: number,
    diasMes: number = 30
  ): number {
    const totalBrutoMensal = mediaFichasDiarias * valorFicha * diasMes;
    return this.arredondar((totalBrutoMensal * percentualEmpresa) / 100);

  }

  /**
   * Calcula média de fichas rodadas por período
   */
  calcularMediaFichas(
    relogioInicio: number,
    relogioFim: number,
    diasPeriodo: number
  ): number {
    const totalFichas = relogioFim - relogioInicio;
    return Math.round(totalFichas / Math.max(1, diasPeriodo));

  }

  // ==========================================================================
  // PREPARAÇÃO DE DADOS PARA SALVAMENTO
  // ==========================================================================

  /**
   * Prepara dados da cobrança para salvar no repositório
   */
  prepararDadosCobranca(
    locacao: Locacao,
    input: CalculoCobrancaInput,
    valorRecebido: number,
    observacao?: string  ): Omit<HistoricoCobranca, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'lastSyncedAt' | 'needsSync' | 'version' | 'deviceId' | 'tipo'> {
    const calculo = this.calcularCobranca(input);
    const saldoDevedor = this.calcularSaldoDevedor(calculo.totalClientePaga, valorRecebido);

    // Determinar status
    let status: 'Pago' | 'Parcial' | 'Pendente' | 'Atrasado' = 'Pendente';
    if (valorRecebido >= calculo.totalClientePaga) {
      status = 'Pago';
    } else if (valorRecebido > 0) {
      status = 'Parcial';
  
  }

    return {
      locacaoId: locacao.id,
      clienteId: locacao.clienteId,
      clienteNome: locacao.clienteNome,
      produtoIdentificador: locacao.produtoIdentificador,
      
      dataInicio: locacao.dataUltimaCobranca || locacao.dataLocacao,
      dataFim: new Date().toISOString(),
      dataPagamento: status === 'Pago' ? new Date().toISOString() : undefined,
      
      relogioAnterior: input.relogioAnterior,
      relogioAtual: input.relogioAtual,
      fichasRodadas: calculo.fichasRodadas,
      
      valorFicha: input.valorFicha,
      totalBruto: calculo.totalBruto,
      
      descontoPartidasQtd: input.descontoPartidasQtd,
      descontoPartidasValor: calculo.descontoPartidasValor,
      descontoDinheiro: calculo.descontoDinheiroValor,
      
      percentualEmpresa: input.percentualEmpresa,
      subtotalAposDescontos: calculo.subtotalAposDescontoDinheiro,
      valorPercentual: calculo.valorPercentual,
      
      totalClientePaga: calculo.totalClientePaga,
      valorRecebido,
      saldoDevedorGerado: saldoDevedor,
      
      status,
      dataVencimento: undefined,
      observacao,
    };

  }
}

// ============================================================================
// EXPORTAÇÃO// ============================================================================

export const cobrancaService = new CobrancaService();
export default cobrancaService;