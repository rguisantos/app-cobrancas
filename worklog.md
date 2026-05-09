---
Task ID: 1
Agent: Super Z (main)
Task: Complete rewrite of mobile app from scratch

Work Log:
- Analyzed backend API (Prisma schema, 20+ models, sync endpoints, auth flow)
- Analyzed current mobile app (13 contexts, 50+ screens, SQLite schema, root causes of data display bug)
- Identified 5 root causes for data not displaying after sync
- Created new architecture: Zustand + TanStack Query replacing 13 React contexts
- Wrote 64 source files across all layers
- Key fix: queryClient.invalidateQueries() after sync completion

Stage Summary:
- Services: DatabaseService, ApiService, AuthService, SyncService, SecureStorage
- Stores: authStore (Zustand), syncStore (Zustand), settingsStore (Zustand)
- Queries: 12 query hook files covering all entities + dashboard
- Screens: 33 screens (auth, home, clientes, produtos, cobrancas, locacoes, etc.)
- Navigation: 3-branch auth + bottom tabs + modal stack
- Providers: Flat QueryClientProvider (replaces 13 nested contexts)
- TypeScript compiles with 0 errors
