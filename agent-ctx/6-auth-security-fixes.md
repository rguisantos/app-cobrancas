# Task 6 — Auth & Security Fixes

## Agent
Auth & Security Fix Agent

## Date
2024-01-03

## Summary
Fixed 5 auth and security issues in the mobile app's authentication and device activation flows.

## Changes Made

### 1. Structured lockoutInfo (AuthService + ApiService)
- `ApiService.ts`: Error responses now include `data` field so structured lockout info is accessible
- `AuthService.ts`: Lockout handling prioritizes `lockoutInfo.minutosRestantes` from response data, regex as fallback

### 2. Local lockout with change_log (UsuarioRepository)
- All `databaseService.runAsync()` calls in `autenticar()` replaced with `databaseService.update('usuario', ...)` to register change_log
- Lockout errors now re-thrown from catch block (previously silently returned null)

### 3. DeviceActivationResponse chave/deviceKey
- `chave` and `deviceKey` made required in type definition
- `chave` added to `SyncMetadata` interface and database default
- `DeviceActivationScreen` now saves `chave` and server `deviceKey` from response

### 4. LOCAL_ token prefix (AuthService + AuthContext)
- New local tokens use `LOCAL_` prefix (was `local.`)
- `isLocalToken()` checks both `LOCAL_` and `local.` for backward compat, removed fragile JWT check
- `AuthContext.tsx` proactive refresh uses same prefix-based check

### 5. Forgot-password flow (ApiService + RecoverPasswordScreen)
- Added `forgotPassword()` and `resetPassword()` API methods
- Rewrote `RecoverPasswordScreen` with 3-step flow: email → reset code + new password → success
- Handles loading, errors, offline fallback, and security (doesn't reveal email existence)

## Files Modified
1. `src/services/ApiService.ts`
2. `src/services/AuthService.ts`
3. `src/repositories/UsuarioRepository.ts`
4. `src/contexts/AuthContext.tsx`
5. `shared/types.ts`
6. `src/services/DatabaseService.ts`
7. `src/screens/DeviceActivationScreen.tsx`
8. `src/screens/RecoverPasswordScreen.tsx`
