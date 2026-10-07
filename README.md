# Orçamento Fácil

O **Orçamento Fácil** é um aplicativo móvel de controle financeiro pessoal moderno, intuitivo e focado em privacidade. Ele funciona **100% offline**, garantindo que seus dados financeiros fiquem armazenados com total segurança exclusivamente no seu próprio dispositivo, com criptografia e isolamento individual por usuário.

---

## Funcionalidades da Sprint 1

- **Autenticação Segura e Biometria**
  - Cadastro e login local com senha forte protegida por hash SHA-256 e Salt criptográfico.
  - Acesso biométrico por impressão digital ou reconhecimento facial (FaceID / TouchID).
  - Fluxo de recuperação de senha com perguntas de segurança locais.

- **Gestão de Contas Bancárias**
  - Cadastro de múltiplas contas (Conta Corrente, Poupança e Cartão de Crédito).
  - Galeria de 24 cores oficiais dos principais bancos e fintechs (Nubank, Itaú, Bradesco, Santander, Banco do Brasil, Inter, Caixa, PicPay, etc.).
  - 28 ícones temáticos e cartão de pré-visualização interativo em tempo real.
  - Ajuste manual e acompanhamento dinâmico de saldos.

- **Transações Financeiras (Receitas e Despesas)**
  - Registro ágil de entradas e saídas com formatação monetária automática (R$ 0,00).
  - Associação com contas bancárias e categorias.
  - Suporte a gastos fixos recorrentes mensais.
  - Anexo de fotos de recibos e comprovantes diretamente pela câmera ou galeria.
  - Campo de observações e anotações descritivas.
  - Lançamento retroativo com data e hora personalizadas.

- **Transferências entre Contas**
  - Movimentação direta de valores entre contas cadastradas com transações atômicas no banco de dados (débito e crédito sincronizados com garantia de rollback em caso de falha).

- **Orçamentos Mensais por Categoria**
  - Definição de tetos de gastos para cada categoria.
  - Barras de progresso visual com indicadores por faixa de limites:
    - Menor que 60%: faixa regular
    - Entre 60% e 89%: faixa de atenção
    - A partir de 90%: alerta de teto atingido ou excedido
  - Notificações automáticas de advertência.

- **Histórico e Filtros Avançados**
  - Listagem com paginação e busca textual instantânea com debounce.
  - Filtros combinados por tipo (receita/despesa), categoria, intervalo de datas e faixa de valores.

- **Privacidade e Gerenciamento de Dados**
  - Banco de dados SQLite local isolado individualmente por usuário.
  - Tela de Política de Privacidade e transparência de dados locais.
  - Limpeza segura de dados por período e expurgo automático de logs de sistema de até 15 dias.

---

## Tecnologias Utilizadas

| Camada | Tecnologia |
|---|---|
| Framework | [React Native](https://reactnative.dev/) com [Expo](https://expo.dev/) (SDK 52 / React 19) |
| Linguagem | [TypeScript](https://www.typescriptlang.org/) (modo estrito) |
| Roteamento | [Expo Router](https://docs.expo.dev/router/introduction/) (navegação baseada em arquivos) |
| Banco de Dados | SQLite local (`react-native-sqlite-storage`) |
| Segurança | `expo-crypto` e `react-native-encrypted-storage` |
| Ícones | [Feather Icons](https://feathericons.com/) via `@expo/vector-icons` |

---

## Pré-requisitos

1. **[Node.js](https://nodejs.org/)** (versão 18 ou superior)
2. **npm** ou **yarn**
3. **Ambiente móvel**:
   - **Android**: [Android Studio](https://developer.android.com/studio) com um Emulador Android (AVD) configurado e as variáveis de ambiente `ANDROID_HOME` e `adb` configuradas no terminal.
   - **Dispositivo físico**: aplicativo [Expo Go](https://expo.dev/go) instalado no celular, ou aparelho conectado via USB com depuração ativada.

---

## Como Executar o Projeto

### 1. Clonar o repositório

```bash
git clone <URL_DO_REPOSITORIO>
cd orcamentofacil
```

### 2. Instalar as dependências

```bash
npm install
```

### 3. Iniciar a aplicação

**Opção A — Emulador ou aparelho Android (recomendado)**

Com o emulador aberto (ou aparelho físico conectado via USB com depuração ativada):

```bash
npm run android
```

Este comando compila os binários nativos e abre o app diretamente no dispositivo.

**Opção B — Servidor Expo**

```bash
npx expo start
```

Com o Metro Bundler em execução, use as teclas do terminal para escolher o ambiente:

| Tecla | Ação |
|---|---|
| `a` | Abre no emulador Android |
| `i` | Abre no simulador iOS (somente macOS) |
| `w` | Abre a versão Web |
| — | Ou escaneie o QR Code com o app Expo Go |

---

## Atalhos do Metro Bundler

| Tecla | Ação |
|---|---|
| `r` | Recarrega o aplicativo |
| `m` | Abre o Menu de Desenvolvedor |
| `j` | Abre o DevTools do Chrome |
| `c` | Limpa a tela do terminal |

---

## Estrutura de Pastas

```text
orcamentofacil/
├── assets/                  # Ícones, imagens de splash e recursos visuais
├── src/
│   ├── app/                 # Rotas e páginas do Expo Router
│   │   ├── _layout.tsx      # Layout raiz com tema e provedores de navegação
│   │   ├── accounts.tsx     # Rota de listagem de contas
│   │   ├── budgets.tsx      # Rota de orçamentos mensais
│   │   ├── transfer.tsx     # Rota de transferências
│   │   └── ...
│   ├── components/          # Componentes reutilizáveis (inputs, botões, modais)
│   ├── constants/           # Constantes de tema, cores e fontes
│   ├── data/
│   │   ├── database/        # Inicialização do SQLite, DDL de esquemas e migrações
│   │   └── repositories/    # Repositórios de acesso a dados (CRUD de contas, transações, etc.)
│   ├── domain/
│   │   ├── entities/        # Modelos de domínio (User, Account, Transaction, Budget)
│   │   └── usecases/        # Regras contábeis e casos de uso de cálculos
│   ├── hooks/                # Custom hooks de tema e estados
│   ├── screens/              # Telas da aplicação com interfaces e lógica
│   └── services/             # Serviços de autenticação, biometria, logs e notificações
├── app.json                  # Configurações do Expo e metadados do app
├── package.json               # Dependências e scripts de execução
└── tsconfig.json               # Configuração estrita do TypeScript
```

---

## Backlog do Produto

Histórias de usuário no formato "Como [usuário], quero [ação], para que [benefício]", organizadas em 3 sprints de tamanho equilibrado (26 histórias cada), cobrindo a totalidade dos requisitos funcionais e não funcionais do projeto.

### Sprint 1

| # | História |
|---|---|
| US01 | Fazer login com e-mail/usuário e senha, para acessar os dados financeiros com segurança. |
| US02 | Ativar a autenticação por impressão digital para abrir o aplicativo, para adicionar uma camada extra de segurança. |
| US03 | Registrar uma transação informando valor, data, descrição, categoria e tipo, para manter o controle do que entra e sai do dinheiro. |
| US04 | Visualizar a lista de transações ordenadas por data decrescente, com rolagem infinita. |
| US05 | Editar ou excluir uma transação existente, com diálogo de confirmação antes da exclusão. |
| US06 | Visualizar o saldo atual, atualizado automaticamente a cada alteração. |
| US07 | Definir um orçamento mensal por categoria e visualizar um indicador de progresso. |
| US08 | Cadastrar múltiplas contas (corrente, poupança, cartão de crédito) e associar cada transação a uma conta específica. |
| US09 | Visualizar o saldo total combinado das contas, além do saldo individual de cada uma. |
| US10 | Informar um saldo inicial ao criar uma conta. |
| US11 | Personalizar as categorias de transação, adicionando novas e renomeando as existentes. |
| US12 | Visualizar um resumo diário na tela inicial, com saldo do dia, transações recentes e orçamento restante do mês. |
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

### Sprint 2

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
| US41 | Restaurar um backup previamente realizado. |
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

### Sprint 3

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

### Requisitos Não Funcionais

Aplicam-se a todas as sprints, por serem critérios de qualidade transversais:

- Desenvolvimento exclusivo para Android, compatível a partir da versão 6.0 (Marshmallow).
- Criptografia de todos os dados armazenados localmente; comunicação externa exclusivamente via HTTPS.
- Interface com esquema de cores neutro, em tons de azul e cinza.
- Carregamento inicial inferior a 1,5 segundo; listagem e filtragem inferiores a 300 milissegundos, mesmo com até 10.000 transações.
- Uso do `AppState` para pausar processamento em segundo plano e reduzir o consumo de bateria.
- Código estruturado em Clean Architecture, com separação entre dados, regras de negócio e apresentação.
- Logs limitados a erros críticos, sem dados sensíveis, com retenção máxima de 15 dias.
- Funcionamento completo das funcionalidades principais sem conexão com a internet.

---

## Easter Egg

ShiroFofo dentro de `src/app/index.tsx`.
