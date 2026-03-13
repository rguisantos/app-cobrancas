import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../config/config';
import logger from '../utils/logger';

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    nome: string;
    role: string;
  };
}

interface RegisterResponse {
  token: string;
  user: {
    id: string;
    email: string;
    nome: string;
    role: string;
  };
}

class AuthService {
  /**
   * Login com email e senha
   * TODO: Integrar com API real
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      logger.info('Tentando login', { email });

      // TODO: Remover mock e integrar com ApiService
      // const response = await ApiService.post('/auth/login', { email, password });

      // Mock response para testes
      if (email && password) {
        const mockResponse: LoginResponse = {
          token: 'mock_jwt_token_' + Date.now(),
          user: {
            id: 'user_' + Date.now(),
            email: email,
            nome: email.split('@')[0],
            role: 'user',
          },
        };

        logger.info('Login bem-sucedido', { email });
        return mockResponse;
    
  }

      throw new Error('Email e senha são obrigatórios');
    } catch (error) {
      logger.error('Erro ao fazer login', error);
      throw error;
  
  }

  }

  /**
   * Registrar novo usuário
   * TODO: Integrar com API real
   */
  async register(
    nome: string,
    email: string,
    password: string
  ): Promise<RegisterResponse> {
    try {
      logger.info('Tentando registrar', { email });

      // TODO: Remover mock e integrar com ApiService
      // const response = await ApiService.post('/auth/register', { nome, email, password });

      // Mock response para testes
      if (nome && email && password) {
        const mockResponse: RegisterResponse = {
          token: 'mock_jwt_token_' + Date.now(),
          user: {
            id: 'user_' + Date.now(),
            email: email,
            nome: nome,
            role: 'user',
          },
        };

        logger.info('Registro bem-sucedido', { email });
        return mockResponse;
    
  }

      throw new Error('Nome, email e senha são obrigatórios');
    } catch (error) {
      logger.error('Erro ao registrar', error);
      throw error;
  
  }

  }

  /**
   * Validar token JWT
   * TODO: Integrar com API real
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      logger.info('Validando token');

      // TODO: Remover mock e integrar com ApiService
      // const response = await ApiService.post('/auth/validate', { token });
      // return response.data.valid;

      // Mock validation
      if (token && token.startsWith('mock_')) {
        logger.info('Token válido');
        return true;
    
  }

      logger.warn('Token inválido');
      return false;
    } catch (error) {
      logger.error('Erro ao validar token', error);
      return false;
  
  }

  }

  /**
   * Refresh token (quando expira)
   * TODO: Integrar com API real
   */
  async refreshToken(token: string): Promise<string> {
    try {
      logger.info('Tentando renovar token');

      // TODO: Remover mock e integrar com ApiService
      // const response = await ApiService.post('/auth/refresh', { token });
      // return response.data.token;

      // Mock refresh
      const newToken = 'mock_jwt_token_refreshed_' + Date.now();
      logger.info('Token renovado');
      return newToken;
    } catch (error) {
      logger.error('Erro ao renovar token', error);
      throw error;
  
  }

  }

  /**
   * Logout (limpar token)
   */
  async logout(): Promise<void> {
    try {
      logger.info('Fazendo logout');

      // TODO: Remover mock e integrar com ApiService
      // await ApiService.post('/auth/logout');

      // Limpar AsyncStorage
      await AsyncStorage.removeItem(CONFIG.tokenStorageKey);
      await AsyncStorage.removeItem(CONFIG.userStorageKey);

      logger.info('Logout bem-sucedido');
    } catch (error) {
      logger.error('Erro ao fazer logout', error);
      throw error;
  
  }

  }
}

export default new AuthService();
