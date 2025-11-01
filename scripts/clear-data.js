const AsyncStorage = require('@react-native-async-storage/async-storage').default;

const TRANSACTIONS_KEY = 'transactions';
const BILLS_KEY = 'bills';

async function clearAllData() {
  try {
    console.log('🗑️  Limpando dados do FinaManagement...');
    
    await AsyncStorage.removeItem(TRANSACTIONS_KEY);
    console.log('✅ Transações removidas');
    
    await AsyncStorage.removeItem(BILLS_KEY);
    console.log('✅ Contas removidas');
    
    console.log('🎉 Todos os dados foram limpos com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao limpar dados:', error);
    process.exit(1);
  }
}

clearAllData();