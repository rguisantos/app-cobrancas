import { useContext } from 'react';
import CobrancaContext from '../contexts/CobrancaContext';

export const useCobranca = () => {
  const context = useContext(CobrancaContext);
  
  if (!context) {
    throw new Error('useCobranca must be used within a CobrancaProvider');

  }
  
  return context;
};
