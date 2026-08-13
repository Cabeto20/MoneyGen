# MoneyGen - App de Gerenciamento Financeiro

Aplicativo React Native (Expo) para gerenciamento financeiro pessoal, com múltiplas carteiras, orçamentos, metas de economia, contas a pagar recorrentes, bloqueio por PIN/biometria e backup local.

## Funcionalidades

- ✅ Dashboard com saldo total, projeção após pagar as contas do mês e atalhos rápidos
- ✅ Receitas e despesas com edição, categorias e múltiplas carteiras
- ✅ Contas a pagar: fixas (recorrentes), parceladas e únicas — com pagamento por competência (quitar um mês não afeta os outros)
- ✅ Múltiplas carteiras/contas (dinheiro, corrente, poupança, cartão, investimento), cada uma com saldo próprio
- ✅ Orçamentos mensais por categoria, com alerta ao chegar perto ou estourar o limite
- ✅ Metas de economia com aportes, resgates e ritmo mensal necessário para bater o prazo
- ✅ Relatórios com gráfico de rosca por categoria e evolução mensal (receitas x despesas)
- ✅ Filtros avançados nas transações: período livre, categoria, carteira, tipo e busca
- ✅ Bloqueio do app por PIN e biometria (impressão digital/Face ID) — PIN guardado no Keystore/Keychain do sistema
- ✅ Notificações de vencimento (véspera às 18h, dia do vencimento às 9h, meia-noite do dia) e resumo semanal aos domingos
- ✅ Backup e restauração completos (JSON) e exportação para CSV
- ✅ Tema claro/escuro
- ✅ Formatação automática de moeda brasileira

## Estrutura do App

### 🏠 Início
- Saldo total, receitas/despesas do período e projeção descontando contas pendentes
- Atalhos para Transações, Contas, Relatórios, Orçamentos, Metas e Carteiras
- Alertas de orçamento estourado/próximo do limite e progresso das metas ativas
- Contas do mês atual com ação rápida de "marcar como paga"

### 📋 Transações
- Lista de receitas e despesas com edição (toque) e exclusão (toque longo)
- Filtros: tipo (todas/receitas/despesas), categoria, carteira, período (mês a mês ou todo o histórico) e busca por texto

### 📅 Contas
- Navegação por mês/ano
- Tipos: **Fixa** (recorrente, paga mês a mês), **Parcelada** (parcelas com vencimento próprio) e **Única** (vence uma vez)
- Marcar como paga gera a despesa automaticamente; dá para desfazer o pagamento
- Busca por descrição/categoria

### 📊 Relatórios
- Gráfico de rosca de despesas por categoria (mês atual ou todo o período)
- Evolução mensal de receitas x despesas
- Progresso das contas e do orçamento do mês

### 💰 Orçamentos
- Limite mensal por categoria de despesa, com barra de progresso e status (no limite / atenção / estourado)

### 🎯 Metas
- Metas de economia com valor-alvo, prazo opcional, aportes e resgates
- Cálculo de quanto guardar por mês para bater o prazo

### 💳 Carteiras
- Múltiplas contas/carteiras com saldo inicial e tipo (dinheiro, conta corrente, poupança, cartão, investimento)
- Ao excluir uma carteira, os lançamentos e o saldo migram para outra — nada se perde

### ⚙️ Ajustes
- Tema claro/escuro, bloqueio do app (PIN + biometria), lembretes e resumo semanal, backup e limpeza de dados

## Sistema de Notificações

- **🌙 00:00**: "Conta Vence Hoje!" (meia-noite do dia do vencimento)
- **⏰ 18:00**: "Conta vence amanhã" (véspera)
- **💳 09:00**: "Conta a Vencer" (dia do vencimento)
- **📊 Domingo 20:00**: Resumo da semana (receitas, despesas, saldo e contas em aberto) — opcional, em Ajustes
- Cancelamento automático quando a conta é paga; reagendamento se o pagamento for desfeito

## Segurança

- Bloqueio opcional por PIN de 4 dígitos e/ou biometria (impressão digital, Face ID)
- O PIN é armazenado no Keystore (Android) / Keychain (iOS) via `expo-secure-store` — nunca junto com os dados do app
- Sem o PIN cadastrado não é possível recuperá-lo; é preciso reinstalar o app (faça backup antes)

## Como executar

1. Instale as dependências:
```bash
npm install
```

2. Corrija versões se necessário:
```bash
npx expo install --fix
```

3. Execute o app:
```bash
npm start
```

4. Use o Expo Go no seu celular para escanear o QR code ou execute em um emulador.

> **Nota**: o app usa módulos nativos (`expo-local-authentication`, `expo-secure-store`, `react-native-svg`) que exigem um build customizado — o Expo Go padrão da loja pode não incluí-los. Prefira testar com um development build (`npx expo run:android`) ou o APK gerado (veja abaixo).

## Build para Produção

### Método Rápido (Recomendado)
```bash
# Execute o script automatizado (Windows)
scripts\build-apk.bat

# Ou use o comando direto
npm run build:preview
```

### Métodos Específicos

1. **APK Debug** (mais rápido, para testes):
```bash
npm run build:apk-debug
```

2. **APK Release** (otimizado, para distribuição):
```bash
npm run build:apk-release
```

3. **Preview** (padrão):
```bash
npm run build:preview
```

4. **Production** (AAB para Google Play Store):
```bash
npm run build:production
```

5. **Build Local** (requer Android Studio + JDK 17 instalados e `ANDROID_HOME` configurado):
```bash
npm run build:local
```

### Pré-requisitos para Build

**Build na nuvem (EAS)**:
1. Instale o EAS CLI:
```bash
npm install -g @expo/eas-cli
```
2. Faça login na Expo:
```bash
eas login
```
3. Configure o projeto (primeira vez):
```bash
eas build:configure
```

**Build local** (`npm run build:apk-release` / `build:local`): requer JDK 17+ e Android SDK instalados, com `ANDROID_HOME` (ou `android/local.properties` → `sdk.dir`) apontando para o SDK. Sem isso o Gradle falha na primeira etapa.

**📖 Guia completo**: veja [BUILD_GUIDE.md](BUILD_GUIDE.md) para instruções detalhadas.

## Scripts de Manutenção

Para limpar todos os dados:
```bash
# Windows
scripts/clear-data.bat

# Node.js
node scripts/clear-data.js
```

## Diagnóstico e Correções

Para verificar problemas no projeto:
```bash
npx expo-doctor
```

Para corrigir dependências:
```bash
npx expo install --fix
```

## Tecnologias

- React Native 0.81.5
- Expo SDK 54
- React Navigation (Bottom Tabs + Native Stack)
- AsyncStorage para persistência local
- Expo Notifications (com canal dedicado no Android)
- Expo Secure Store (PIN) + Expo Local Authentication (biometria)
- Expo File System & Sharing (backup/exportação)
- React Native SVG (gráfico de rosca)
- DateTimePicker
- React Hooks (useState, useEffect, useFocusEffect, useMemo, useCallback)
- Ionicons
- EAS Build para builds na nuvem

## Modelo de dados

Os dados vivem inteiramente no dispositivo (AsyncStorage), sem backend. Não há sincronização em nuvem — use o backup em Ajustes para não perder dados ao trocar de aparelho.

- **Transações**: receitas/despesas, com categoria, carteira e data
- **Contas**: fixas (recorrentes, com competências pagas em `paidMonths`), parceladas (cada parcela com vencimento próprio) e únicas
- **Carteiras**: saldo inicial + soma das transações vinculadas
- **Orçamentos**: limite mensal por categoria de despesa
- **Metas**: valor-alvo, prazo opcional e histórico de aportes/resgates

Dados de versões anteriores do app são migrados automaticamente na primeira abertura (inclusive backups antigos restaurados).

## Estrutura de arquivos

```
MoneyGen/
├── components/
│   ├── HomeScreen.js            # Dashboard principal
│   ├── TransactionsScreen.js    # Lista e filtros de transações
│   ├── TransactionForm.js       # Formulário compartilhado de receita/despesa
│   ├── AddTransactionScreen.js  # Wrapper: nova/editar receita
│   ├── AddExpenseScreen.js      # Wrapper: nova/editar despesa
│   ├── BillsScreen.js           # Gerenciamento de contas
│   ├── AddBillScreen.js         # Formulário de conta
│   ├── BudgetsScreen.js         # Orçamentos por categoria
│   ├── GoalsScreen.js           # Metas de economia
│   ├── AddGoalScreen.js         # Formulário de meta
│   ├── AccountsScreen.js        # Carteiras/contas
│   ├── AddAccountScreen.js      # Formulário de carteira
│   ├── StatsScreen.js           # Relatórios e gráfico de rosca
│   ├── DonutChart.js            # Gráfico de rosca (SVG)
│   ├── SecurityScreen.js        # Configuração de PIN/biometria
│   ├── LockScreen.js            # Tela de desbloqueio
│   ├── LockGate.js              # Overlay de bloqueio do app
│   ├── PinPad.js                # Teclado numérico de PIN
│   ├── SettingsScreen.js        # Ajustes
│   ├── BackupScreen.js          # Backup e exportação
│   ├── CategoryPicker.js        # Seletor de categoria
│   ├── AccountPicker.js         # Seletor de carteira
│   └── SearchBar.js             # Busca reutilizável
├── database/
│   └── database.js              # Persistência (AsyncStorage) e migrações
├── utils/
│   ├── billHelpers.js           # Regras de recorrência/competência de contas
│   ├── dateHelpers.js           # Datas, competências e formatação
│   ├── categories.js            # Categorias, cores e ícones
│   ├── security.js              # PIN (SecureStore) e biometria
│   ├── notifications.js         # Agendamento de notificações
│   ├── weeklySummary.js         # Texto e agendamento do resumo semanal
│   ├── formatCurrency.js        # Formatação de moeda
│   ├── useAmountInput.js        # Hook de campo de valor monetário
│   ├── validateAmount.js        # Validação de valores
│   └── id.js                    # Geração de ids
├── scripts/
│   ├── clear-data.js            # Script de limpeza (via adb)
│   ├── clear-data.bat           # Script Windows
│   └── README.md                # Documentação dos scripts
├── App.js                       # Navegação principal e inicialização
└── package.json                 # Dependências
```
