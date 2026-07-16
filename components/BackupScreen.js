import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { exportBackup, importBackup, exportToCSV } from '../database/database';
import { useTheme } from '../contexts/ThemeContext';

const BackupScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  const styles = createStyles(theme);

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
      
      const transactionsFileName = `transacoes_${dateStr}.csv`;
      const transactionsUri = FileSystem.documentDirectory + transactionsFileName;
      await FileSystem.writeAsStringAsync(transactionsUri, csvTransactions);
      
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

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText]}>Processando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="cloud-outline" size={24} color={theme.primary} />
          <Text style={styles.sectionTitle}>Backup dos Dados</Text>
        </View>
        <Text style={styles.sectionDesc}>Salve e restaure seus dados financeiros</Text>
        
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.primary }]} 
          onPress={createBackup}
          activeOpacity={0.8}
        >
          <View style={styles.buttonIconContainer}>
            <Ionicons name="cloud-upload" size={22} color="#fff" />
          </View>
          <View style={styles.buttonTextContainer}>
            <Text style={styles.buttonText}>Criar Backup</Text>
            <Text style={styles.buttonSubtext}>Exportar dados como JSON</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.success }]} 
          onPress={restoreBackup}
          activeOpacity={0.8}
        >
          <View style={styles.buttonIconContainer}>
            <Ionicons name="cloud-download" size={22} color="#fff" />
          </View>
          <View style={styles.buttonTextContainer}>
            <Text style={styles.buttonText}>Restaurar Backup</Text>
            <Text style={styles.buttonSubtext}>Importar dados de arquivo JSON</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="document-text-outline" size={24} color={theme.warning} />
          <Text style={styles.sectionTitle}>Exportar Relatórios</Text>
        </View>
        <Text style={styles.sectionDesc}>Exporte seus dados para planilhas</Text>
        
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.warning }]} 
          onPress={exportExcel}
          activeOpacity={0.8}
        >
          <View style={styles.buttonIconContainer}>
            <Ionicons name="grid" size={22} color="#fff" />
          </View>
          <View style={styles.buttonTextContainer}>
            <Text style={styles.buttonText}>Exportar CSV</Text>
            <Text style={styles.buttonSubtext}>Transações e contas para Excel</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
  },
  sectionDesc: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 16,
    marginLeft: 34,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  buttonIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonTextContainer: {
    flex: 1,
    marginLeft: 14,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  loadingText: {
    color: theme.textSecondary,
    fontSize: 16,
    marginTop: 12,
  },
});

export default BackupScreen;