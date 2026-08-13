export const EXPENSE_CATEGORIES = [
  { name: 'Alimentação', icon: 'fast-food', color: '#ef4444' },
  { name: 'Transporte', icon: 'car', color: '#3b82f6' },
  { name: 'Moradia', icon: 'home', color: '#8b5cf6' },
  { name: 'Saúde', icon: 'medkit', color: '#10b981' },
  { name: 'Educação', icon: 'school', color: '#f59e0b' },
  { name: 'Lazer', icon: 'game-controller', color: '#ec4899' },
  { name: 'Compras', icon: 'bag-handle', color: '#f97316' },
  { name: 'Serviços', icon: 'construct', color: '#6366f1' },
];

export const INCOME_CATEGORIES = [
  { name: 'Salário', icon: 'wallet', color: '#059669' },
  { name: 'Freelance', icon: 'laptop', color: '#0891b2' },
  { name: 'Investimentos', icon: 'trending-up', color: '#7c3aed' },
  { name: 'Vendas', icon: 'pricetag', color: '#f59e0b' },
  { name: 'Bonificação', icon: 'gift', color: '#ec4899' },
  { name: 'Prêmio', icon: 'trophy', color: '#eab308' },
  { name: 'Aluguel Recebido', icon: 'business', color: '#3b82f6' },
  { name: 'Outros', icon: 'ellipsis-horizontal', color: '#6b7280' },
];

export const BILL_CATEGORIES = [
  { name: 'Aluguel', icon: 'home', color: '#8b5cf6' },
  { name: 'Energia', icon: 'flash', color: '#f59e0b' },
  { name: 'Água', icon: 'water', color: '#0ea5e9' },
  { name: 'Internet', icon: 'wifi', color: '#6366f1' },
  { name: 'Telefone', icon: 'call', color: '#14b8a6' },
  { name: 'Cartão', icon: 'card', color: '#ef4444' },
  { name: 'Financiamento', icon: 'cash', color: '#10b981' },
  { name: 'Seguro', icon: 'shield-checkmark', color: '#3b82f6' },
];

/** Tipos de carteira/conta onde o dinheiro fica. */
export const ACCOUNT_TYPES = [
  { key: 'dinheiro', label: 'Dinheiro', icon: 'cash', color: '#10b981' },
  { key: 'corrente', label: 'Conta Corrente', icon: 'business', color: '#3b82f6' },
  { key: 'poupanca', label: 'Poupança', icon: 'wallet', color: '#8b5cf6' },
  { key: 'cartao', label: 'Cartão', icon: 'card', color: '#ef4444' },
  { key: 'investimento', label: 'Investimento', icon: 'trending-up', color: '#f59e0b' },
];

export const ACCOUNT_TYPE_MAP = ACCOUNT_TYPES.reduce(
  (map, type) => ({ ...map, [type.key]: type }),
  {}
);

/** Ícones oferecidos ao criar uma meta de economia. */
export const GOAL_ICONS = [
  'airplane', 'car-sport', 'home', 'school', 'phone-portrait',
  'gift', 'heart', 'laptop', 'medkit', 'shield-checkmark',
  'boat', 'bicycle',
];

export const GOAL_COLORS = [
  '#7c3aed', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#14b8a6', '#6366f1',
];

/** Paleta usada pelo gráfico quando a categoria não tem cor própria. */
export const FALLBACK_CHART_COLORS = [
  '#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#14b8a6', '#6366f1', '#f97316', '#84cc16',
];

const toIconMap = (categories) =>
  categories.reduce((map, cat) => ({ ...map, [cat.name]: cat.icon }), {});

const toColorMap = (categories) =>
  categories.reduce((map, cat) => ({ ...map, [cat.name]: cat.color }), {});

export const EXPENSE_CATEGORY_ICONS = toIconMap(EXPENSE_CATEGORIES);
export const EXPENSE_CATEGORY_COLORS = toColorMap(EXPENSE_CATEGORIES);
export const INCOME_CATEGORY_ICONS = toIconMap(INCOME_CATEGORIES);
export const INCOME_CATEGORY_COLORS = toColorMap(INCOME_CATEGORIES);
export const BILL_CATEGORY_ICONS = toIconMap(BILL_CATEGORIES);
export const BILL_CATEGORY_COLORS = toColorMap(BILL_CATEGORIES);
export const TRANSACTION_CATEGORY_ICONS = { ...EXPENSE_CATEGORY_ICONS, ...INCOME_CATEGORY_ICONS };
export const TRANSACTION_CATEGORY_COLORS = { ...EXPENSE_CATEGORY_COLORS, ...INCOME_CATEGORY_COLORS };

/**
 * Categorias de despesa incluindo as de conta — despesas geradas ao quitar uma
 * conta herdam a categoria da conta, então ambas aparecem nos relatórios.
 */
export const ALL_EXPENSE_CATEGORIES = [
  ...EXPENSE_CATEGORIES,
  ...BILL_CATEGORIES.filter(bill => !EXPENSE_CATEGORIES.some(exp => exp.name === bill.name)),
];

export const ALL_EXPENSE_CATEGORY_COLORS = toColorMap(ALL_EXPENSE_CATEGORIES);
export const ALL_EXPENSE_CATEGORY_ICONS = toIconMap(ALL_EXPENSE_CATEGORIES);

export const getCategoryColor = (name, fallbackIndex = 0) =>
  ALL_EXPENSE_CATEGORY_COLORS[name] ||
  TRANSACTION_CATEGORY_COLORS[name] ||
  FALLBACK_CHART_COLORS[fallbackIndex % FALLBACK_CHART_COLORS.length];

export const getCategoryIconName = (name, fallback = 'ellipse') =>
  ALL_EXPENSE_CATEGORY_ICONS[name] || TRANSACTION_CATEGORY_ICONS[name] || fallback;
