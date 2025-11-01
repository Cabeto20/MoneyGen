# MoneyGen - App de Gerenciamento Financeiro

Um aplicativo React Native completo para gerenciamento financeiro pessoal com tema escuro (preto e roxo), notificações e backup.

## Funcionalidades

- ✅ Navegação por abas com ícones
- ✅ Dashboard com saldo total em tempo real
- ✅ Gerenciamento de contas (fixas, parceladas, únicas)
- ✅ Registro de receitas e despesas
- ✅ Filtros por mês e tipo de transação
- ✅ Notificações de vencimento (meia-noite, dia anterior, dia do vencimento)
- ✅ Backup e restauração de dados
- ✅ Exportação para Excel (CSV)
- ✅ Seletor de data com calendário
- ✅ Categorias organizadas por tipo
- ✅ Formatação automática de moeda brasileira
- ✅ Interface com tema escuro (preto e roxo)
- ✅ Build Android otimizado com EAS Build

## Estrutura do App

### 🏠 Aba Início
- Dashboard com saldo total, receitas e despesas
- Contas do mês atual com status de vencimento
- Ação rápida para marcar contas como pagas

### 📋 Aba Transações
- Lista completa de todas as transações
- Filtros: Todas, Receitas, Despesas
- Filtros por mês: Anterior, Este Mês, Todos
- Detalhes com categoria, data e valor formatado

### 📅 Aba Contas
- Gerenciamento completo de contas a pagar
- Navegação por mês/ano com setas
- Tipos de conta: Fixa, Parcelada, Única
- Botões para nova conta e nova receita
- Seletor de data com calendário
- Categorias específicas para contas

### ☁️ Aba Backup
- Criar backup completo dos dados (JSON)
- Restaurar backup de arquivo
- Exportar dados para Excel (CSV)
- Compartilhamento de arquivos

## Tipos de Conta

- **Fixa**: Contas recorrentes mensais (aluguel, energia)
- **Parcelada**: Divide em múltiplas parcelas numeradas
- **Única**: Conta pontual que vence apenas uma vez

## Sistema de Notificações

- **🌙 00:00**: "Conta Vence Hoje!" (meia-noite do dia)
- **⏰ 18:00**: "Conta vence amanhã" (dia anterior)
- **💳 09:00**: "Conta a Vencer" (dia do vencimento)
- Cancelamento automático quando conta é paga

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

## Build para Produção

1. Build Android APK:
```bash
eas build --platform android --profile preview
```

2. Build para produção:
```bash
eas build --platform android --profile production
```

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

- React Native 0.72.10
- Expo SDK 49
- React Navigation (Bottom Tabs + Stack)
- AsyncStorage para persistência
- Expo Notifications
- Expo File System & Sharing
- DateTimePicker
- React Hooks (useState, useEffect, useFocusEffect)
- Ionicons
- EAS Build para builds otimizados

## Dependências principais

- `@react-navigation/native@^6.1.7` - Navegação
- `@react-navigation/bottom-tabs@^6.5.8` - Abas inferiores
- `@react-navigation/stack@^6.3.17` - Navegação em pilha
- `@react-native-async-storage/async-storage@1.18.2` - Armazenamento
- `expo-notifications@~0.20.1` - Notificações push
- `expo-file-system@~15.4.5` - Manipulação de arquivos
- `expo-sharing@~11.5.0` - Compartilhamento
- `expo-document-picker@~11.5.4` - Seletor de documentos
- `@react-native-community/datetimepicker@7.2.0` - Seletor de data

## Cores do tema

- Fundo principal: #000 (preto)
- Cards: #1a1a1a (cinza escuro)
- Destaque/Ativo: #8b5cf6 (roxo)
- Receitas: #10b981 (verde)
- Despesas: #ef4444 (vermelho)
- Texto secundário: #ccc (cinza claro)
- Bordas: #333 (cinza escuro)

## Estrutura de arquivos

```
FinaManagement/
├── components/
│   ├── HomeScreen.js           # Dashboard principal
│   ├── TransactionsScreen.js   # Lista de transações
│   ├── BillsScreen.js          # Gerenciamento de contas
│   ├── AddBillScreen.js        # Formulário de conta
│   ├── AddTransactionScreen.js # Formulário de receita
│   ├── AddExpenseScreen.js     # Formulário de despesa
│   └── BackupScreen.js         # Backup e exportação
├── database/
│   └── database.js             # Funções do AsyncStorage
├── utils/
│   ├── formatCurrency.js       # Formatação de moeda
│   └── notifications.js        # Sistema de notificações
├── scripts/
│   ├── clear-data.js           # Script de limpeza
│   ├── clear-data.bat          # Script Windows
│   └── README.md               # Documentação dos scripts
├── App.js                      # Navegação principal
└── package.json                # Dependências
```
