/**
 * sync-events.ts
 * Event emitter simples para notificar contextos quando o sync conclui.
 * Quando SyncService.pullChanges() escreve dados no SQLite, os contextos
 * (ClienteContext, ProdutoContext, etc.) precisam ser notificados para
 * recarregar seus dados. Sem isso, a UI fica vazia mesmo com dados no banco.
 */

type Listener = () => void;

class SyncEventEmitter {
  private listeners: Listener[] = [];

  /**
   * Registra um listener que será chamado quando o sync concluir com sucesso.
   */
  onSyncComplete(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Emite evento de sync completo — todos os contextos devem recarregar dados.
   */
  emitSyncComplete(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        console.error('[SyncEvents] Erro no listener de sync:', error);
      }
    }
  }
}

export const syncEvents = new SyncEventEmitter();
export default syncEvents;
