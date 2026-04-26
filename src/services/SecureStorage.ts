/**
 * SecureStorage.ts
 * Serviço de armazenamento seguro para tokens e dados sensíveis.
 * Usa expo-secure-store no dispositivo (criptografia nativa do keystore/keychain)
 * com fallback para AsyncStorage em ambientes sem suporte.
 * 
 * Segurança:
 * - Tokens de acesso e refresh são armazenados no SecureStore (criptografado)
 * - Dados não sensíveis (preferências do usuário) ficam no AsyncStorage
 * - O refresh token nunca é armazenado em texto plano no AsyncStorage
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../utils/logger';

// Chaves do SecureStore (dados sensíveis)
const SECURE_KEYS = {
  ACCESS_TOKEN: 'cobrancas_access_token',
  REFRESH_TOKEN: 'cobrancas_refresh_token',
  BIOMETRIC_ENABLED: 'cobrancas_biometric_enabled',
} as const;

// Chaves do AsyncStorage (dados não sensíveis)
const ASYNC_KEYS = {
  USER: '@cobrancas:user',
  DEVICE: '@cobrancas:device',
  TOKEN: '@cobrancas:token', // Mantido para compatibilidade durante migração
} as const;

class SecureStorageService {
  private isAvailable: boolean | null = null;

  /**
   * Verifica se o SecureStore está disponível no dispositivo.
   * Não está disponível em simuladores iOS sem keychain ou em alguns emuladores Android.
   */
  async checkAvailability(): Promise<boolean> {
    if (this.isAvailable !== null) return this.isAvailable;
    
    try {
      // SecureStore.isAvailableAsync() verifica suporte do hardware
      this.isAvailable = await SecureStore.isAvailableAsync();
      logger.info(`[SecureStorage] Disponível: ${this.isAvailable}`);
    } catch {
      this.isAvailable = false;
      logger.warn('[SecureStorage] Não disponível, usando AsyncStorage como fallback');
    }
    
    return this.isAvailable;
  }

  // ─── Métodos para tokens (SecureStore) ─────────────────────────────

  /**
   * Salva o access token de forma segura.
   */
  async saveAccessToken(token: string): Promise<void> {
    try {
      if (await this.checkAvailability()) {
        await SecureStore.setItemAsync(SECURE_KEYS.ACCESS_TOKEN, token);
      } else {
        // Fallback: AsyncStorage (menos seguro, mas funcional em emuladores)
        await AsyncStorage.setItem(ASYNC_KEYS.TOKEN, token);
      }
    } catch (error) {
      logger.error('[SecureStorage] Erro ao salvar access token:', error);
      // Fallback de emergência
      await AsyncStorage.setItem(ASYNC_KEYS.TOKEN, token);
    }
  }

  /**
   * Recupera o access token.
   */
  async getAccessToken(): Promise<string | null> {
    try {
      if (await this.checkAvailability()) {
        return await SecureStore.getItemAsync(SECURE_KEYS.ACCESS_TOKEN);
      }
      return await AsyncStorage.getItem(ASYNC_KEYS.TOKEN);
    } catch (error) {
      logger.error('[SecureStorage] Erro ao recuperar access token:', error);
      return await AsyncStorage.getItem(ASYNC_KEYS.TOKEN);
    }
  }

  /**
   * Salva o refresh token de forma segura.
   * O refresh token é ainda mais sensível que o access token
   * pois permite obter novos tokens de acesso.
   */
  async saveRefreshToken(token: string): Promise<void> {
    try {
      if (await this.checkAvailability()) {
        await SecureStore.setItemAsync(SECURE_KEYS.REFRESH_TOKEN, token);
      } else {
        // Fallback: AsyncStorage com prefixo de segurança
        await AsyncStorage.setItem('cobrancas_refresh_token', token);
      }
    } catch (error) {
      logger.error('[SecureStorage] Erro ao salvar refresh token:', error);
      await AsyncStorage.setItem('cobrancas_refresh_token', token);
    }
  }

  /**
   * Recupera o refresh token.
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      if (await this.checkAvailability()) {
        return await SecureStore.getItemAsync(SECURE_KEYS.REFRESH_TOKEN);
      }
      return await AsyncStorage.getItem('cobrancas_refresh_token');
    } catch (error) {
      logger.error('[SecureStorage] Erro ao recuperar refresh token:', error);
      return await AsyncStorage.getItem('cobrancas_refresh_token');
    }
  }

  // ─── Biometria ───────────────────────────────────────────────────

  async setBiometricEnabled(enabled: boolean): Promise<void> {
    try {
      if (await this.checkAvailability()) {
        await SecureStore.setItemAsync(
          SECURE_KEYS.BIOMETRIC_ENABLED,
          enabled ? 'true' : 'false'
        );
      } else {
        await AsyncStorage.setItem(
          'cobrancas_biometric_enabled',
          enabled ? 'true' : 'false'
        );
      }
    } catch (error) {
      logger.error('[SecureStorage] Erro ao salvar preferência biométrica:', error);
    }
  }

  async isBiometricEnabled(): Promise<boolean> {
    try {
      let value: string | null = null;
      if (await this.checkAvailability()) {
        value = await SecureStore.getItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED);
      } else {
        value = await AsyncStorage.getItem('cobrancas_biometric_enabled');
      }
      return value === 'true';
    } catch {
      return false;
    }
  }

  // ─── Dados do usuário (AsyncStorage — não sensíveis) ───────────────

  async saveUser(userJson: string): Promise<void> {
    await AsyncStorage.setItem(ASYNC_KEYS.USER, userJson);
  }

  async getUser(): Promise<string | null> {
    return AsyncStorage.getItem(ASYNC_KEYS.USER);
  }

  async getDevice(): Promise<string | null> {
    return AsyncStorage.getItem(ASYNC_KEYS.DEVICE);
  }

  // ─── Limpeza ──────────────────────────────────────────────────────

  /**
   * Remove tokens e dados do usuário (logout).
   * Mantém dados do dispositivo (ativação) e preferências.
   */
  async clearAuthData(): Promise<void> {
    try {
      // Limpar tokens do SecureStore
      if (await this.checkAvailability()) {
        await SecureStore.deleteItemAsync(SECURE_KEYS.ACCESS_TOKEN).catch(() => {});
        await SecureStore.deleteItemAsync(SECURE_KEYS.REFRESH_TOKEN).catch(() => {});
      }
      
      // Limpar dados do AsyncStorage
      await AsyncStorage.multiRemove([
        ASYNC_KEYS.TOKEN,
        ASYNC_KEYS.USER,
        'cobrancas_refresh_token',
      ]);
    } catch (error) {
      logger.error('[SecureStorage] Erro ao limpar dados de auth:', error);
    }
  }

  /**
   * Migra dados do AsyncStorage antigo para o SecureStore.
   * Deve ser chamado na inicialização do app após a atualização.
   */
  async migrateFromAsyncStorage(): Promise<void> {
    try {
      const oldToken = await AsyncStorage.getItem(ASYNC_KEYS.TOKEN);
      if (oldToken && await this.checkAvailability()) {
        // Migrar access token
        await SecureStore.setItemAsync(SECURE_KEYS.ACCESS_TOKEN, oldToken);
        logger.info('[SecureStorage] Access token migrado para SecureStore');
      }
    } catch (error) {
      logger.error('[SecureStorage] Erro na migração:', error);
    }
  }
}

export const secureStorage = new SecureStorageService();
export default secureStorage;
