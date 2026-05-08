/**
 * logger.ts
 * Serviço de logging para debug e produção
 * 
 * Uso:
 * import logger from '../utils/logger';
 * logger.info('Mensagem', { dados: 'opcionais' });
 * 
 * Logs are ALWAYS stored (for the debug terminal screen)
 * regardless of ENV.DEBUG setting. Console output is
 * controlled by ENV.DEBUG.
 */

import { ENV } from '../config/env';

// ============================================================================
// TIPOS
// ============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  source?: string;
}

// ============================================================================
// LOGGER
// ============================================================================

class Logger {
  private consoleEnabled: boolean;  // Controls console output only
  private minLevel: LogLevel;
  private logs: LogEntry[] = [];
  private listeners: Array<(entry: LogEntry) => void> = [];

  constructor() {
    this.consoleEnabled = ENV.DEBUG;
    this.minLevel = 'debug';
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private shouldConsole(level: LogLevel): boolean {
    if (!this.consoleEnabled) return false;
    const levels: Record<LogLevel, number> = {
      debug: 0, info: 1, warn: 2, error: 3,
    };
    return levels[level] >= levels[this.minLevel];
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = this.getTimestamp();
    const levelTag = `[${level.toUpperCase()}]`;
    const dataString = data ? ` ${JSON.stringify(data)}` : '';
    return `${timestamp} ${levelTag} ${message}${dataString}`;
  }

  private storeLog(level: LogLevel, message: string, data?: any, source?: string) {
    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: this.getTimestamp(),
      source,
    };

    // ALWAYS store logs for the debug terminal screen
    this.logs.push(entry);

    // Manter apenas últimos 500 logs
    if (this.logs.length > 500) {
      this.logs = this.logs.slice(-500);
    }

    // Notify listeners in real-time (for debug terminal screen)
    for (const listener of this.listeners) {
      try { listener(entry); } catch {}
    }
  }

  // ============================================================================
  // MÉTODOS PÚBLICOS
  // ============================================================================

  debug(message: string, data?: any, source?: string) {
    this.storeLog('debug', message, data, source);
    if (this.shouldConsole('debug')) {
      console.log(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: any, source?: string) {
    this.storeLog('info', message, data, source);
    if (this.shouldConsole('info')) {
      console.log(this.formatMessage('info', message, data));
    }
  }

  warn(message: string, data?: any, source?: string) {
    this.storeLog('warn', message, data, source);
    if (this.shouldConsole('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  error(message: string, error?: any, source?: string) {
    this.storeLog('error', message, error, source);
    if (this.shouldConsole('error')) {
      console.error(this.formatMessage('error', message, error));
    }
  }

  // ============================================================================
  // UTILITÁRIOS
  // ============================================================================

  /**
   * Habilita ou desabilita console output (logs are always stored)
   */
  setEnabled(enabled: boolean) {
    this.consoleEnabled = enabled;
  }

  /**
   * Define nível mínimo de log
   */
  setMinLevel(level: LogLevel) {
    this.minLevel = level;
  }

  /**
   * Retorna logs armazenados
   */
  getLogs(filter?: LogLevel): LogEntry[] {
    if (filter) {
      return this.logs.filter(log => log.level === filter);
    }
    return [...this.logs];
  }

  /**
   * Adiciona listener para novos logs em tempo real (para a tela de terminal)
   * Retorna função de cleanup
   */
  addLogListener(listener: (entry: LogEntry) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Limpa logs armazenados
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Exporta logs para string
   */
  exportLogs(): string {
    return this.logs
      .map(log => `${log.timestamp} [${log.level.toUpperCase()}] ${log.message}${log.data ? ' ' + JSON.stringify(log.data) : ''}`)
      .join('\n');
  }

  /**
   * Log de navegação
   */
  navigation(screen: string, params?: any) {
    this.info(`Navigation: ${screen}`, params, 'Navigation');
  }

  /**
   * Log de API
   */
  api(endpoint: string, method: string, duration?: number, error?: any) {
    const message = `API ${method} ${endpoint}${duration ? ` (${duration}ms)` : ''}`;
    if (error) {
      this.error(message, error, 'API');
    } else {
      this.info(message, undefined, 'API');
    }
  }

  /**
   * Log de sincronização
   */
  sync(action: string, records?: number, error?: any) {
    const message = `Sync ${action}${records ? ` (${records} records)` : ''}`;
    if (error) {
      this.error(message, error, 'Sync');
    } else {
      this.info(message, undefined, 'Sync');
    }
  }
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

export const logger = new Logger();
export default logger;
