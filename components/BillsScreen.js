import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { formatCurrency } from '../utils/formatCurrency';
import { getBills, addBill, markBillAsPaid } from '../database/database';

const BillsScreen = ({ navigation }) => {
  const [bills, setBills] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());


  const loadBills = async () => {
    const billsData = await getBills();
    setBills(billsData);
  };

  useFocusEffect(
    React.useCallback(() => {
      loadBills();
    }, [])
  );



  const markAsPaid = async (billId) => {
    await markBillAsPaid(billId);
    await loadBills();
  };

  const getDaysUntilDue = (dueDay) => {
    const today = new Date();
    const dueDate = new Date(selectedYear, selectedMonth, dueDay);
    
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getBillStatus = (dueDay, isPaid) => {
    if (isPaid) return { text: 'Pago', color: '#10b981' };
    
    const days = getDaysUntilDue(dueDay);
    const today = new Date();
    const isCurrentMonth = selectedMonth === today.getMonth() && selectedYear === today.getFullYear();
    
    if (!isCurrentMonth) {
      return { text: `Dia ${dueDay}`, color: '#6b7280' };
    }
    
    if (days === 0) return { text: 'Vence hoje', color: '#ef4444' };
    if (days < 0) return { text: 'Vencida', color: '#ef4444' };
    if (days <= 3) return { text: `${days} dias`, color: '#f59e0b' };
    return { text: `${days} dias`, color: '#6b7280' };
  };

  const getFilteredBills = () => {
    return bills.filter(bill => {
      const createdDate = new Date(bill.createdAt);
      const createdMonth = createdDate.getMonth();
      const createdYear = createdDate.getFullYear();
      
      // Contas fixas: aparecem em todos os meses a partir do mês de criação
      if (bill.billType === 'fixa') {
        return (selectedYear > createdYear) || 
               (selectedYear === createdYear && selectedMonth >= createdMonth);
      }
      
      // Contas únicas: aparecem no mês/ano da data de vencimento
      if (bill.billType === 'unica') {
        const dueDate = new Date(bill.dueDate || bill.createdAt);
        const dueMonth = dueDate.getMonth();
        const dueYear = dueDate.getFullYear();
        return selectedMonth === dueMonth && selectedYear === dueYear;
      }
      
      // Contas parceladas: cada parcela no mês correspondente
      if (bill.billType === 'parcelada') {
        const installmentMonth = (createdMonth + (bill.installmentNumber - 1)) % 12;
        const installmentYear = createdYear + Math.floor((createdMonth + (bill.installmentNumber - 1)) / 12);
        return installmentMonth === selectedMonth && installmentYear === selectedYear;
      }
      
      return false;
    });
  };

  const changeMonth = (direction) => {
    if (direction === 'prev') {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear(selectedYear - 1);
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    } else {
      if (selectedMonth === 11) {
        setSelectedMonth(0);
        setSelectedYear(selectedYear + 1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    }
  };

  const getMonthYearText = () => {
    const date = new Date(selectedYear, selectedMonth);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.addButton, styles.billButton]} 
          onPress={() => navigation.navigate('AddBill')}
        >
          <Ionicons name="calendar" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Nova Conta</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.addButton, styles.transactionButton]} 
          onPress={() => navigation.navigate('AddTransaction')}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Transação</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.monthNavigator}>
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => changeMonth('prev')}
        >
          <Ionicons name="chevron-back" size={20} color="#8b5cf6" />
        </TouchableOpacity>
        
        <View style={styles.monthDisplay}>
          <Text style={styles.monthYearText}>{getMonthYearText()}</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => changeMonth('next')}
        >
          <Ionicons name="chevron-forward" size={20} color="#8b5cf6" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.billsList}>
        {getFilteredBills().map((bill) => {
          const status = getBillStatus(bill.dueDay, bill.isPaid);
          return (
            <View key={bill.id} style={styles.billItem}>
              <View style={styles.billInfo}>
                <Text style={styles.billDescription}>{bill.description}</Text>
                <Text style={styles.billCategory}>{bill.category}</Text>
                <Text style={styles.billAmount}>{formatCurrency(bill.amount)}</Text>
                <Text style={[styles.billStatus, { color: status.color }]}>
                  {status.text}
                </Text>
              </View>
              <View style={styles.billActions}>
                <Text style={styles.billDay}>Dia {bill.dueDay}</Text>
                {!bill.isPaid && (
                  <TouchableOpacity 
                    style={styles.payButton}
                    onPress={() => markAsPaid(bill.id)}
                  >
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: 5,
  },
  billButton: {
    backgroundColor: '#8b5cf6',
  },
  transactionButton: {
    backgroundColor: '#10b981',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  addForm: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#333',
    color: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#10b981',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  billsList: {
    flex: 1,
  },
  billItem: {
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 15,
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
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryContainer: {
    marginBottom: 15,
  },
  categoryLabel: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
  },
  categoryScroll: {
    flexDirection: 'row',
  },
  categoryButton: {
    backgroundColor: '#333',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  selectedCategory: {
    backgroundColor: '#8b5cf6',
  },
  categoryText: {
    color: '#ccc',
    fontSize: 14,
  },
  selectedCategoryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  billCategory: {
    fontSize: 12,
    color: '#8b5cf6',
    marginTop: 2,
  },
  monthSection: {
    marginBottom: 25,
  },
  monthNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  navButton: {
    padding: 5,
  },
  monthDisplay: {
    flex: 1,
    alignItems: 'center',
  },
  monthYearText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
});

export default BillsScreen;