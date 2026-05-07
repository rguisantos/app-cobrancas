# Task 4b - Metas and Estabelecimentos CRUD Screens

## Summary
Created 4 new files and modified 2 existing files to add Metas CRUD screens and Estabelecimentos CRUD screen to the React Native/Expo mobile app.

## Work Completed

### New Files
1. **`src/contexts/MetaContext.tsx`** — Context providing metas state and CRUD operations (carregar, salvar, atualizar, remover) via DatabaseService generic CRUD. Uses useDatabase for isReady guard and useAuth for criadoPor.

2. **`src/screens/MetasListScreen.tsx`** — List screen with SafeAreaView, FlatList, filter chips for tipo (receita/cobrancas/adimplencia) and status (ativa/atingida/expirada), progress bars, currency formatting, FAB, permission guard (relatorios).

3. **`src/screens/MetaFormScreen.tsx`** — Form screen with route params (modo, metaId), FormInput, FormRadioSelect, FormDatePicker, FormSelect for rota, validation, bottom save bar, permission guard (relatorios).

4. **`src/screens/EstabelecimentosListScreen.tsx`** — Simple CRUD list screen using atributosRepository, with FlatList, modal for create/edit, long-press actions, FAB, permission guard (manutencoes).

### Modified Files
1. **`src/providers/AppProviders.tsx`** — Added MetaProvider import and wrapped inside ManutencaoProvider.

2. **`src/navigation/AppNavigator.tsx`** — Added MetasList, MetaForm, EstabelecimentosList to ModalStackParamList and registered screens in ModalNavigator.

## Patterns Followed
- Context: RotaContext pattern (simple state, DatabaseService generic CRUD)
- List screen: ClientesListScreen pattern (SafeAreaView, FlatList, FilterChip, FAB)
- Form screen: ClienteFormScreen pattern (KeyboardAvoidingView, form components, bottom save bar)
- Simple CRUD: AtributosProdutoGerenciarScreen pattern (modal, long-press, duplicate check)
- Colors: #2563EB primary, #F8FAFC bg, #FFFFFF card, borderRadius 16, elevation 2
