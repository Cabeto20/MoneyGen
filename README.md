# FinaManagement - App de Gerenciamento Financeiro

Um aplicativo React Native para gerenciamento financeiro pessoal com tema escuro (preto e roxo) e navegação por abas.

## Funcionalidades

- ✅ Navegação por abas com ícones
- ✅ Visualização do saldo total em tempo real
- ✅ Registro de receitas e despesas com formatação de moeda
- ✅ Lista completa de transações com filtros
- ✅ Categorias organizadas por tipo
- ✅ Persistência de dados com AsyncStorage
- ✅ Interface com tema escuro (preto e roxo)
- ✅ Formatação automática de valores em Real (R$)
- ✅ Atualização automática entre abas

## Estrutura do App

### 🏠 Aba Início
- Cartão de saldo com total, receitas e despesas
- Formulário para adicionar novas transações
- Lista das transações mais recentes
- Formatação em tempo real do valor digitado

### 📋 Aba Transações
- Lista completa de todas as transações
- Filtros: Todas, Receitas, Despesas
- Detalhes com categoria, data e valor
- Atualização automática ao receber foco

### 🏷️ Aba Categorias
- Categorias de despesas: Alimentação, Transporte, Moradia, Saúde, Educação, Lazer
- Categorias de receitas: Salário, Freelance, Investimentos
- Interface visual com ícones coloridos

## Como executar

1. Instale as dependências:
```bash
npm install
```

2. Execute o app:
```bash
npm start
```

3. Use o Expo Go no seu celular para escanear o QR code ou execute em um emulador.

## Tecnologias

- React Native
- Expo SDK 54
- React Navigation (Bottom Tabs)
- AsyncStorage para persistência
- React Hooks (useState, useEffect, useFocusEffect)
- Ionicons
- Formatação de moeda brasileira (Intl.NumberFormat)

## Dependências principais

- `@react-navigation/native` - Navegação
- `@react-navigation/bottom-tabs` - Abas inferiores
- `@react-native-async-storage/async-storage` - Armazenamento local
- `@expo/vector-icons` - Ícones
- `expo-status-bar` - Barra de status

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
│   ├── HomeScreen.js          # Tela inicial
│   ├── TransactionsScreen.js  # Lista de transações
│   └── CategoriesScreen.js    # Categorias
├── database/
│   └── database.js            # Funções do AsyncStorage
├── utils/
│   └── formatCurrency.js      # Formatação de moeda
├── App.js                     # Navegação principal
└── package.json               # Dependências
```