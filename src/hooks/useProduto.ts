import { useContext } from 'react';
import { ProdutoContext } from '../contexts/ProdutoContext';

export const useProduto = () => {
  const context = useContext(ProdutoContext);
  
  if (!context) {
    throw new Error('useProduto must be used within a ProdutoProvider');
  }
  
  return context;
};
