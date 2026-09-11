import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive } from '../utils/responsive';


// O fundo escurece a tela, não a esconde: em opacidade 1 o '#000' do backdrop
// apagava por completo o conteúdo atrás do menu. Mesmo peso do `theme.overlay`
// usado pelos outros modais do app.
const BACKDROP_OPACITY = 0.5;

export const MENU_ITEMS = [
  { route: 'Home', label: 'Início', icon: 'home-outline' },
  { route: 'Chat', label: 'DominusIA', icon: 'chatbubble-ellipses-outline' },
  { route: 'Transactions', label: 'Transações', icon: 'swap-horizontal-outline' },
  { route: 'Bills', label: 'Contas', icon: 'calendar-outline' },
  { route: 'Stats', label: 'Relatórios', icon: 'stats-chart-outline' },
  { route: 'Planning', label: 'Planejamento', icon: 'layers-outline' },
  { route: 'Settings', label: 'Ajustes', icon: 'settings-outline' },
];

const SideMenu = ({ visible, onClose, onNavigate }) => {
  const { theme } = useTheme();
  const r = useResponsive();
  const menuWidth = Math.min(r.isTablet ? 360 : 300, r.width * 0.8);
  const translateX = useRef(new Animated.Value(-menuWidth)).current;
  const styles = createStyles(r);
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: visible ? 0 : -menuWidth,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: visible ? BACKDROP_OPACITY : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, menuWidth, translateX, backdropOpacity]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Animated.View
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            width: menuWidth,
            backgroundColor: theme.surface,
            transform: [{ translateX }],
          },
        ]}
      >
        <Text style={[styles.appName, { color: theme.text }]}>MoneyGen</Text>
        {MENU_ITEMS.map(item => (
          <TouchableOpacity
            key={item.route}
            style={styles.item}
            onPress={() => onNavigate(item.route)}
            activeOpacity={0.7}
          >
            <Ionicons name={item.icon} size={r.font(22)} color={theme.primary} />
            <Text style={[styles.itemLabel, { color: theme.text }]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </View>
  );
};

const createStyles = (r) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    paddingTop: r.space(56),
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  appName: {
    fontSize: r.font(20),
    fontWeight: 'bold',
    marginHorizontal: r.gutter,
    marginBottom: r.space(20),
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: r.space(16),
    paddingHorizontal: r.gutter,
    paddingVertical: r.space(14),
  },
  itemLabel: {
    fontSize: r.font(15),
    fontWeight: '600',
  },
});

export default SideMenu;
