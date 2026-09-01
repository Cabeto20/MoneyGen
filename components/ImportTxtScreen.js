import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDateBR } from '../utils/dateHelpers';
import { parseStatementText, markDuplicates, EXAMPLE_TXT } from '../utils/txtImport';
import {
  addTransactionsBulk,
  addBillsBulk,
  getTransactions,
  getBills,
  getAccounts,
  DEFAULT_ACCOUNT_ID,
} from '../database/database';
import AccountPicker from './AccountPicker';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive } from '../utils/responsive';

const CHUNK_SIZE = 4096;

const fromCharCodes = (codes) => {
  let text = '';
  for (let index = 0; index < codes.length; index += CHUNK_SIZE) {
    text += String.fromCharCode.apply(null, codes.slice(index, index + CHUNK_SIZE));
  }
  return text;
};

/**
 * Decodifica UTF-8 recusando sequência inválida (devolve null). É esse "não"
 * que identifica o arquivo ANSI/Latin-1 que os bancos ainda exportam — ler um
 * extrato desses como UTF-8 quebra todo acento na descrição.
 */
const decodeUtf8 = (bytes) => {
  const codes = [];
  let index = 0;

  while (index < bytes.length) {
    const byte = bytes[index];
    let codePoint;
    let size;

    if (byte < 0x80) {
      codePoint = byte;
      size = 1;
    } else if (byte >= 0xc2 && byte <= 0xdf) {
      codePoint = byte & 0x1f;
      size = 2;
    } else if (byte >= 0xe0 && byte <= 0xef) {
      codePoint = byte & 0x0f;
      size = 3;
    } else if (byte >= 0xf0 && byte <= 0xf4) {
      codePoint = byte & 0x07;
      size = 4;
    } else {
      return null;
    }

    if (index + size > bytes.length) return null;

    for (let offset = 1; offset < size; offset += 1) {
      const continuation = bytes[index + offset];
      if ((continuation & 0xc0) !== 0x80) return null;
      codePoint = (codePoint << 6) | (continuation & 0x3f);
    }

    // Overlong, surrogate e acima do plano Unicode: um byte acentuado de
    // arquivo que não é UTF-8 costuma cair em um destes casos.
    if (size === 3 && codePoint < 0x800) return null;
    if (size === 4 && (codePoint < 0x10000 || codePoint > 0x10ffff)) return null;
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) return null;

    if (codePoint > 0xffff) {
      const shifted = codePoint - 0x10000;
      codes.push(0xd800 + (shifted >> 10), 0xdc00 + (shifted & 0x3ff));
    } else {
      codes.push(codePoint);
    }

    index += size;
  }

  return fromCharCodes(codes);
};

const decodeLatin1 = (bytes) => fromCharCodes(Array.from(bytes));

const readTextFile = async (uri) => {
  const bytes = await new File(uri).bytes();
  return decodeUtf8(bytes) ?? decodeLatin1(bytes);
};

const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

const DESTINATIONS = [
  { key: 'transactions', label: 'Despesas', icon: 'swap-horizontal', hint: 'Já aconteceu' },
  { key: 'bills', label: 'Contas a pagar', icon: 'calendar', hint: 'Ainda vou pagar' },
];

const ImportTxtScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const r = useResponsive();
  const styles = createStyles(theme, r);

  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [existing, setExisting] = useState({ transactions: [], bills: [] });
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState(DEFAULT_ACCOUNT_ID);
  const [excluded, setExcluded] = useState({});
  const [destination, setDestination] = useState('transactions');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [showInvalid, setShowInvalid] = useState(false);

  // O que conta como duplicado depende do destino: importando para contas,
  // as contas já cadastradas também entram na comparação.
  const entries = useMemo(() => {
    if (!result) return [];
    const known = destination === 'bills'
      ? [...existing.transactions, ...existing.bills]
      : existing.transactions;
    return markDuplicates(result.entries, known);
  }, [result, existing, destination]);

  const selectedEntries = useMemo(() => entries.filter(entry => (
    !excluded[entry.line] && !(skipDuplicates && entry.isDuplicate)
  )), [entries, excluded, skipDuplicates]);

  const selectedTotals = useMemo(() => {
    const income = selectedEntries.filter(entry => entry.type === 'income');
    const expense = selectedEntries.filter(entry => entry.type === 'expense');
    return {
      incomeCount: income.length,
      expenseCount: expense.length,
      incomeTotal: income.reduce((sum, entry) => sum + entry.amount, 0),
      expenseTotal: expense.reduce((sum, entry) => sum + entry.amount, 0),
    };
  }, [selectedEntries]);

  const resetSelection = () => {
    setResult(null);
    setExisting({ transactions: [], bills: [] });
    setFileName('');
    setExcluded({});
    setShowInvalid(false);
  };

  const pickFile = async () => {
    try {
      // Android costuma entregar .txt como octet-stream, então aceitamos tudo
      // e validamos o conteúdo depois.
      const picked = await DocumentPicker.getDocumentAsync({
        type: [
          'text/plain',
          'text/csv',
          'text/comma-separated-values',
          'application/octet-stream',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (picked.canceled) return;

      setLoading(true);
      const asset = picked.assets[0];
      const content = await readTextFile(asset.uri);
      const parsed = parseStatementText(content);

      if (parsed.entries.length === 0) {
        Alert.alert(
          'Nada para importar',
          parsed.summary.invalidCount > 0
            ? 'Nenhuma linha pôde ser lida. Verifique se cada linha tem nome, data e valor.\n\nExemplo:\n' + EXAMPLE_TXT.split('\n')[0]
            : 'O arquivo está vazio ou não tem lançamentos.'
        );
        return;
      }

      const [transactions, bills, storedAccounts] = await Promise.all([
        getTransactions(),
        getBills(),
        getAccounts(),
      ]);

      setExisting({
        transactions,
        // Contas guardam o vencimento em ISO; normaliza para a mesma chave.
        bills: bills.map(bill => ({
          description: bill.description,
          amount: bill.amount,
          date: formatDateBR(new Date(bill.dueDate || bill.createdAt)),
        })),
      });

      const active = storedAccounts.filter(account => !account.archived);
      setAccounts(active);
      setAccountId(
        active.some(account => account.id === accountId)
          ? accountId
          : active[0]?.id || DEFAULT_ACCOUNT_ID
      );

      setFileName(asset.name || 'arquivo.txt');
      setResult(parsed);
      setExcluded({});
      setShowInvalid(false);
    } catch (error) {
      console.error('Erro ao ler arquivo:', error);
      Alert.alert('Erro', 'Não foi possível ler o arquivo selecionado.');
    } finally {
      setLoading(false);
    }
  };

  const toggleEntry = (line) => {
    setExcluded(current => ({ ...current, [line]: !current[line] }));
  };

  const toTransaction = (entry) => ({
    description: entry.description,
    amount: entry.amount,
    type: entry.type,
    category: entry.category,
    date: entry.date,
  });

  const toBill = (entry) => ({
    description: entry.description,
    amount: entry.amount,
    category: entry.billCategory,
    dueDate: entry.date,
  });

  const runImport = async () => {
    setLoading(true);
    try {
      const incomes = selectedEntries.filter(entry => entry.type === 'income');
      const expenses = selectedEntries.filter(entry => entry.type === 'expense');

      if (destination === 'bills') {
        if (incomes.length > 0) await addTransactionsBulk(incomes.map(toTransaction), accountId);
        if (expenses.length > 0) await addBillsBulk(expenses.map(toBill), accountId);
      } else {
        await addTransactionsBulk(selectedEntries.map(toTransaction), accountId);
      }

      const destinationText = destination === 'bills'
        ? expenses.length + ' conta(s) a pagar e ' + incomes.length + ' receita(s)'
        : incomes.length + ' receita(s) e ' + expenses.length + ' despesa(s)';

      resetSelection();
      Alert.alert('Importação concluída', 'Foram importados ' + destinationText + '.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Erro ao importar:', error);
      Alert.alert('Erro', 'Falha ao gravar os lançamentos importados.');
    } finally {
      setLoading(false);
    }
  };

  const confirmImport = () => {
    if (selectedEntries.length === 0) {
      Alert.alert('Nada selecionado', 'Marque pelo menos um lançamento para importar.');
      return;
    }

    const destinationText = destination === 'bills'
      ? 'as saídas viram contas a pagar e as entradas viram receitas'
      : 'as saídas viram despesas e as entradas viram receitas';

    Alert.alert(
      'Confirmar importação',
      selectedEntries.length + ' lançamento(s) serão adicionados — ' + destinationText + '.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Importar', onPress: runImport },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Processando arquivo...</Text>
      </View>
    );
  }

  if (!result) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.introCard}>
            <View style={styles.introHeader}>
              <View style={[styles.introIcon, { backgroundColor: theme.primaryLight }]}>
                <Ionicons name="document-text" size={r.font(24)} color={theme.primary} />
              </View>
              <View style={styles.introHeaderText}>
                <Text style={styles.introTitle}>Importar extrato TXT</Text>
                <Text style={styles.introSubtitle}>Uma linha por lançamento</Text>
              </View>
            </View>

            <Text style={styles.introBody}>
              Cada linha precisa de <Text style={styles.strong}>nome</Text>,{' '}
              <Text style={styles.strong}>data</Text> e <Text style={styles.strong}>valor</Text>.
              O sinal do valor decide o tipo:
            </Text>

            <View style={styles.ruleRow}>
              <View style={[styles.ruleDot, { backgroundColor: theme.error }]} />
              <Text style={styles.ruleText}>
                Valor negativo é <Text style={styles.strong}>saída</Text> (despesa ou conta)
              </Text>
            </View>
            <View style={styles.ruleRow}>
              <View style={[styles.ruleDot, { backgroundColor: theme.success }]} />
              <Text style={styles.ruleText}>
                Valor positivo é <Text style={styles.strong}>entrada</Text> (receita/depósito)
              </Text>
            </View>

            <Text style={styles.exampleLabel}>Exemplo</Text>
            <View style={styles.exampleBox}>
              <Text style={styles.exampleText}>{EXAMPLE_TXT}</Text>
            </View>

            <Text style={styles.hint}>
              Também aceita TAB, ponto e vírgula, barra vertical ou espaços como separador,
              e datas em dd/mm/aaaa ou aaaa-mm-dd.
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={pickFile} activeOpacity={0.85}>
            <Ionicons name="folder-open" size={r.font(22)} color="#fff" />
            <Text style={styles.primaryButtonText}>Selecionar arquivo TXT</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderHeader = () => (
    <View>
      <View style={styles.fileRow}>
        <Ionicons name="document-attach" size={r.font(20)} color={theme.primary} />
        <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
        <TouchableOpacity onPress={resetSelection} hitSlop={HIT_SLOP}>
          <Ionicons name="close-circle" size={r.font(22)} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderLeftColor: theme.success }]}>
          <Text style={styles.summaryLabel}>Entradas</Text>
          <Text style={[styles.summaryValue, { color: theme.success }]}>
            +{formatCurrency(selectedTotals.incomeTotal)}
          </Text>
          <Text style={styles.summaryCount}>{selectedTotals.incomeCount} lançamentos</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: theme.error }]}>
          <Text style={styles.summaryLabel}>Saídas</Text>
          <Text style={[styles.summaryValue, { color: theme.error }]}>
            -{formatCurrency(selectedTotals.expenseTotal)}
          </Text>
          <Text style={styles.summaryCount}>{selectedTotals.expenseCount} lançamentos</Text>
        </View>
      </View>

      {accounts.length > 1 && (
        <>
          <Text style={styles.optionLabel}>Carteira de destino</Text>
          <AccountPicker
            accounts={accounts}
            selected={accountId}
            onSelect={setAccountId}
            theme={theme}
            accentColor={theme.primary}
          />
        </>
      )}

      <Text style={styles.optionLabel}>As saídas devem virar</Text>
      <View style={styles.destinationRow}>
        {DESTINATIONS.map(option => {
          const active = destination === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.destinationButton, active && styles.destinationButtonActive]}
              onPress={() => setDestination(option.key)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={option.icon}
                size={r.font(20)}
                color={active ? '#fff' : theme.textSecondary}
              />
              <Text style={[styles.destinationText, active && styles.destinationTextActive]}>
                {option.label}
              </Text>
              <Text style={[styles.destinationHint, active && styles.destinationHintActive]}>
                {option.hint}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.switchRow}>
        <View style={styles.switchTextGroup}>
          <Text style={styles.switchTitle}>Ignorar duplicados</Text>
          <Text style={styles.switchSubtitle}>
            Lançamentos com mesmo nome, valor e data que já existem
          </Text>
        </View>
        <Switch
          value={skipDuplicates}
          onValueChange={setSkipDuplicates}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor="#fff"
        />
      </View>

      {result.summary.invalidCount > 0 && (
        <TouchableOpacity
          style={styles.invalidToggle}
          onPress={() => setShowInvalid(current => !current)}
          activeOpacity={0.8}
        >
          <Ionicons name="warning" size={r.font(18)} color={theme.warning} />
          <Text style={styles.invalidToggleText}>
            {result.summary.invalidCount} linha(s) não reconhecida(s)
          </Text>
          <Ionicons
            name={showInvalid ? 'chevron-up' : 'chevron-down'}
            size={r.font(18)}
            color={theme.warning}
          />
        </TouchableOpacity>
      )}

      {showInvalid && result.invalid.map(item => (
        <View key={'invalid-' + item.line} style={styles.invalidItem}>
          <Text style={styles.invalidLine}>Linha {item.line} — {item.reason}</Text>
          <Text style={styles.invalidRaw} numberOfLines={2}>{item.raw}</Text>
        </View>
      ))}

      <Text style={styles.listTitle}>
        Lançamentos ({selectedEntries.length} de {entries.length} selecionados)
      </Text>
    </View>
  );

  const renderEntry = ({ item }) => {
    const isOff = excluded[item.line] || (skipDuplicates && item.isDuplicate);
    const category = destination === 'bills' && item.type === 'expense'
      ? item.billCategory
      : item.category;

    return (
      <TouchableOpacity
        style={[styles.entryItem, isOff && styles.entryItemOff]}
        onPress={() => toggleEntry(item.line)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.checkbox,
          isOff
            ? styles.checkboxOff
            : { backgroundColor: theme.primary, borderColor: theme.primary },
        ]}>
          {!isOff && <Ionicons name="checkmark" size={r.font(14)} color="#fff" />}
        </View>

        <View style={styles.entryInfo}>
          <Text style={styles.entryDescription} numberOfLines={1}>{item.description}</Text>
          <View style={styles.entryMeta}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{category}</Text>
            </View>
            <Text style={styles.entryDate}>{item.dateText}</Text>
            {item.isDuplicate && (
              <View style={styles.duplicateBadge}>
                <Text style={styles.duplicateText}>duplicado</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={[
          styles.entryAmount,
          { color: item.type === 'income' ? theme.success : theme.error },
        ]}>
          {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        renderItem={renderEntry}
        keyExtractor={item => String(item.line)}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={20}
        windowSize={10}
      />

      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[
            styles.confirmButton,
            selectedEntries.length === 0 && styles.confirmButtonDisabled,
          ]}
          onPress={confirmImport}
          activeOpacity={0.85}
        >
          <Ionicons name="cloud-download" size={r.font(20)} color="#fff" />
          <Text style={styles.confirmButtonText}>
            Importar {selectedEntries.length} lançamento(s)
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme, r) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: r.space(20),
  },
  loadingText: {
    color: theme.textSecondary,
    fontSize: r.font(16),
    marginTop: r.space(12),
  },
  introCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: r.space(18),
    borderWidth: 1,
    borderColor: theme.border,
  },
  introHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.space(14),
    marginBottom: r.space(16),
  },
  introIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  introHeaderText: {
    flex: 1,
  },
  introTitle: {
    color: theme.text,
    fontSize: r.font(18),
    fontWeight: 'bold',
  },
  introSubtitle: {
    color: theme.textSecondary,
    fontSize: r.font(13),
    marginTop: r.space(2),
  },
  introBody: {
    color: theme.textSecondary,
    fontSize: r.font(14),
    lineHeight: r.font(21),
    marginBottom: r.space(12),
  },
  strong: {
    color: theme.text,
    fontWeight: 'bold',
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.space(10),
    marginBottom: r.space(8),
  },
  ruleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ruleText: {
    flex: 1,
    color: theme.textSecondary,
    fontSize: r.font(14),
  },
  exampleLabel: {
    color: theme.text,
    fontSize: r.font(13),
    fontWeight: 'bold',
    marginTop: r.space(14),
    marginBottom: r.space(8),
  },
  exampleBox: {
    backgroundColor: theme.inputBg,
    borderRadius: 12,
    padding: r.space(12),
    borderWidth: 1,
    borderColor: theme.border,
  },
  exampleText: {
    color: theme.textSecondary,
    fontSize: r.font(12),
    lineHeight: r.font(20),
    fontFamily: 'monospace',
  },
  hint: {
    color: theme.textSecondary,
    fontSize: r.font(12),
    lineHeight: r.font(18),
    marginTop: r.space(14),
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: r.space(10),
    backgroundColor: theme.primary,
    borderRadius: 14,
    paddingVertical: r.space(16),
    marginTop: r.space(20),
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: r.font(16),
    fontWeight: 'bold',
  },
  listContent: {
    padding: r.space(16),
    paddingBottom: r.space(100),
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.space(10),
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingHorizontal: r.space(14),
    paddingVertical: r.space(12),
    borderWidth: 1,
    borderColor: theme.border,
  },
  fileName: {
    flex: 1,
    color: theme.text,
    fontSize: r.font(14),
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: r.space(12),
    marginTop: r.space(14),
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: r.space(14),
    borderLeftWidth: 4,
  },
  summaryLabel: {
    color: theme.textSecondary,
    fontSize: r.font(12),
  },
  summaryValue: {
    fontSize: r.font(17),
    fontWeight: 'bold',
    marginTop: r.space(4),
  },
  summaryCount: {
    color: theme.textSecondary,
    fontSize: r.font(11),
    marginTop: r.space(2),
  },
  optionLabel: {
    color: theme.text,
    fontSize: r.font(14),
    fontWeight: 'bold',
    marginTop: r.space(20),
    marginBottom: r.space(10),
  },
  destinationRow: {
    flexDirection: 'row',
    gap: r.space(12),
  },
  destinationButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingVertical: r.space(14),
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  destinationButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  destinationText: {
    color: theme.text,
    fontSize: r.font(14),
    fontWeight: '600',
    marginTop: r.space(6),
  },
  destinationTextActive: {
    color: '#fff',
  },
  destinationHint: {
    color: theme.textSecondary,
    fontSize: r.font(11),
    marginTop: r.space(2),
  },
  destinationHintActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.space(14),
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: r.space(14),
    marginTop: r.space(16),
  },
  switchTextGroup: {
    flex: 1,
  },
  switchTitle: {
    color: theme.text,
    fontSize: r.font(14),
    fontWeight: '600',
  },
  switchSubtitle: {
    color: theme.textSecondary,
    fontSize: r.font(12),
    marginTop: r.space(2),
  },
  invalidToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.space(10),
    backgroundColor: theme.warningLight,
    borderRadius: 12,
    paddingHorizontal: r.space(14),
    paddingVertical: r.space(12),
    marginTop: r.space(16),
  },
  invalidToggleText: {
    flex: 1,
    color: theme.warning,
    fontSize: r.font(13),
    fontWeight: '600',
  },
  invalidItem: {
    backgroundColor: theme.card,
    borderRadius: 10,
    padding: r.space(12),
    marginTop: r.space(8),
  },
  invalidLine: {
    color: theme.warning,
    fontSize: r.font(12),
    fontWeight: '600',
  },
  invalidRaw: {
    color: theme.textSecondary,
    fontSize: r.font(12),
    marginTop: r.space(4),
    fontFamily: 'monospace',
  },
  listTitle: {
    color: theme.text,
    fontSize: r.font(15),
    fontWeight: 'bold',
    marginTop: r.space(22),
    marginBottom: r.space(10),
  },
  entryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.space(12),
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: r.space(14),
    marginBottom: r.space(10),
  },
  entryItemOff: {
    opacity: 0.45,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxOff: {
    borderColor: theme.border,
    backgroundColor: 'transparent',
  },
  entryInfo: {
    flex: 1,
  },
  entryDescription: {
    color: theme.text,
    fontSize: r.font(14),
    fontWeight: '600',
  },
  entryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.space(8),
    marginTop: r.space(6),
  },
  categoryBadge: {
    backgroundColor: theme.inputBg,
    borderRadius: 8,
    paddingHorizontal: r.space(8),
    paddingVertical: r.space(3),
  },
  categoryText: {
    color: theme.textSecondary,
    fontSize: r.font(11),
    fontWeight: '600',
  },
  entryDate: {
    color: theme.textSecondary,
    fontSize: r.font(11),
  },
  duplicateBadge: {
    backgroundColor: theme.warningLight,
    borderRadius: 8,
    paddingHorizontal: r.space(8),
    paddingVertical: r.space(3),
  },
  duplicateText: {
    color: theme.warning,
    fontSize: r.font(10),
    fontWeight: 'bold',
  },
  entryAmount: {
    fontSize: r.font(14),
    fontWeight: 'bold',
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: r.space(16),
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: r.space(10),
    backgroundColor: theme.primary,
    borderRadius: 14,
    paddingVertical: r.space(15),
  },
  confirmButtonDisabled: {
    backgroundColor: theme.border,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: r.font(15),
    fontWeight: 'bold',
  },
});

export default ImportTxtScreen;
