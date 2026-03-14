/**
 * Mock para expo-sqlite na web
 * O SQLite não funciona no navegador da mesma forma que no mobile
 * Este mock permite que o app carregue na web para demonstração
 */

// Mock database object
const mockDatabase = {
  runAsync: async () => ({ rowsAffected: 0, lastInsertRowId: 0 }),
  getFirstAsync: async () => null,
  getAllAsync: async () => [],
  execAsync: async () => [],
  closeAsync: async () => {},
  withTransactionAsync: async (callback: () => Promise<void>) => {
    await callback();
  },
};

// Mock functions
export const openDatabaseSync = () => mockDatabase;
export const openDatabaseAsync = async () => mockDatabase;

// Mock hooks
export const useSQLiteContext = () => mockDatabase;
export const SQLiteProvider = ({ children }: { children: React.ReactNode }) => children;

// Mock types
export type SQLiteDatabase = typeof mockDatabase;

export default {
  openDatabaseSync,
  openDatabaseAsync,
  useSQLiteContext,
  SQLiteProvider,
};
