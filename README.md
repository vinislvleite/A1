# Orçamento Fácil

O **Orçamento Fácil** é um aplicativo móvel de controle financeiro pessoal moderno, intuitivo e focado em privacidade. Ele funciona **100% offline**, garantindo que seus dados financeiros fiquem armazenados com total segurança exclusivamente no seu próprio dispositivo, com criptografia e isolamento individual por usuário.

---

## Funcionalidades da Sprint 1

- **Autenticação Segura e Biometria**:
  - Cadastro e login local com senha forte protegida por hash SHA-256 e Salt criptográfico.
  - Acesso biométrico por impressão digital ou reconhecimento facial (FaceID / TouchID).
  - Fluxo de recuperação de senha com perguntas de segurança locais.

- **Gestão de Contas Bancárias**:
  - Cadastro de múltiplas contas (Conta Corrente, Poupança e Cartão de Crédito).
  - Galeria de 24 cores oficiais dos principais bancos e fintechs (Nubank, Itaú, Bradesco, Santander, Banco do Brasil, Inter, Caixa, PicPay, etc.).
  - 28 ícones temáticos e cartão de pré-visualização interativo em tempo real.
  - Ajuste manual e acompanhamento dinâmico de saldos.

- **Transações Financeiras (Receitas e Despesas)**:
  - Registro ágil de entradas e saídas com formatação monetária automática (R$ 0,00).
  - Associação com contas bancárias e categorias.
  - Suporte a gastos fixos recorrentes mensais.
  - Anexo de fotos de recibos e comprovantes diretamente pela câmera ou galeria.
  - Campo de observações e anotações descritivas.
  - Lançamento retroativo com data e hora personalizadas.

- **Transferências entre Contas**:
  - Movimentação direta de valores entre contas cadastradas com transações atômicas no banco de dados (débito e crédito sincronizados com garantia de rollback em caso de falha).

- **Orçamentos Mensais por Categoria**:
  - Definição de tetos de gastos para cada categoria.
  - Barras de progresso visual com indicadores por faixa de limites:
    - Menor que 60%: Faixa regular
    - Entre 60% e 89%: Faixa de atenção
    - A partir de 90%: Alerta de teto atingido ou excedido
  - Notificações automáticas de advertência.

- **Histórico e Filtros Avançados**:
  - Listagem com paginação e busca textual instantânea com debounce.
  - Filtros combinados por tipo (receita/despesa), categoria, intervalo de datas e faixa de valores.

- **Privacidade e Gerenciamento de Dados**:
  - Banco de dados SQLite local isolado individualmente por usuário.
  - Tela de Política de Privacidade e transparência de dados locais.
  - Limpeza segura de dados por período e expurgo automático de logs de sistema de até 15 dias.

---

## Tecnologias Utilizadas

- **Framework**: [React Native](https://reactnative.dev/) com [Expo](https://expo.dev/) (SDK 52 / React 19)
- **Linguagem**: [TypeScript](https://www.typescriptlang.org/) (Modo Estrito)
- **Roteamento**: [Expo Router](https://docs.expo.dev/router/introduction/) (Navegação baseada em arquivos)
- **Banco de Dados**: SQLite Local (`react-native-sqlite-storage`)
- **Segurança**: Armazenamento seguro de chaves com `expo-crypto` e `react-native-encrypted-storage`
- **Ícones**: [Feather Icons](https://feathericons.com/) via `@expo/vector-icons`

---

## Pré-requisitos

Antes de iniciar, certifique-se de ter instalado em sua máquina:

1. **[Node.js](https://nodejs.org/)** (versão 18 ou superior)
2. **npm** ou **yarn**
3. **Ambiente Móvel**:
   - **Android**: [Android Studio](https://developer.android.com/studio) instalado com um Emulador Android configurado (AVD) e variáveis de ambiente `ANDROID_HOME` e `adb` configuradas no terminal.
   - **Dispositivo Físico**: Aplicativo [Expo Go](https://expo.dev/go) instalado no celular ou aparelho conectado via USB com depuração ativada.

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

#### Opção A: No Emulador ou Aparelho Android (Recomendado)
Com o emulador Android aberto (ou aparelho físico conectado via USB com Depuração USB ativada):
```bash
npm run android
```
Este comando compilará os binários nativos no Android e abrirá o app diretamente no seu dispositivo.

#### Opção B: Iniciar o Servidor Expo
```bash
npx expo start
```
Após o Metro Bundler iniciar, você poderá pressionar teclas no terminal para escolher o ambiente de execução:
- Pressione `a` para abrir no Emulador Android
- Pressione `i` para abrir no Simulador iOS (se estiver no macOS)
- Pressione `w` para abrir na versão Web
- Ou escaneie o QR Code no terminal com a câmera do celular (Android via app Expo Go).

---

## Atalhos Úteis do Metro Bundler

Enquanto o servidor estiver em execução no terminal:
- `r` — Recarrega o aplicativo (Reload)
- `m` — Abre o Menu de Desenvolvedor (Dev Menu) no emulador/dispositivo
- `j` — Abre o DevTools do Chrome para depuração
- `c` — Limpa a tela do terminal

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
│   ├── hooks/               # Custom hooks de tema e estados
│   ├── screens/             # Telas da aplicação com interfaces e lógica
│   └── services/            # Serviços de autenticação, biometria, logs e notificações
├── app.json                 # Configurações do Expo e metadados do app
├── package.json             # Dependências e scripts de execução
└── tsconfig.json            # Configuração estrita do TypeScript
```

## Easter Egg

ShiroFofo dentro de src/app/index.tsx