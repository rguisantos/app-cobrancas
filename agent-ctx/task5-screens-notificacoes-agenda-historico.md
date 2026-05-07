---
Task ID: 5
Agent: Main
Task: Create Notificações, Agenda, and Histórico de Pagamentos screens

Work Log:
- Read existing codebase patterns: ApiService.ts, CobrancaDetailScreen.tsx, HistoricoCobrancaScreen.tsx, AppNavigator.tsx, CobrancasStack.tsx, currency.ts, types, MaisScreen, HomeScreen
- Added 4 API methods to ApiService.ts:
  - `getNotificacoes()` → GET /api/notificacoes
  - `marcarNotificacaoLida(id)` → PUT /api/notificacoes/{id}
  - `getAgenda(data?)` → GET /api/agenda?data=X
  - `getHistoricoPagamentos(cobrancaId)` → GET /api/historico-pagamentos?cobrancaId=X
- Made `put<T>()` method public (was private) so `marcarNotificacaoLida` can call it
- Created NotificacoesScreen.tsx:
  - FlatList with notification cards
  - 8 tipo→icon/color mappings (cobranca_vencida, saldo_devedor, conflito_sync, cobranca_gerada, manutencao_agendada, meta_atingida, email_falhou, info)
  - Filter chips: Todas / Não lidas / Lidas (with badge count)
  - Unread indicator: blue left border + blue dot
  - Optimistic update on mark-as-read with rollback on error
  - Empty state with contextual message per filter
  - Pull-to-refresh support
- Created AgendaScreen.tsx:
  - Day-based navigation (previous / today / next) buttons
  - Date display with "Hoje" highlight for current date
  - Summary cards (Cobranças, Pagas, Pendentes, Total)
  - AgendaCard with clienteNome, produtoIdentificador, valor, status badge
  - Color-coded status badges (Pago=green, Parcial=blue, Pendente=orange, Atrasado=red)
  - Tapping navigates to CobrancaDetail
  - Empty state: "Nenhuma cobrança para esta data"
  - Supports both array and { cobrancas: [] } API response formats
- Created HistoricoPagamentoScreen.tsx:
  - Route params: cobrancaId + optional clienteNome
  - Header with cobrança summary (cliente, valor, status badge)
  - Vertical timeline: date column → dot+line connector → event card
  - 6 event types with color coding: pagamento=green, pagamento_parcial=blue, estorno=red, alteracao_status=gray, vencimento=amber, geracao=blue
  - Event card shows: tipo label+icon, statusAnterior→statusNovo transition, valorPago, observacao, usuario
  - Supports both array and { eventos: [], cobranca: {} } API response formats
- Registered all 3 screens in AppNavigator.tsx:
  - Added to ModalStackParamList type definitions
  - Added imports for all 3 screen components
  - Added ModalStack.Screen entries with proper titles
- TypeScript compilation: all new/modified files pass type checking (pre-existing errors in other files unchanged)

Files Created:
- src/screens/NotificacoesScreen.tsx
- src/screens/AgendaScreen.tsx
- src/screens/HistoricoPagamentoScreen.tsx

Files Modified:
- src/services/ApiService.ts (added 4 methods, made put() public)
- src/navigation/AppNavigator.tsx (added 3 screens to ModalStackParamList + ModalNavigator)
