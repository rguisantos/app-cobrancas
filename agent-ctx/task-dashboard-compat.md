# Task: Dashboard Context & Screen Backend Compatibility Updates

## Summary

Updated 7 files for full backend compatibility with the `/api/dashboard/mobile` endpoint and the new `hasPermission(module, platform)` permission system.

## Changes Made

### 1. `shared/types.ts` — DashboardMobileMetricas type
- Made all metric fields **required** (previously optional) to match the API response
- Removed `totalAReceber` (not in API response)
- Added `produtosLocados` and `produtosEstoque` as required fields
- New field order: totalClientes, totalProdutos, produtosLocados, produtosEstoque, cobrancasPendentes, totalRecebidoHoje, totalRecebidoMes, saldoDevedor, cobrancasHoje

### 2. `src/contexts/DashboardContext.tsx`
- **Removed** `ganhosSplitRatio` prop and `DEFAULT_GANHOS_SPLIT` constant (placeholder no longer needed)
- Updated `calcularMetricasMobile()` to include `produtosLocados` and `produtosEstoque`, removed `totalAReceber`
- Updated all fallback metricas objects to match the new required type structure
- `calcularGanhosMes` now uses a hardcoded 95/5 split (was previously configurable via removed prop)

### 3. `src/screens/HomeScreen.tsx`
- Added `mobile` from `useDashboard()` to access API-provided `saudacao` and `usuarioNome`
- Header now uses `mobile?.saudacao || getSaudacao()` and `mobile?.usuarioNome || user?.nome`
- Added `podeManutencao` and `podeRelatorios` permission checks using `hasPermission(module, 'mobile')`
- Replaced `|| 0` with `?? 0` for null-safe metric access
- Replaced `totalAReceber` mini-metric with `cobrancasHoje`
- Card `onPress` now gated behind `podeRelatorios` permission

### 4. `src/screens/RotasCobrancaScreen.tsx`
- Added `hasPermission` from AuthContext
- Added `podeCobrar` check using `hasPermission('cobrancasFaturas', 'mobile')`
- Added permission-denied view when user can't access cobranças
- Added sorting by `ordem` field (0 = no order, goes last)
- Added display of `ordem` badge and `observacao` in list items
- Updated styles to support new fields

### 5. `src/screens/RotasGerenciarScreen.tsx`
- Updated `podeGerenciar` to use `hasPermission('rotas', 'mobile')` instead of direct `tipoPermissao` check
- Added `observacao` display in card items
- Added `cardObs` style

### 6. `src/screens/RelatorioManutencaoScreen.tsx`
- Added `useAuth` import and `podeVer` permission check using `hasPermission('manutencoes', 'mobile')`
- Added permission-denied view when user can't access manutenções
- Wrapped main content in conditional rendering

### 7. `src/hooks/usePermissionGuard.ts`
- **Complete rewrite** to use the new `hasPermission(module, platform)` signature from AuthContext
- Added `PermissionPlatform` type ('web' | 'mobile')
- Added `UsePermissionGuardOptions` interface with `platform` option (defaults to 'mobile')
- Removed `ENTITY_PERMISSION_MAP` and `permissoesAtivas` dependency (now delegates to `authHasPermission`)
- Added `'rotas'` to `PermissionEntity` union type
- `isAdmin` now uses `authIsAdmin()` function (supports fallback check)
- Added `platform` to returned object

### 8. `src/services/DatabaseService.ts`
- **`upsertUsuarioFromSync`**: Added `tentativasLoginFalhas` and `bloqueadoAte` fields to both UPDATE and INSERT paths
- **`upsertUsuarioFromSync`**: INSERT now stores `NULL` for `senha` instead of empty string (security: server should never send senha)
- All other upsert methods (`upsertManutencaoFromSync`, `upsertMetaFromSync`, `upsertTipoProdutoFromSync`, `upsertDescricaoProdutoFromSync`, `upsertTamanhoProdutoFromSync`) verified and confirmed correct
