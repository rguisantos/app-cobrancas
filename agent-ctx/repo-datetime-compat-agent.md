# Task: Update Mobile Repositories for Backend DateTime Compatibility

## Summary

Updated all 6 repositories in `/home/z/my-project/app-cobrancas/src/repositories/` to be fully compatible with the backend API's DateTime fields and data mapping requirements.

## Changes Made

### 1. ClienteRepository.ts
- **Added `dateBRtoISO` import** from `../utils/database`
- **Updated `parseCliente`**: Date fields (`dataCadastro`, `dataUltimaAlteracao`) now use `dateBRtoISO()` to ensure ISO 8601 format (handles legacy DD/MM/AAAA data defensively)
- **Updated `save`**: `dataCadastro` uses `dateBRtoISO()` before falling back to `now`
- **Verified**: `cpfCnpj`/`rgIe` computed fields properly derived from `cpf`/`cnpj` and `rg`/`inscricaoEstadual`
- **Verified**: `contatos` JSON string parsed back to array via `parseJSON()`
- **Verified**: `email` field defaults to empty string (can be null/empty)

### 2. ProdutoRepository.ts
- **Added `dateBRtoISO` import** from `../utils/database`
- **Added `parseProduto` method**: Ensures all date fields (`dataFabricacao`, `dataUltimaManutencao`, `dataAvaliacao`, `dataCadastro`, `dataUltimaAlteracao`) are ISO strings; casts `precoFicha` to Number
- **Updated `getById`**: Now uses `parseProduto()` for type conversions
- **Updated `getByIdentificador`**: Now uses `parseProduto()`
- **Updated `save`**: All date fields converted via `dateBRtoISO()` before storage
- **Updated `update`**: Strips `locacaoAtiva` virtual field; date fields converted via `dateBRtoISO()` with null-coalescing fallback to existing values

### 3. LocacaoRepository.ts
- **Added `dateBRtoISO` import** from `../utils/database`
- **Added `parseLocacao` method**: Converts all date fields to ISO; converts `trocaPano` from INTEGER (0/1) to boolean; casts numeric fields (`ultimaLeituraRelogio`, `precoFicha`, `percentualEmpresa`, `percentualCliente`, `valorFixo`) to Number
- **Updated `getById`**: Now uses `parseLocacao()`
- **Updated `getAtivaByProduto`**: Now uses `parseLocacao()`
- **Updated `getAtivasByCliente`**: Now maps through `parseLocacao()`
- **Updated `getByProduto`**: Now maps through `parseLocacao()`
- **Updated `save`**: Fixed `needsSync: true` → `needsSync: 1` (INTEGER for SQLite); date fields converted via `dateBRtoISO()`; `trocaPano` stored as INTEGER (0/1)
- **Updated `update`**: Date fields converted via `dateBRtoISO()` with null-coalescing; `trocaPano` stored as INTEGER
- **Updated `criarNovaLocacao`**: Date fields converted via `dateBRtoISO()`; `trocaPano` stored as INTEGER
- **Updated `realizarRelocacao`**: Date fields converted via `dateBRtoISO()`; `trocaPano` stored as INTEGER

### 4. CobrancaRepository.ts
- **Added `dateBRtoISO` import** from `../utils/database`
- **Added `parseCobranca` method**: Converts all date fields (`dataInicio`, `dataFim`, `dataPagamento`, `dataVencimento`) to ISO; converts `trocaPano` from INTEGER to boolean; casts all numeric fields to Number
- **Updated `getAll`**: Now maps through `parseCobranca()`
- **Updated `getById`**: Now uses `parseCobranca()`
- **Updated `save`**: Fixed `needsSync: true` → `needsSync: 1`; `trocaPano` stored as INTEGER
- **Updated `registrarCobranca`**: Date fields converted via `dateBRtoISO()`; `dataVencimento` converted; `trocaPano` stored as INTEGER
- **Updated `update`**: `trocaPano` handled as INTEGER (0/1) when updating
- **Verified**: `produtoId` is nullable (optional in type definition)
- **Verified**: `saldoDevedorGerado` is properly tracked in all operations

### 5. UsuarioRepository.ts
- **Added `dateBRtoISO` import** and `UsuarioSyncData` type import
- **Updated `save`**: 
  - `senha` is NO LONGER passed to `databaseService.save/update()` — stored separately via direct SQL (`UPDATE usuarios SET senha = ?`) to prevent it from appearing in change logs for sync
  - `cpf` and `telefone` now default to `null` instead of empty string (they're optional fields)
  - Added `tentativasLoginFalhas` field (INTEGER, defaults to 0)
  - Added `bloqueadoAte` field (TEXT, ISO date or null)
- **Updated `update`**:
  - `senha` is NO LONGER passed to `databaseService.update()` — updated separately via direct SQL
  - `cpf` and `telefone` properly handle null vs existing values with `!== undefined` checks
  - `tentativasLoginFalhas` and `bloqueadoAte` fields handled in update data
- **Updated `definirSenha`**: Now uses direct SQL (`UPDATE usuarios SET senha = ?, updatedAt = ?`) instead of `databaseService.update()` to avoid senha in change logs
- **Added `toSyncData` method**: Returns user data without `senha` for safe sync payload creation
- **Updated `parseUsuario`**: 
  - `cpf` and `telefone` converted to `undefined` when empty (optional fields)
  - `dataUltimoAcesso` and `bloqueadoAte` converted via `dateBRtoISO()`
  - `permissoes` composite field reconstructed from `permissoesWeb` and `permissoesMobile` JSON strings

### 6. ManutencaoRepository.ts
- **Added `dateBRtoISO` import** from `../utils/database`
- **Added `parseManutencao` method**: Converts `data` field via `dateBRtoISO()`; converts `needsSync` from INTEGER (0/1) to boolean
- **Updated `registrar`**: 
  - `data` field converted via `dateBRtoISO()` before storage
  - Fixed `needsSync: true` → `needsSync: 1` (INTEGER for SQLite)
  - Returns parsed result via `parseManutencao()`
- **Updated `getAll`**: Now maps through `parseManutencao()`

## Key Patterns Applied

1. **Date Handling**: All date fields use `dateBRtoISO()` which:
   - Converts DD/MM/AAAA format to ISO 8601
   - Preserves already-ISO dates (pass-through)
   - Returns `undefined` for invalid/null dates

2. **Boolean Storage**: SQLite stores booleans as INTEGER (0/1)
   - When writing: `trocaPano ? 1 : 0`, `bloqueado ? 1 : 0`
   - When reading: `data.trocaPano === 1 || data.trocaPano === true`

3. **needsSync Field**: Always use `1` instead of `true` for SQLite INTEGER columns

4. **Senha Security**: Never pass `senha` through `databaseService.save/update()` to prevent it from appearing in change logs used for sync push. Store via direct SQL instead.

5. **Parse Methods**: Each repository now has a `parseXxx()` method that handles type conversions when reading from SQLite, ensuring proper types for the application layer.

## Files Modified
- `/home/z/my-project/app-cobrancas/src/repositories/ClienteRepository.ts`
- `/home/z/my-project/app-cobrancas/src/repositories/ProdutoRepository.ts`
- `/home/z/my-project/app-cobrancas/src/repositories/LocacaoRepository.ts`
- `/home/z/my-project/app-cobrancas/src/repositories/CobrancaRepository.ts`
- `/home/z/my-project/app-cobrancas/src/repositories/UsuarioRepository.ts`
- `/home/z/my-project/app-cobrancas/src/repositories/ManutencaoRepository.ts`

## Verification
- ESLint passed with no errors on all repository files
- All imports verified (dateBRtoISO, UsuarioSyncData)
- All file sizes verified to be correct (files are readable and non-empty)
