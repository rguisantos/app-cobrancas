import { useContext } from 'react';
import ClienteContext from '../contexts/ClienteContext';

export const useCliente = () => {
  const context = useContext(ClienteContext);
  
  if (!context) {
    throw new Error('useCliente must be used within a ClienteProvider');

  }
  
  return context;
};
