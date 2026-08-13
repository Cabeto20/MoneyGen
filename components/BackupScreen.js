import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { exportBackup, importBackup, exportToCSV } from '../database/database';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Grava (sobrescrevendo) um arquivo na pasta de documentos e devolve a
 * referência. Usa a API `File`/`Paths` do expo-file-system 19 — a API legada
 * (`writeAsStringAsync`) foi removida no SDK 54 e lança em runtime.
 */
const writeFile = (fileName, content) => {
  const file = new File(Paths.document, fileName);
  file.create({ overwrite: true });
  file.write(content);
  return file;
};

const BackupScreen = () => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  const styles = createStyles(theme);

  const createBackup = async () => {
    try {
      setLoading(true);
      const backupData = await exportBackup();

      const fileName = `moneygen_backup_${new Date().toISOString().split('T')[0]}.json`;
      const file = writeFile(fileName, JSON.stringify(backupData, null, 2));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Salvar backup',
        });
      } else {
        Alert.alert('Sucesso', `Backup salvo em: ${file.uri}`);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Falha ao criar backup');
    } finally {
      setLoading(false);
    }
  };

  const restoreBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const fileContent = await new File(result.assets[0].uri).text();
      const backupData = JSON.parse(fileContent);

      Alert.alert(
        'Confirmar Restauração',
        'Isso substituirá todos os dados atuais. Continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Restaurar',
            style: 'destructive',
            onPress: async () => {
              try {
                setLoading(true);
                await importBackup(backupData);
                Alert.alert('Sucesso', 'Backup restaurado com sucesso!');
              } catch (error) {
                Alert.alert('Erro', error.message || 'Falha ao restaurar backup');
              } finally {
                setLoading(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Falha ao ler o arquivo de backup');
    }
  };

  const exportCSV = async () => {
    try {
      setLoading(true);
      const { csvTransactions, csvBills, csvGoals, csvBudgets } = await exportToCSV();
      const dateStr = new Date().toISOString().split('T')[0];

      // Só exporta o que tem linha além do cabeçalho.
      const files = [
        [`transacoes_${dateStr}.csv`, csvTransactions],
        [`contas_${dateStr}.csv`, csvBills],
        [`metas_${dateStr}.csv`, csvGoals],
        [`orcamentos_${dateStr}.csv`, csvBudgets],
      ]
        .filter(([, content]) => content.trim().split('\n').length > 1)
        .map(([fileName, content]) => writeFile(fileName, content));

      if (files.length === 0) {
        Alert.alert('Nada a exportar', 'Cadastre transações ou contas primeiro.');
        return;
      }

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sucesso', `${files.length} arquivo(s) salvos em ${Paths.document.uri}`);
        return;
      }

      // O compartilhamento é um por vez: aguarda o usuário fechar cada folha.
      for (const file of files) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Exportar CSV',
        });
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Falha ao exportar CSV');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Processando...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="cloud-outline" size={24} color={theme.primary} />
          <Text style={styles.sectionTitle}>Backup dos Dados</Text>
        </View>
        <Text style={styles.sectionDesc}>
          Inclui transações, contas, carteiras, orçamentos e metas
        </Text>

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
          onPress={exportCSV}
          activeOpacity={0.8}
        >
          <View style={styles.buttonIconContainer}>
            <Ionicons name="grid" size={22} color="#fff" />
          </View>
          <View style={styles.buttonTextContainer}>
            <Text style={styles.buttonText}>Exportar CSV</Text>
            <Text style={styles.buttonSubtext}>Um arquivo por tipo de dado</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>

      <Text style={styles.footnote}>
        Os dados ficam apenas neste aparelho. Faça backups com frequência — se desinstalar o app
        ou trocar de celular sem backup, tudo é perdido.
      </Text>
    </ScrollView>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    padding: 20,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
  footnote: {
    color: theme.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  loadingText: {
    color: theme.textSecondary,
    fontSize: 16,
    marginTop: 12,
  },
});

export default BackupScreen;
