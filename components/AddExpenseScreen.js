import React from 'react';
import TransactionForm from './TransactionForm';

const AddExpenseScreen = (props) => <TransactionForm {...props} type="expense" />;

export default AddExpenseScreen;
