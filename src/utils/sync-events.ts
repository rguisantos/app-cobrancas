/**
 * sync-events.ts
 *
 * DEPRECATED: This file is no longer used by SyncService or SyncContext.
 * The ONLY notification mechanism for data reload is now `syncVersion` in SyncContext.
 *
 * This file exports a no-op stub for backward compatibility with any
 * remaining consumers (e.g., ClienteContext, SyncStatusScreen) that
 * still import from this module. Those consumers should be migrated
 * to use `syncVersion` from `useSync()` instead.
 *
 * TODO: Remove this file and migrate remaining consumers to use syncVersion.
 */

type Listener = () => void;

class SyncEventEmitterStub {
  /**
   * No-op — does nothing. Use syncVersion from useSync() instead.
   */
  onSyncComplete(_listener: Listener): () => void {
    // Return a no-op unsubscribe function
    return () => {};
  }

  /**
   * No-op — does nothing. SyncContext increments syncVersion instead.
   */
  emitSyncComplete(): void {
    // No-op
  }
}

export const syncEvents = new SyncEventEmitterStub();
export default syncEvents;
