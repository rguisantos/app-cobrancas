---
Task ID: 1
Agent: Main
Task: Refatorar mobile app-cobrancas para compatibilidade total com backend web

Work Log:
- Clonou ambos os projetos (mobile e web) e fez análise completa das divergências
- Identificou 9+ divergências críticas entre mobile e backend
- Atualizou shared/types.ts: EntityType expandido (manutencao/meta), interfaces Meta/Estabelecimento, trocaPano em HistoricoCobranca, sync fields em Manutencao
- Atualizou DatabaseService.ts: tabela metas, migrations (trocaPano, sync fields manutencoes, endereco/observacao estabelecimentos), upsertManutencaoFromSync, upsertMetaFromSync, applyRemoteChanges processa manutencoes/metas
- Atualizou SyncService.ts: getTableName suporta manutencao/meta, pulled count inclui manutencoes/metas
- Refatorou Clientes: identificador limpo (sem máscara), latitude/longitude, dataCadastro/dataUltimaAlteracao, busca por identificador
- Refatorou Cobranças: produtoId e trocaPano nos fluxos, parseFloat para relogioAnterior/relogioAtual/descontoPartidasQtd
- Refatorou Locações: trocaPano e dataUltimaManutencao persistidos, dataPrimeiraCobranca DD/MM/AAAA → ISO
- Refatorou Produtos: dateBRtoISO/dateISOtoBR utilities, estabelecimento no form, HistoricoRelogio persistido
- Refatorou Dashboard: API-first strategy com fallback local, metrica totalAReceber, getDashboardMobile tipado
- Refatorou Manutenções: sync fields no repository e DatabaseService, indicador de sync no relatório
- Fix: shared/constants.ts EntityType, SyncContext pendingItems, ApiService refreshToken type, SyncService pulled count

Stage Summary:
- 3 commits pushed to GitHub: e5c8f7d, 379013d, d107d68
- Mobile app agora compatível com todas as áreas do backend
- Novas tabelas: metas, historico_relogio
- Novas colunas: cobrancas.trocaPano, manutencoes.sync fields, estabelecimentos.endereco/observacao
- EntityType expandido de 6 para 8 tipos
- Sync bidirecional agora suporta manutencoes e metas
