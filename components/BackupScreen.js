import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { exportBackup, importBackup, exportToCSV } from '../database/database';

const BackupScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);

  const createBackup = async () => {
    try {
      setLoading(true);
      const backupData = await exportBackup();
      
      const fileName = `backup_finamanagement_${new Date().toISOString().split('T')[0]}.json`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backupData, null, 2));
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Sucesso', `Backup salvo em: ${fileUri}`);
      }
    } catch (error) {
      Alert.alert('Erro', 'Falha ao criar backup');
    } finally {
      setLoading(false);
    }
  };

  const restoreBackup = async () => {
    try {
      setLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });

      if (!result.canceled) {
        const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri);
        const backupData = JSON.parse(fileContent);
        
        Alert.alert(
          'Confirmar Restauração',
          'Isso substituirá todos os dados atuais. Continuar?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { 
              text: 'Restaurar', 
              onPress: async () => {
                await importBackup(backupData);
                Alert.alert('Sucesso', 'Backup restaurado com sucesso!');
                navigation.goBack();
              }
            }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Erro', 'Falha ao restaurar backup');
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = async () => {
    try {
      setLoading(true);
      const { csvTransactions, csvBills } = await exportToCSV();
      
      const dateStr = new Date().toISOString().split('T')[0];
      
      // Exportar transações
      const transactionsFileName = `transacoes_${dateStr}.csv`;
      const transactionsUri = FileSystem.documentDirectory + transactionsFileName;
      await FileSystem.writeAsStringAsync(transactionsUri, csvTransactions);
      
      // Exportar contas
      const billsFileName = `contas_${dateStr}.csv`;
      const billsUri = FileSystem.documentDirectory + billsFileName;
      await FileSystem.writeAsStringAsync(billsUri, csvBills);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(transactionsUri);
        setTimeout(async () => {
          await Sharing.shareAsync(billsUri);
        }, 1000);
      }
      
      Alert.alert('Sucesso', 'Arquivos CSV exportados!');
    } catch (error) {
      Alert.alert('Erro', 'Falha ao exportar CSV');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Backup dos Dados</Text>
        
        <TouchableOpacity 
          style={[styles.button, styles.backupButton]} 
          onPress={createBackup}
          disabled={loading}
        >
          <Ionicons name="cloud-upload" size={24} color="#fff" />
          <Text style={styles.buttonText}>Criar Backup</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.restoreButton]} 
          onPress={restoreBackup}
          disabled={loading}
        >
          <Ionicons name="cloud-download" size={24} color="#fff" />
          <Text style={styles.buttonText}>Restaurar Backup</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Exportar para Excel</Text>
        
        <TouchableOpacity 
          style={[styles.button, styles.excelButton]} 
          onPress={exportExcel}
          disabled={loading}
        >
          <Ionicons name="document" size={24} color="#fff" />
          <Text style={styles.buttonText}>Exportar CSV</Text>
        </TouchableOpacity>
        
        <Text style={styles.helpText}>
          Exporta transações e contas em formato CSV para abrir no Excel
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 10,
    marginBottom: 15,
  },
  backupButton: {
    backgroundColor: '#8b5cf6',
  },
  restoreButton: {
    backgroundColor: '#10b981',
  },
  excelButton: {
    backgroundColor: '#f59e0b',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  helpText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 10,
  },
});

export default BackupScreen;