import { useWindowDimensions } from 'react-native';

// Larguras de referência (dp). Tablets pequenos ficam a partir de 600,
// tablets grandes / landscape a partir de 900.
export const BREAKPOINTS = {
  phone: 0,
  tablet: 600,
  tabletLarge: 900,
};

/**
 * Informações de layout reativas a tamanho e rotação da tela.
 * Usado pelos createStyles(theme, r) de cada tela.
 */
export const useResponsive = () => {
  const { width, height } = useWindowDimensions();

  const isLandscape = width > height;
  const isTablet = width >= BREAKPOINTS.tablet;
  const isTabletLarge = width >= BREAKPOINTS.tabletLarge;

  // Fator de escala para fontes e alvos de toque.
  const scale = isTabletLarge ? 1.2 : isTablet ? 1.1 : 1;

  // Colunas para cards compactos (resumos, estatísticas).
  const columns = isTabletLarge ? 3 : isTablet ? 2 : 1;

  // Listas de lançamentos têm linhas largas, então param em 2 colunas.
  const listColumns = isTablet ? 2 : 1;

  // Colunas para grades de categoria (botões pequenos).
  const categoryColumns = isTabletLarge ? 4 : isTablet ? 3 : 2;

  // Em telas largas o conteúdo fica centralizado num limite legível
  // em vez de esticar de ponta a ponta.
  const contentMaxWidth = isTabletLarge ? 1040 : isTablet ? 780 : width;

  const gutter = isTabletLarge ? 28 : isTablet ? 22 : 16;

  const font = (size) => Math.round(size * scale);
  const space = (value) => Math.round(value * (isTablet ? 1.15 : 1));

  return {
    width,
    height,
    isLandscape,
    isTablet,
    isTabletLarge,
    scale,
    columns,
    listColumns,
    categoryColumns,
    contentMaxWidth,
    gutter,
    font,
    space,
  };
};

// Larguras para grades com flexWrap + justifyContent 'space-between'.
// Porcentagem fixa é mais previsível no RN do que combinar `gap` com flexBasis.
const GRID_WIDTHS = { 1: '100%', 2: '49%', 3: '32.4%', 4: '24%' };

export const gridItemWidth = (columns) => GRID_WIDTHS[columns] || '100%';

/**
 * Container de grade: só vira grade quando há mais de uma coluna.
 */
export const gridContainer = (columns) => (
  columns > 1
    ? { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }
    : {}
);
