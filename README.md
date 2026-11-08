# Orçamento Fácil

[![React Native](https://img.shields.io/badge/React_Native-0.86-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-57-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-Offline_First-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)

O **Orçamento Fácil** é um aplicativo mobile de controle financeiro pessoal moderno, intuitivo e com foco em **privacidade e segurança**. 

Ele funciona **100% offline**, armazenando todos os registros contábeis exclusivamente no próprio dispositivo por meio de um banco de dados SQLite local, com isolamento multiusuário e criptografia derivada de senha (SHA-256 + HMAC).

---

## Destaques da Aplicação

- **Design Fintech Dark Minimalista:** Interface uniforme nos tons `#0F172A`, `#1E293B`, `#2563EB` e `#60A5FA`, com componentes padronizados e microinterações fluidas.
- **100% Offline e Privacidade Total:** Os dados financeiros permanecem restritos ao armazenamento interno do aparelho celular.
- **Modo Cortina de Privacidade:** Ocultação e revelação instantânea de saldos e valores monetários em toda a interface com um toque.
- **Backup Criptografado e Portabilidade:** Rotinas de backup automático diário com rotação interna e suporte à importação/exportação de backups externos em JSON seguro.
- **Clean Architecture:** Separação estrita entre Apresentação (Screens e Components), Domínio (Entities e UseCases), Dados (Repositories e SQLite) e Serviços de Infraestrutura.

---

## Funcionalidades Principais

### 💳 Cartões de Crédito & Contas
- **Ciclo e Fatura Inteligente:** Cálculo preciso de fechamento inclusivo, vencimento, fatura aberta e limite disponível/utilizado.
- **Parcelamento Automático:** Divisão de compras em até 48 parcelas mensais (`1/N` a `N/N`) com distribuição automática nos ciclos futuros.
- **Múltiplas Contas & Extrato Consolidado:** Contas correntes, poupanças e cartões com saldo acumulado progressivo linha a linha e transferências atômicas.
- **Simulador de Rotativo:** Cálculo imediato de juros compostos sobre o saldo devedor do cartão.

### 📊 Orçamentos & Planejamento
- **Modelos Avançados de Orçamento:** Mensal, anual, flexível (ajuste por receita), base zero (Zero-Based) e por eventos (viagens, festas).
- **Tetos de Gastos:** Limite diário parametrizável por dia da semana e teto individual por transação com alerta imediato.
- **Metas por Categoria:** Painel com indicadores visuais de progresso e status em tempo real.

### 🔄 Recorrência & Contas a Pagar
- **Lançamentos Recorrentes:** Projeção e duplicação automática de receitas e despesas mensais com catch-up.
- **Central de Contas Fixas & Boletos:** Calendário de vencimentos com status (*Pendente*, *Pago*, *Vencendo*) e lembretes antecipados.
- **Classificação Inteligente:** Tags livres personalizadas, etiquetas visuais coloridas e autossugestão de categorias por palavras-chave.

### 🛡️ Privacidade, Segurança & Sistema
- **100% Offline & Criptografia:** Persistência relacional em SQLite local com hash SHA-256 e HMAC.
- **Modo Cortina de Privacidade:** Ocultação e revelação instantânea de todos os saldos e valores monetários com um toque.
- **Backup Criptografado com Rotação:** Backups diários automáticos (retenção de 7 dias) e importação/exportação externa de arquivo `.json`.
- **Controle Sensorial:** Alternância entre alertas sonoros e modo silencioso para notificações financeiras.
- **Diálogos Próprios Padronizados:** Sistema de modais nativo consistente com a identidade dark fintech.

---

## Tecnologias Utilizadas

| Camada | Tecnologia | Descrição |
|---|---|---|
| **Framework** | [React Native 0.86](https://reactnative.dev/) | Desenvolvimento nativo multiplataforma |
| **Plataforma** | [Expo 57](https://expo.dev/) | Ferramental moderno com suporte a módulos nativos |
| **Linguagem** | [TypeScript 6.0](https://www.typescriptlang.org/) | Modo estrito (`strict: true`), tipagem estrita sem uso de `any` |
| **Roteamento** | [Expo Router](https://docs.expo.dev/router/introduction/) | Navegação baseada em sistema de arquivos |
| **Banco de Dados** | SQLite Local (`react-native-sqlite-storage`) | Persistência relacional nativa com transações ACID |
| **Segurança** | `expo-crypto` e `react-native-encrypted-storage` | Derivação de chaves PBKDF2/SHA-256, HMAC e keychain |
| **Ícones** | [Feather Icons](https://feathericons.com/) | Conjunto vetorial via `@expo/vector-icons` |

---

## Arquitetura do Projeto

O código segue os princípios de **Clean Architecture** e **Domain-Driven Design (DDD)**:

```text
orcamentofacil/
├── src/
│   ├── app/                      # Rotas e navegação via Expo Router
│   │   ├── _layout.tsx           # Layout raiz com tema escuro e StatusBar
│   │   ├── (tabs)/               # Abas principais (Home, Transações, Orçamentos, Contas)
│   │   ├── spending-goals.tsx    # Rota da Tela de Metas de Gastos
│   │   ├── statement.tsx         # Rota do Extrato Bancário Consolidado
│   │   ├── bills.tsx             # Rota de Contas Fixas e Recorrentes
│   │   ├── card-detail.tsx       # Rota de Fatura e Detalhes do Cartão
│   │   ├── backup.tsx            # Rota de Backup e Segurança
│   │   └── ...
│   ├── components/               # Componentes reutilizáveis (MoneyText, Modais, Cards)
│   ├── context/                  # Provedores de estado global (PrivacyContext)
│   ├── data/
│   │   ├── database/             # Instância SQLite, DDL de esquemas e migrações versionadas
│   │   └── repositories/         # Padrão Repository (Account, Transaction, Budget, Bill)
│   ├── domain/
│   │   ├── entities/             # Modelos de domínio (Transaction, Account, Budget, RecurringBill)
│   │   └── usecases/             # Casos de uso de negócio (Balance, Invoice, Goals, etc.)
│   ├── screens/                  # Telas com interface visual e orquestração de estados
│   ├── services/                 # Serviços de infraestrutura (BackupService, NotificationService, Sugestões)
│   └── utils/                    # Funções utilitárias (moeda, datas, UUID, validações)
├── .gitignore                    # Regras de exclusão de artefatos temporários e segredos
├── app.json                      # Configurações do Expo
├── package.json                  # Dependências e scripts npm
└── tsconfig.json                 # Configurações do TypeScript
```

---

## Pré-requisitos

1. **[Node.js](https://nodejs.org/)** (v18.x ou superior)
2. **npm** (incluso com o Node.js)
3. **Ambiente Móvel:**
   - **Android:** [Android Studio](https://developer.android.com/studio) com emulador AVD configurado e variáveis `ANDROID_HOME` e `adb` presentes no PATH.
   - **Dispositivo Físico:** Celular Android com depuração USB habilitada ou aplicativo [Expo Go](https://expo.dev/go).

---

## Como Executar

### 1. Clonar o repositório
```bash
git clone <URL_DO_REPOSITORIO>
cd orcamentofacil
```

### 2. Instalar as dependências
```bash
npm install
```

### 3. Checagem de tipos TypeScript
```bash
npx tsc --noEmit
```

### 4. Iniciar a aplicação

**Modo Android Direto:**
```bash
npm run android
```

**Modo Metro Bundler (Expo):**
```bash
npx expo start
```
No terminal do Metro, pressione:
- `a` para abrir no Emulador Android
- `w` para abrir a versão Web
- `r` para recarregar a aplicação

---

## Backlog do Produto (78 Histórias)

| Sprint | Foco Principal | Histórias | Status |
|---|---|:---:|:---:|
| **Sprint 1** | **Fundação:** Autenticação biométrica, contas, transações, categorias e extrato | US01 a US26 | ✅ Concluída |
| **Sprint 2** | **Inteligência:** Recorrência, parcelamento, faturas, tetos, backup e modo sensorial | US27 a US52 | ✅ Concluída |
| **Sprint 3** | **Análise Avançada:** Gráficos, relatórios anuais, projeções de saldo e multi-moeda | US53 a US78 | ⏳ Planejada |

<details>
<summary><b>Ver detalhamento da Sprint 1 (US01 a US26)</b></summary>

| # | História |
|---|---|
| US01 | Fazer login com e-mail/usuário e senha, para acessar os dados financeiros com segurança. |
| US02 | Ativar a autenticação por impressão digital para abrir o aplicativo, para adicionar uma camada extra de segurança. |
| US03 | Registrar uma transação informando valor, data, descrição, categoria e tipo, para manter o controle financeiro. |
| US04 | Visualizar a lista de transações ordenadas por data decrescente, com rolagem infinita. |
| US05 | Editar ou excluir uma transação existente, com diálogo de confirmação antes da exclusão. |
| US06 | Visualizar o saldo atual, atualizado automaticamente a cada alteração. |
| US07 | Definir um orçamento mensal por categoria e visualizar um indicador de progresso. |
| US08 | Cadastrar múltiplas contas (corrente, poupança, cartão de crédito) e associar transações a contas específicas. |
| US09 | Visualizar o saldo total combinado das contas, além do saldo individual de cada uma. |
| US10 | Informar um saldo inicial ao criar uma conta. |
| US11 | Personalizar as categorias de transação, adicionando novas e renomeando as existentes. |
| US12 | Visualizar um resumo diário na tela inicial, com saldo do dia, transações recentes e orçamento restante. |
| US13 | Buscar transações por descrição, categoria ou período de datas. |
| US14 | Aplicar um filtro avançado combinando categoria, tipo, valor mínimo, valor máximo e período. |
| US15 | Classificar as transações por valor, data ou categoria. |
| US16 | Adicionar transações retroativas, com data e hora personalizadas. |
| US17 | Ser notificado ao atingir 90% ou exceder o orçamento de uma categoria. |
| US18 | Cadastrar um gasto fixo recorrente, incluído automaticamente no cálculo do orçamento mensal. |
| US19 | Transferir valores entre contas, com débito e crédito sincronizados. |
| US20 | Ajustar o saldo de uma conta manualmente, sem precisar adicionar uma transação. |
| US21 | Personalizar o nome, ícone e cor de uma conta. |
| US22 | Consultar em tempo real o saldo disponível de cada conta. |
| US23 | Anexar uma foto ou comprovante a uma transação, utilizando a câmera do dispositivo. |
| US24 | Adicionar notas em um campo de texto livre a uma transação. |
| US25 | Apagar transações de um período selecionado, com confirmação dupla. |
| US26 | Acessar a política de privacidade do aplicativo. |

</details>

<details>
<summary><b>Ver detalhamento da Sprint 2 (US27 a US52)</b></summary>

| # | História |
|---|---|
| US27 | Categorizar uma transação como recorrente, duplicada automaticamente no mês seguinte. |
| US28 | Parcelar uma despesa em várias parcelas, distribuídas automaticamente ao longo dos meses seguintes. |
| US29 | Informar a fatura do cartão de crédito e visualizar valor gasto, limite disponível e vencimento. |
| US30 | Visualizar um extrato filtrado por uma conta específica. |
| US31 | Visualizar um extrato bancário consolidado do mês, com saldo acumulado por linha. |
| US32 | Definir um orçamento anual por categoria, além do mensal. |
| US33 | Criar um orçamento flexível, que se ajusta automaticamente conforme a receita do mês. |
| US34 | Utilizar um orçamento zero-based, alocando cada real da receita a uma categoria. |
| US35 | Definir um orçamento específico para um evento, como uma viagem ou festa. |
| US36 | Definir um teto de gasto diário, variável por dia da semana. |
| US37 | Definir um limite de gastos por transação, com alerta ao ser excedido. |
| US38 | Definir uma meta de gastos para uma categoria específica. |
| US39 | Ativar um modo de tela de segurança que oculte os valores monetários. |
| US40 | Realizar backup automático diário dos dados em arquivo criptografado. |
| US41 | Restaurar um backup previamente realizado (interno ou arquivo externo .json). |
| US42 | Receber lembretes para pagamento de contas fixas, antes do vencimento. |
| US43 | Visualizar uma lista de contas fixas a pagar, ordenada por vencimento. |
| US44 | Registrar uma fonte de renda extra, separada das receitas fixas. |
| US45 | Utilizar um cartão de crédito rotativo, calculando os juros sobre o saldo devedor. |
| US46 | Visualizar o histórico completo de uma categoria, com totais por mês. |
| US47 | Adicionar uma descrição detalhada a uma categoria. |
| US48 | Receber sugestão automática de categoria com base em palavras-chave da descrição. |
| US49 | Etiquetar transações com cores, para identificação visual rápida. |
| US50 | Adicionar tags livres a uma transação e buscar por essas tags. |
| US51 | Marcar uma transação como "pendente", com status de confirmação manual. |
| US52 | Desativar o som das notificações financeiras. |

</details>

<details>
<summary><b>Ver detalhamento da Sprint 3 (US53 a US78)</b></summary>

| # | História |
|---|---|
| US53 | Visualizar um relatório mensal com receitas, despesas, saldo e gastos por categoria, em texto e gráfico. |
| US54 | Visualizar um gráfico de evolução do saldo ao longo do tempo. |
| US55 | Visualizar um dashboard com indicadores-chave em cards. |
| US56 | Acessar um modo de visão rápida com totais, orçamentos e saldo em uma única tela. |
| US57 | Gerar um relatório anual compartilhável como imagem. |
| US58 | Visualizar um resumo do ano em uma grade mensal. |
| US59 | Comparar os gastos de um mês com o mês anterior ou com o mesmo mês do ano anterior. |
| US60 | Visualizar uma análise dos gastos por dia da semana. |
| US61 | Visualizar um gráfico de fluxo de caixa em cascata. |
| US62 | Visualizar um gráfico de dispersão relacionando gastos e renda. |
| US63 | Comparar os gastos por categoria com a média nacional. |
| US64 | Receber identificação automática de categorias com aumento de gastos. |
| US65 | Receber recomendações de economia com base nas categorias mais caras. |
| US66 | Visualizar uma previsão dos gastos para o restante do mês. |
| US67 | Visualizar o gasto diário médio e a previsão do total do mês. |
| US68 | Visualizar uma previsão de saldo para os próximos 30 dias. |
| US69 | Definir metas de economia, com valor alvo e data limite. |
| US70 | Definir uma reserva de emergência, como um valor alvo a acompanhar. |
| US71 | Simular um investimento com juros compostos. |
| US72 | Simular um planejamento de aposentadoria. |
| US73 | Exportar as transações para um arquivo CSV. |
| US74 | Importar transações a partir de um arquivo CSV. |
| US75 | Importar dados bancários a partir de um arquivo OFX ou QIF. |
| US76 | Convidar outra pessoa para gerenciar um orçamento compartilhado. |
| US77 | Adicionar um observador ao orçamento, com acesso somente leitura. |
| US78 | Registrar transações em outras moedas, com conversão automática pela cotação do dia. |

</details>

---

## Requisitos Não Funcionais

- **Compatibilidade Android:** Desenvolvido com foco em Android (API 23+ / Android 6.0 Marshmallow ou superior).
- **Criptografia Local e Isolamento:** Todos os dados persistidos em SQLite com hash SHA-256 e salting; comunicação externa restrita a HTTPS.
- **Identidade Visual:** Design system neutro fintech em tons escuros (`#0F172A`, `#1E293B`, `#2563EB`).
- **Desempenho:** Carregamento inicial inferior a 1,5s; filtragem e listagem abaixo de 300ms com milhares de registros.
- **Eficiência Energética:** Gerenciamento via `AppState` para suspender processos em segundo plano e preservar bateria.
- **Clean Architecture:** Desacoplamento estrito entre apresentação, casos de uso, repositórios e banco de dados.
- **Logs Não Sensíveis:** Registro restrito a erros de sistema, sem inclusão de dados financeiros pessoais e retenção máxima de 15 dias.

---

## Easter Egg

ShiroBonzinho dentro de `src/app/index.tsx`.
