import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';
import LoadingSpinner from '../components/LoadingSpinner';

const RootNavigator: React.FC = () => {
  const { isLoading, token } = useAuth();

  // 1. Se está carregando, mostramos o spinner DENTRO do NavigationContainer.
  // Isso garante que o contexto de navegação exista, mesmo que estejamos apenas carregando.
  if (isLoading) {
    return (
      <NavigationContainer>
        <LoadingSpinner />
      </NavigationContainer>
    );
  }

  // 2. Se terminou de carregar, decidimos qual fluxo mostrar (App ou Auth),
  // sempre envolvido pelo NavigationContainer.
  return (
    <NavigationContainer>
      {token ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default RootNavigator;