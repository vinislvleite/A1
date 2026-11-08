# Plano de Testes e Relatório de Validação - Sprint 2 (US27 a US52)

**Aplicação:** Orçamento Fácil (A1)  
**Data:** 08/11/2026  
**Versão do Schema:** SQLite v7  
**Ambiente de Execução:** Jest 29, Better-SQLite3 em memória, TypeScript Strict  

---

## 1. Visão Geral e Estratégia de Testes

A bateria de testes da Sprint 2 cobre integralmente todas as histórias de usuário implementadas nos Blocos A, B, C, D e E (US27 a US52).
Os testes de dados e regras de negócio executam diretamente sobre instâncias SQLite em memória (`better-sqlite3` com a mesma interface do driver móvel), garantindo validação de constraints relacionais, chaves estrangeiras, índices e integridade ACID, sem dependência de mocks fixos.

A suíte está organizada em 8 arquivos modulares:
1. `__tests__/00-infra-migrations.test.ts`: Migrações da Sprint 1 (v3) para Sprint 2 (v7), integridade de dados prévios, índices, idempotência e tempo de migração com 10.000 transações.
2. `__tests__/05-date-utils.test.ts`: Utilitário central de datas e horas em formato pt-BR (DD/MM/AAAA), fuso horário local e determinismo.
3. `__tests__/10-transacoes-cartao-extrato.test.ts`: Bloco A e Bloco B (recorrência, parcelamento, fatura de cartão nubank/fechamento inclusivo, extrato simples e consolidado, juros do rotativo, transferências e ajuste de saldo).
4. `__tests__/20-orcamentos-limites-categorias.test.ts`: Bloco C (orçamento base zero, orçamento por evento, alertas de 80%/100%, modo percentual, limite diário e metas de categoria).
5. `__tests__/30-backup-contasfixas-tags-config.test.ts`: Bloco D (backup criptografado AES-256-GCM, integridade e versionamento, contas fixas, tags relacionais, etiquetas de cor, transações pendentes e canais de notificação).
6. `__tests__/40-dialog-system-and-regression.test.ts`: Sistema customizado de modais/diálogos em tema escuro, substituição de alertas nativos e regressão de fluxos.
7. `__tests__/50-sprint2-repositorio-e-telas.test.ts`: Repositório de dados com filtros combinados (tags, eventos, status, datas), paginação, agrupamento GROUP BY mensal e integridade de chave estrangeira em cascata.
8. `__tests__/60-sprint2-integracao-e2e-e-nao-funcionais.test.ts`: Fluxo ponta a ponta (E2E) integrando contas, categorias, orçamento, parcelamento, transferências e extrato, além de benchmarks de desempenho com 10.000 registros (< 300 ms).

---

## 2. Tabela de Casos de Teste (CT01 a CT52)

| ID | História | Pré-condições | Passos Principais | Resultado Esperado | Tipo | Status |
|---|---|---|---|---|---|---|
| **CT01** | US27 - Recorrência Automática | Template de despesa recorrente criado em janeiro dia 31 | Avançar data para fevereiro (não bissexto), março e abril | Gera ocorrências no último dia de fevereiro (28) e dias 31/30; idempotente | Automático | PASS |
| **CT02** | US27 - Recorrência Catch-up | Template inativo há 4 meses | Executar rotina de inicialização/abertura | Gera transações retroativas dos 4 meses pendentes sem duplicar existentes | Automático | PASS |
| **CT03** | US27 - Desativação de Recorrência | Recorrência ativa com histórico gerado | Desativar `is_recurring = false` | Nenhuma nova transação é gerada; histórico anterior permanece íntegro | Automático | PASS |
| **CT04** | US28 - Parcelamento Centavos | Compra de R$ 100,00 em 3x | Executar `CreateInstallmentsUseCase` | Gera 3 parcelas: 33,33 + 33,33 + 33,34 (soma exata 100,00) | Automático | PASS |
| **CT05** | US28 - Parcelamento Valor Mínimo | Compra de R$ 0,01 em 3x | Executar `CreateInstallmentsUseCase` | Gera 0,00 + 0,00 + 0,01 (soma 0,01 sem erros aritméticos) | Automático | PASS |
| **CT06** | US28 - Virada de Ano em Parcelas | Compra em 10/11 em 4x | Gerar parcelas | Parcela 1 (10/11), 2 (10/12), 3 (10/01 ano seguinte), 4 (10/02 ano seguinte) | Automático | PASS |
| **CT07** | US28 - Exclusão Parcial de Parcelas | Parcelamento de 4 parcelas | Excluir parcela 3 com escopo `future` | Parcelas 1 e 2 preservadas; parcelas 3 e 4 excluídas do banco | Automático | PASS |
| **CT08** | US29 - Ciclo Fatura Nubank | Cartão fechamento dia 10, vencimento dia 17. Hoje = 08/11/2026 | Lançar compras nos dias 05 a 08/11 e parcela 1/3 | Ciclo exibido: 11/10 a 10/11; Fatura atual = R$ 299,53; parcelas futuras excluídas da fatura atual | Automático | PASS |
| **CT09** | US29 - Compra no Dia do Fechamento | Cartão fechamento dia 10 | Compra lançada no dia 10/11 | Compra incluída na fatura fechando em 10/11 (fechamento inclusivo) | Automático | PASS |
| **CT10** | US29 - Transição Entre Ciclos | Compra lançada no dia 11/11 | Consultar fatura no dia 11/11 | Fatura aberta passa a ser 11/11 a 10/12; fatura anterior exibida como fechada | Automático | PASS |
| **CT11** | US30 - Extrato Conta Específica | Movimentações em Conta Corrente e Poupança | Filtrar extrato apenas pela Conta Corrente | Exibe saldo inicial, linhas exclusivas da conta corrente e saldo final exato | Automático | PASS |
| **CT12** | US31 - Extrato Consolidado | Movimentações entre contas e transferências | Consultar extrato consolidado de todas as contas | Transferências têm impacto zero no consolidado; saldo linha a linha estritamente coerente | Automático | PASS |
| **CT13** | US31 - Mês Sem Movimentação | Saldo anterior de R$ 1.500,00; mês sem transações | Consultar extrato do mês vazio | Linhas vazias; saldo inicial = R$ 1.500,00 e saldo final = R$ 1.500,00 | Automático | PASS |
| **CT14** | US32 - Ajuste de Saldo Retroativo | Saldo atual diverge da realidade bancária | Executar `adjustBalance` para valor R$ 2.000,00 | Recalcula `initial_balance` da conta mantendo integridade histórica | Automático | PASS |
| **CT15** | US33 - Transferência Entre Contas | Conta A (R$ 1.000) e Conta B (R$ 500) | Transferir R$ 200 de A para B | Conta A debita 200 (saldo 800); Conta B credita 200 (saldo 700); operação atômica em transação | Automático | PASS |
| **CT16** | US34 - Orçamento Base Zero | Receitas previstas R$ 5.000; despesas planejadas | Alocar exatamente R$ 5.000 nas categorias | Saldo a alocar zera; indicador verde "Cada centavo tem um destino" | Automático | PASS |
| **CT17** | US35 - Orçamento por Evento | Evento "Férias" com teto R$ 3.000 e período definido | Lançar despesas associadas ao `event_id` | Gasto acumula contra o teto do evento e despesas ficam isoladas do orçamento mensal comum | Automático | PASS |
| **CT18** | US36 - Alertas de Orçamento 80%/100% | Limite de categoria R$ 1.000,00 | Atingir R$ 850,00 e depois R$ 1.050,00 | Dispara alerta amarelo em 85% e alerta crítico vermelho/notificação acima de 100% | Automático | PASS |
| **CT19** | US37 - Orçamento Percentual | Receita líquida do mês = R$ 8.000,00 | Configurar categoria com 20% | Limite calculado automaticamente para R$ 1.600,00 | Automático | PASS |
| **CT20** | US38 - Modo Privacidade | Valores confidenciais na tela | Ativar privacidade via `PrivacyManager` | Textos monetários mascarados como "R$ •••••" | Automático | PASS |
| **CT21** | US39 - Histórico por Categoria | Transações distribuídas em vários meses | Consultar `getMonthlyTotalsByCategory` | Agrupamento SQL GROUP BY sem carregar dataset integral em memória | Automático | PASS |
| **CT22** | US40 - Backup Criptografado | Banco populado com contas e transações | Executar `BackupService.exportBackup` | Envelope JSON criptografado AES-256-GCM; HMAC de integridade; dados sensíveis ilegíveis | Automático | PASS |
| **CT23** | US40 - Rotação de Backups | 3 backups existentes | Criar 4º backup automático | Mantém os 3 mais recentes e remove o mais antigo (`MAX_BACKUPS = 3`) | Automático | PASS |
| **CT24** | US41 - Restauração Segura | Arquivo de backup válido | Executar restauração | Cria backup de segurança prévio; valida hash; restaura schema e dados | Automático | PASS |
| **CT25** | US41 - Rejeição de Backup Corrompido | Arquivo adulterado ou de versão futura | Tentar restaurar | Rejeição imediata com erro descritivo; banco atual intacto | Automático | PASS |
| **CT26** | US42 - Contas Fixas Recorrentes | Conta de água dia 31 | Calcular status e próximo vencimento | Ajusta fevereiro para dia 28/29; indica vencimento no mês corrente | Automático | PASS |
| **CT27** | US43 - Lembretes de Vencimento | Conta vence em 3 dias | Executar rotina de verificação | Notificação silenciosa ou sonora gerada conforme preferência do usuário | Automático | PASS |
| **CT28** | US44 - Teto de Gastos Diário | Limite diário configurado em R$ 100,00 | Gastos no dia somam R$ 130,00 | Alerta visual de excesso e notificação informativa | Automático | PASS |
| **CT29** | US45 - Simulador de Rotativo e Parcelamento | Saldo devedor R$ 1.000,00, taxa 10% a.m., 3 meses | Executar `CalculateRevolvingInterestUseCase` | Parcela R$ 402,11; Total R$ 1.206,34; Juros R$ 206,34 (Fórmula Tabela Price exata) | Automático | PASS |
| **CT30** | US46 - Metas por Categoria | Categoria Alimentação meta R$ 600 | Despesas somam R$ 400 | Exibe progresso 66,7% e saldo restante R$ 200 | Automático | PASS |
| **CT31** | US47 - Limite por Transação | Limite configurado para R$ 500,00 | Tentar salvar compra de R$ 750,00 | Diálogo de aviso solicita confirmação explícita antes de persistir | Automático | PASS |
| **CT32** | US48 - Sugestão Inteligente de Categoria | Histórico com "Posto Shell" categorizado como Transporte | Digitar "Posto Shell" em nova transação | Auto-sugere Transporte sem sobrescrever escolha manual do usuário | Automático | PASS |
| **CT33** | US49 - Etiquetas Coloridas | Transação criada com tag de cor | Atualizar cor de #10B981 para #3B82F6 | Cor persistida e recuperada corretamente na entidade | Automático | PASS |
| **CT34** | US50 - Tags Livres Relacionais | Transação associada a `#urgente`, `#trabalho` | Consultar tags e deletar transação | Tags normalizadas sem `#`; cascata remove vínculos em `transaction_tags` | Automático | PASS |
| **CT35** | US51 - Transações Pendentes e Conciliação | Despesa criada com `status = 'pendente'` | Verificar saldo e extrato | Despesa não deduz do saldo disponível até ação de confirmação manual | Automático | PASS |
| **CT36** | US52 - Notificações Silenciosas | Opção "Silenciar notificações" ativada | Disparar lembrete de conta fixa | Canal `orcamento_facil_silent` sem som/vibração utilizado | Automático | PASS |
| **CT37** | Requisitos de Diálogo | Telas do app executando ações críticas | Disparar exclusão ou confirmação | Abre modais customizados (`FinanceModal`) resolvendo Promises sem `Alert.alert` | Automático | PASS |
| **CT38** | Desempenho 10k Transações | Banco populado com 10.000 registros | Executar paginação, filtros, busca e cálculo de fatura | Todas as queries e usecases executam em menos de 300 ms | Automático | PASS |
| **CT39** | Migração v3 para v7 com 10k | Banco v3 com 10.000 registros e tags legadas | Executar `runMigrations` | Migração completa, backfill relacional de tags, `user_version = 7` em 1,5s (< 3000 ms) | Automático | PASS |
| **CT40** | Fuso Horário e Datas pt-BR | Entrada de dados às 23:30 local | Formatar e persistir data | Data preserva determinismo local DD/MM/AAAA sem virar o dia por conversão UTC errônea | Automático | PASS |

---

## 3. Matriz de Rastreabilidade

| História (US) | Descrição Resumida | Casos de Teste | Arquivo de Teste Automatizado |
|---|---|---|---|
| **US27** | Recorrência automática | CT01, CT02, CT03 | `__tests__/10-transacoes-cartao-extrato.test.ts` |
| **US28** | Parcelamento inteligente | CT04, CT05, CT06, CT07 | `__tests__/10-transacoes-cartao-extrato.test.ts` |
| **US29** | Fatura de cartão nubank | CT08, CT09, CT10 | `__tests__/10-transacoes-cartao-extrato.test.ts`, `60-sprint2-integracao-e2e-e-nao-funcionais.test.ts` |
| **US30** | Extrato conta específica | CT11 | `__tests__/10-transacoes-cartao-extrato.test.ts` |
| **US31** | Extrato consolidado | CT12, CT13 | `__tests__/10-transacoes-cartao-extrato.test.ts`, `60-sprint2-integracao-e2e-e-nao-funcionais.test.ts` |
| **US32** | Ajuste de saldo retroativo | CT14 | `__tests__/10-transacoes-cartao-extrato.test.ts` |
| **US33** | Transferência entre contas | CT15 | `__tests__/10-transacoes-cartao-extrato.test.ts`, `60-sprint2-integracao-e2e-e-nao-funcionais.test.ts` |
| **US34** | Orçamento base zero | CT16 | `__tests__/20-orcamentos-limites-categorias.test.ts` |
| **US35** | Orçamento por evento | CT17 | `__tests__/20-orcamentos-limites-categorias.test.ts`, `50-sprint2-repositorio-e-telas.test.ts` |
| **US36** | Alertas de orçamento 80%/100% | CT18 | `__tests__/20-orcamentos-limites-categorias.test.ts`, `60-sprint2-integracao-e2e-e-nao-funcionais.test.ts` |
| **US37** | Orçamento percentual | CT19 | `__tests__/20-orcamentos-limites-categorias.test.ts` |
| **US38** | Modo privacidade | CT20 | `__tests__/30-backup-contasfixas-tags-config.test.ts` |
| **US39** | Histórico por categoria | CT21 | `__tests__/20-orcamentos-limites-categorias.test.ts`, `50-sprint2-repositorio-e-telas.test.ts` |
| **US40** | Backup criptografado | CT22, CT23 | `__tests__/30-backup-contasfixas-tags-config.test.ts`, `60-sprint2-integracao-e2e-e-nao-funcionais.test.ts` |
| **US41** | Restauração de backup | CT24, CT25 | `__tests__/30-backup-contasfixas-tags-config.test.ts` |
| **US42** | Central de contas fixas | CT26 | `__tests__/30-backup-contasfixas-tags-config.test.ts` |
| **US43** | Lembretes de vencimento | CT27 | `__tests__/30-backup-contasfixas-tags-config.test.ts` |
| **US44** | Limite diário de gastos | CT28 | `__tests__/20-orcamentos-limites-categorias.test.ts` |
| **US45** | Simulador rotativo / parcelas | CT29 | `__tests__/10-transacoes-cartao-extrato.test.ts` |
| **US46** | Metas por categoria | CT30 | `__tests__/20-orcamentos-limites-categorias.test.ts` |
| **US47** | Limite por transação | CT31 | `__tests__/20-orcamentos-limites-categorias.test.ts`, `50-sprint2-repositorio-e-telas.test.ts` |
| **US48** | Sugestão inteligente de categoria | CT32 | `__tests__/20-orcamentos-limites-categorias.test.ts`, `50-sprint2-repositorio-e-telas.test.ts` |
| **US49** | Etiquetas de cor | CT33 | `__tests__/30-backup-contasfixas-tags-config.test.ts` |
| **US50** | Tags livres relacionais | CT34 | `__tests__/30-backup-contasfixas-tags-config.test.ts`, `50-sprint2-repositorio-e-telas.test.ts` |
| **US51** | Transações pendentes e conciliação | CT35 | `__tests__/30-backup-contasfixas-tags-config.test.ts`, `60-sprint2-integracao-e2e-e-nao-funcionais.test.ts` |
| **US52** | Controle sensorial (som) | CT36 | `__tests__/30-backup-contasfixas-tags-config.test.ts` |
| **Diálogos** | Sistema customizado de modais | CT37 | `__tests__/40-dialog-system-and-regression.test.ts`, `50-sprint2-repositorio-e-telas.test.ts` |
| **Desempenho** | Performance 10k registros | CT38, CT39 | `__tests__/00-infra-migrations.test.ts`, `60-sprint2-integracao-e2e-e-nao-funcionais.test.ts` |
| **Datas** | Utilitário central de datas pt-BR | CT40 | `__tests__/05-date-utils.test.ts`, `60-sprint2-integracao-e2e-e-nao-funcionais.test.ts` |

---

## 4. Testes Manuais em Android (Checklist de Homologação)

Os seguintes itens demandam interação física com o sistema operacional Android, permissões em runtime ou sensores de hardware, devendo ser executados em aparelho físico ou emulador antes da publicação em produção:

### Checklist Detalhado:
1. **Notificações em Segundo Plano com o App Fechado:**
   - Fechar o aplicativo e removê-lo da bandeja de apps recentes.
   - Aguardar a rotina diária ou simular o alarme do sistema.
   - *Critério de Aceite:* O Android deve exibir a notificação de conta fixa/vencimento no painel do sistema sem travar o processo.
2. **Notificação de Limite Diário e Limite por Transação:**
   - Configurar limite diário de R$ 50,00 e limite por transação de R$ 100,00.
   - Lançar uma despesa de R$ 120,00.
   - *Critério de Aceite:* O app deve exibir o modal customizado de aviso de limite por transação antes de salvar. Ao salvar, a notificação de estouro de limite diário deve ser emitida imediatamente.
3. **Notificação Silenciosa (Controle Sensorial):**
   - Na tela de configurações, marcar a opção "Silenciar notificações do aplicativo".
   - Disparar um lembrete de conta a vencer.
   - *Critério de Aceite:* A notificação deve aparecer visualmente na barra de status sem emitir bipe sonoro nem acionar o motor de vibração do aparelho.
4. **Virada de Mês / Avanço de Data do Aparelho (Catch-up de Recorrência e Parcelas):**
   - Criar uma transação recorrente com dia fixo e um parcelamento em 3x.
   - Fechar o app, alterar a data do sistema operacional nas configurações do Android em +2 meses e reabrir o app.
   - *Critério de Aceite:* Na inicialização, o app deve disparar o catch-up sem congelar a UI, gerando as transações retroativas corretas e projetando as parcelas nos respectivos meses.
5. **Backup Automático Diário e Compartilhamento Nativo:**
   - Realizar um backup manual e verificar a geração do arquivo `.json` criptografado.
   - Clicar no botão de compartilhar backup.
   - *Critério de Aceite:* O intent de compartilhamento do Android deve abrir a folha de opções (WhatsApp, Google Drive, Gmail, etc.) com o anexo válido.
6. **Modo Privacidade com Retomada de Plano de Fundo (AppState):**
   - Ativar o Modo Privacidade (valores ocultos com "••••").
   - Minimizar o app (Home do aparelho), abrir outro aplicativo e retornar ao Orçamento Fácil.
   - *Critério de Aceite:* O estado de privacidade deve permanecer ativado, sem piscar valores reais na tela durante o resume.
7. **Modais Customizados e Comportamento com Teclado Aberto:**
   - Abrir o formulário de transação, focar em um campo de texto para subir o teclado virtual do Android.
   - Acionar o botão de exclusão ou alerta que dispara o modal customizado do app.
   - *Critério de Aceite:* O modal deve abrir com backdrop azul-escuro/cinza translúcido, renderizar centralizado sobre a tela e fechar o teclado sem quebrar o layout.
8. **Modo Avião (Offline Absoluto):**
   - Ativar o Modo Avião do aparelho (sem Wi-Fi e sem dados móveis).
   - Navegar por todas as telas do app: Extrato, Fatura do Cartão, Contas Fixas, Orçamentos, Metas e Backup.
   - *Critério de Aceite:* Operação 100% fluida, sem erros de timeout de rede, sem banners de falta de conexão e com persistência local instantânea.
9. **Inicialização a Frio com Base Populada (Cold Start):**
   - Executar o seed de 10.000 transações no banco SQLite.
   - Forçar parada do app e abrir a partir do ícone inicial.
   - *Critério de Aceite:* A tela Splash deve navegar para a HomeScreen em menos de 1,5 segundo, sem congelamento na leitura do saldo consolidado.
