import { useState } from 'react';
import { formatCurrency } from './formatCurrency';

/**
 * Campo de valor em centavos: o usuário digita só dígitos e o texto exibido é
 * formatado como moeda. `initialValue` preenche o campo no modo de edição.
 */
export const useAmountInput = (initialValue = null) => {
  const hasInitial = typeof initialValue === 'number' && !Number.isNaN(initialValue);

  const [amount, setAmount] = useState(hasInitial ? String(initialValue) : '');
  const [displayAmount, setDisplayAmount] = useState(
    hasInitial ? formatCurrency(initialValue) : ''
  );

  const handleAmountChange = (text) => {
    const numericValue = text.replace(/\D/g, '');

    if (numericValue === '') {
      setAmount('');
      setDisplayAmount('');
      return;
    }

    const floatValue = parseFloat(numericValue) / 100;
    setAmount(floatValue.toString());
    setDisplayAmount(formatCurrency(floatValue));
  };

  const setAmountValue = (value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      setAmount('');
      setDisplayAmount('');
      return;
    }
    setAmount(String(value));
    setDisplayAmount(formatCurrency(value));
  };

  return { amount, displayAmount, handleAmountChange, setAmountValue };
};
