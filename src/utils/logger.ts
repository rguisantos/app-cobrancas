/**
 * logger.ts
 * Serviço de logging para debug e produção
 * 
 * Uso:
 * import logger from '../utils/logger';
 * logger.info('Mensagem', { dados: 'opcionais' });
 */

import { ENV } from '../config/env';

// ============================================================================
// TIPOS
// ============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
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
  private enabled: boolean;
  private minLevel: LogLevel;
  private logs: LogEntry[] = [];

  constructor() {
    this.enabled = ENV.DEBUG;
    this.minLevel = 'debug';
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled) return false;

    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,      error: 3,
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

    this.logs.push(entry);

    // Manter apenas últimos 1000 logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
  }

  // ============================================================================
  // MÉTODOS PÚBLICOS
  // ============================================================================

  debug(message: string, data?: any, source?: string) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, data));
      this.storeLog('debug', message, data, source);
    }
  }

  info(message: string, data?: any, source?: string) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, data));
      this.storeLog('info', message, data, source);
    }
  }

  warn(message: string, data?: any, source?: string) {
    if (this.shouldLog('warn')) {      console.warn(this.formatMessage('warn', message, data));
      this.storeLog('warn', message, data, source);
    }
  }

  error(message: string, error?: any, source?: string) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, error));
      this.storeLog('error', message, error, source);
    }
  }

  // ============================================================================
  // UTILITÁRIOS
  // ============================================================================

  /**
   * Habilita ou desabilita logging
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
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
    return this.logs;
  }

  /**
   * Limpa logs armazenados
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Exporta logs para string
   */  exportLogs(): string {
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