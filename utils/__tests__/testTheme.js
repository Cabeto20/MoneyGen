/**
 * Tema e escala responsiva falsos para os testes de componente.
 *
 * Os temas reais são privados do ThemeContext, então o que importa aqui é ter
 * as 22 chaves com valores distintos: assim um teste consegue afirmar "usou
 * theme.success" sem depender do hex real, que pode mudar.
 */
export const testTheme = {
  background: '#0f0f14',
  surface: '#1a1a24',
  card: '#1e1e2d',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  primary: '#8b5cf6',
  primaryLight: '#2d2250',
  primaryDark: '#6d28d9',
  success: '#10b981',
  successLight: '#064e3b',
  error: '#ef4444',
  errorLight: '#7f1d1d',
  warning: '#f59e0b',
  warningLight: '#78350f',
  border: '#2d2d3d',
  tabBar: '#1a1a24',
  tabBarBorder: '#2d2d3d',
  inputBg: '#1a1a24',
  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.5)',
  gradient1: '#8b5cf6',
  gradient2: '#6d28d9',
};

export const testResponsive = {
  width: 400,
  height: 800,
  isLandscape: false,
  isTablet: false,
  isTabletLarge: false,
  scale: 1,
  columns: 1,
  listColumns: 1,
  categoryColumns: 2,
  contentMaxWidth: 400,
  gutter: 16,
  font: (size) => size,
  space: (value) => value,
};
