# Task: Auth Backend API Compatibility

## Summary
Updated AuthService.ts, AuthContext.tsx, and ApiService.ts to ensure full compatibility with the backend API's login, refresh, and change-password endpoints.

## Changes Made

### 1. AuthService.ts
- **LoginResponse interface**: Made `refreshToken` optional (present after API login, absent for offline login). Added `cpf` and `telefone` as optional fields. Updated `permissoes` type to `PermissoesUsuario | string` and `rotasPermitidas` to `string[] | string` to handle backend responses.
- **RefreshResponse interface**: Added new interface matching the backend's refresh endpoint response with `success`, `token`, `refreshToken`, and `user` fields.
- **normalizePermissoes()**: Added private method to handle `permissoes` that may come as a JSON string or object from the backend.
- **normalizeRotasPermitidas()**: Added private method to handle `rotasPermitidas` that may come as a JSON string or array from the backend.
- **salvarUsuarioLocal()**: Now normalizes `permissoes` and `rotasPermitidas` before storing. Maps `cpf` and `telefone` from the API response. Splits `permissoes.web` -> `permissoesWeb` and `permissoes.mobile` -> `permissoesMobile` as separate JSON strings for SQLite columns.
- **refreshToken()**: Now uses `RefreshResponse` type. Always saves the new `refreshToken` (token rotation). Normalizes user data before saving to SecureStore. Also updates the local SQLite database with user data from the refresh response.
- **changePassword()**: Added new method that calls `POST /api/auth/change-password` with `{ senhaAtual, novaSenha }`. Also updates the local database with the new bcrypt-hashed password for offline fallback.

### 2. AuthContext.tsx
- **hasPermission()**: Changed parameter type from `keyof PermissoesUsuario['web'] | keyof PermissoesUsuario['mobile']` to `string` with a `platform` parameter. Now checks `(perms as Record<string, boolean>)[module] === true` to prevent cross-platform key access (returns false if key doesn't exist in the target platform's permission set).
- **toUsuario()**: Now accepts `cpf`, `telefone`, `permissoes` (as string or object), and `rotasPermitidas` (as string or array). Added `normalizePermissoes` and `normalizeRotasPermitidas` helpers.
- **401 Interceptor**: Added a new useEffect that registers `apiService.setOnUnauthenticated` with a handler that tries to refresh the token ONCE before forcing logout.
- **login()**: Now properly saves the `refreshToken` to SecureStore when available.
- **refreshUser()**: Now passes `cpf` and `telefone` from the server response to `toUsuario()`.
- **isAdmin()**: Now checks both `tipoPermissao === 'Administrador'` and (as fallback) whether all `permissoesMobile` flags are true for non-AcessoControlado users.
- **changePassword()**: Added new context method that delegates to `authService.changePassword()`.
- **AuthContextType**: Added `changePassword` to the interface. Updated `hasPermission` signature.

### 3. ApiService.ts
- **login()**: Updated return type to make `refreshToken` required (backend always returns it).
- **refreshToken()**: Now accepts optional `refreshToken` parameter and sends it in the request body. Updated return type to include `success`, `token`, `refreshToken`, and `user`.

## Key Design Decisions
1. **Token rotation**: The backend issues a new `refreshToken` on every refresh. Both `token` and `refreshToken` are always saved together.
2. **Offline login**: When using local/offline login, there's no `refreshToken`. The `LoginResponse.refreshToken` is optional to handle this case.
3. **Normalization**: Both AuthService and AuthContext include normalization helpers since the backend may return `permissoes` and `rotasPermitidas` as either JSON strings or parsed objects depending on the endpoint.
4. **401 retry**: Instead of immediately logging out on 401, the app now tries to refresh the token once. Only if the refresh fails does it force logout.
5. **Local password update**: After changing password via API, the local SQLite database is also updated with the new bcrypt hash for offline fallback.
