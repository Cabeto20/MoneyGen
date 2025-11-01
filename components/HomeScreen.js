import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { formatCurrency } from '../utils/formatCurrency';
import { getBalance, getBills, markBillAsPaid, clearAllData } from '../database/database';

const HomeScreen = () => {
  const [balance, setBalance] = useState({ income: 0, expense: 0, balance: 0 });
  const [bills, setBills] = useState([]);

  const loadData = async () => {
    const bal = await getBalance();
    const billsData = await getBills();
    setBalance(bal);
    setBills(billsData);
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const getDaysUntilDue = (dueDay) => {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    let dueDate = new Date(currentYear, currentMonth, dueDay);
    
    if (dueDay < currentDay) {
      dueDate = new Date(currentYear, currentMonth + 1, dueDay);
    }
    
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getBillStatus = (dueDay, isPaid) => {
    if (isPaid) return { text: 'Pago', color: '#10b981' };
    
    const days = getDaysUntilDue(dueDay);
    if (days === 0) return { text: 'Vence hoje', color: '#ef4444' };
    if (days <= 3) return { text: `${days} dias`, color: '#f59e0b' };
    return { text: `${days} dias`, color: '#6b7280' };
  };

  const markAsPaid = async (billId) => {
    await markBillAsPaid(billId);
    await loadData();
  };

  const getCurrentMonthBills = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    const filtered = bills.filter(bill => {
      if (bill.isPaid) return false;
      
      const createdDate = new Date(bill.createdAt);
      const createdMonth = createdDate.getMonth();
      const createdYear = createdDate.getFullYear();
      
      // Contas fixas: aparecem a partir do mês de criação
      if (bill.billType === 'fixa') {
        return (currentYear > createdYear) || 
               (currentYear === createdYear && currentMonth >= createdMonth);
      }
      
      // Contas únicas: aparecem no mês/ano da data de vencimento
      if (bill.billType === 'unica') {
        const dueDate = new Date(bill.dueDate || bill.createdAt);
        const dueMonth = dueDate.getMonth();
        const dueYear = dueDate.getFullYear();
        return currentMonth === dueMonth && currentYear === dueYear;
      }
      
      // Contas parceladas: cada parcela no mês correspondente
      if (bill.billType === 'parcelada') {
        const installmentMonth = (createdMonth + (bill.installmentNumber - 1)) % 12;
        const installmentYear = createdYear + Math.floor((createdMonth + (bill.installmentNumber - 1)) / 12);
        return installmentMonth === currentMonth && installmentYear === currentYear;
      }
      
      return false;
    });
    
    return filtered.slice(0, 5);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Saldo Total</Text>
        <Text style={styles.balanceAmount}>{formatCurrency(balance.balance)}</Text>
        
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Receitas</Text>
            <Text style={[styles.summaryAmount, styles.income]}>+{formatCurrency(balance.income)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Despesas</Text>
            <Text style={[styles.summaryAmount, styles.expense]}>-{formatCurrency(balance.expense)}</Text>
          </View>
        </View>
      </View>
      


      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contas do Mês</Text>
        {getCurrentMonthBills().length > 0 ? (
          getCurrentMonthBills().map((bill) => {
            const status = getBillStatus(bill.dueDay, bill.isPaid);
            return (
              <View key={bill.id} style={styles.billItem}>
                <View style={styles.billInfo}>
                  <Text style={styles.billDescription}>{bill.description}</Text>
                  <Text style={styles.billAmount}>{formatCurrency(bill.amount)}</Text>
                  <Text style={[styles.billStatus, { color: status.color }]}>
                    {status.text}
                  </Text>
                </View>
                <View style={styles.billActions}>
                  <Text style={styles.billDay}>Dia {bill.dueDay}</Text>
                  <TouchableOpacity 
                    style={styles.payButton}
                    onPress={() => markAsPaid(bill.id)}
                  >
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>Nenhuma conta próxima ao vencimento</Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
  },
  balanceCard: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#8b5cf6',
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#8b5cf6',
    textAlign: 'center',
    marginVertical: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#ccc',
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 5,
  },
  income: {
    color: '#10b981',
  },
  expense: {
    color: '#ef4444',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  billItem: {
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  billInfo: {
    flex: 1,
  },
  billDescription: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  billAmount: {
    fontSize: 14,
    color: '#8b5cf6',
    marginTop: 2,
  },
  billStatus: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  billActions: {
    alignItems: 'center',
  },
  billDay: {
    fontSize: 12,
    color: '#ccc',
    marginBottom: 8,
  },
  payButton: {
    backgroundColor: '#10b981',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },


});

export default HomeScreen;