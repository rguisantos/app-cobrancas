# Task: Update SyncService, SyncContext, and ApiService for Backend API Compatibility

## Summary

Updated three files in `/home/z/my-project/app-cobrancas/src/` to be fully compatible with the backend API:

### 1. ApiService.ts
- **pullChanges**: Added accumulation of `manutencoes`, `metas`, `tiposProduto`, `descricoesProduto`, `tamanhosProduto` in the pagination loop
- **pullChanges**: Updated initial `allChanges` object to include `usuarios`, `manutencoes`, `metas` 
- **pullChanges**: Updated error return to include `usuarios`, `manutencoes`, `metas`
- **pushChanges**: Updated fallback response to include `usuarios`, `manutencoes`, `metas`
- **pullChanges**: Updated debug log total count to include all entity types + product attributes
- **alterarSenha**: Already existed — no change needed

### 2. SyncService.ts
- **pullChanges()**: Already counted all 8 entity types (including manutencoes/metas) — verified ✅
- **syncFromSnapshot()**: Added `manutencoes` and `metas` to the `changes` object passed to `applyRemoteChanges`
- **syncFromSnapshot()**: Added `manutencoes`, `metas`, `tiposProduto`, `descricoesProduto`, `tamanhosProduto` to the total count
- **pushChanges()**: Verified the `typeof change.changes === 'string' ? JSON.parse(change.changes) : change.changes` conversion is correct ✅
- **ensureDeviceRegistered()**: Verified no duplicate device key generation — returns false if no key exists ✅

### 3. SyncContext.tsx
- **Removed `registrarDispositivo`**: Function that generated device keys independently (used deprecated `registrarEquipamento`). Device registration should ONLY happen via DeviceActivationScreen.
- **Added `alterarSenha`**: New context method that calls `apiService.alterarSenha` for password changes
- **Added `isStale` handling**: In `sincronizar`, if `pullResponse.isStale` is true, automatically calls `syncService.syncFromSnapshot()` before applying pull changes
- **`mudancasPendentes`**: Already counts all pending changes (including manutencoes/metas) — verified ✅
- **Updated `SyncContextData` interface**: Removed `registrarDispositivo`, added `alterarSenha`
