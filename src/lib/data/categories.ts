export interface Cat {
  id: string;
  name: string;
  emoji: string;
}

export const INCOME_CATS: Cat[] = [
  { id: 'salary', name: 'Gaji', emoji: '💼' },
  { id: 'freelance', name: 'Freelance', emoji: '🔧' },
  { id: 'business', name: 'Bisnis', emoji: '🏪' },
  { id: 'invest', name: 'Investasi', emoji: '📈' },
  { id: 'gift', name: 'Hadiah', emoji: '🎁' },
  { id: 'other_inc', name: 'Lainnya', emoji: '💰' }
];

export const EXPENSE_CATS: Cat[] = [
  { id: 'food', name: 'Makanan', emoji: '🍔' },
  { id: 'transport', name: 'Transport', emoji: '🚗' },
  { id: 'shopping', name: 'Belanja', emoji: '🛍️' },
  { id: 'entertainment', name: 'Hiburan', emoji: '🎮' },
  { id: 'health', name: 'Kesehatan', emoji: '💊' },
  { id: 'education', name: 'Pendidikan', emoji: '📚' },
  { id: 'bills', name: 'Tagihan', emoji: '💡' },
  { id: 'home', name: 'Rumah', emoji: '🏠' },
  { id: 'savings', name: 'Tabungan', emoji: '🐷' },
  { id: 'saving_transfer', name: 'Transfer Tabungan', emoji: '🏦' },
  { id: 'debt_transfer', name: 'Hutang/Piutang', emoji: '💳' },
  { id: 'other_exp', name: 'Lainnya', emoji: '💸' }
];

export const WALLET_EMOJIS = ['👛', '💼', '🏦', '💳', '📱', '💵', '🪙', '🏧', '💎', '🏠'];

export const CAT_EMOJIS = [
  '☕', '🍕', '🍔', '🍜', '🍿', '🍰', '🚗', '⛽', '🎬', '🎵', '🐾', '👶', '🎁', '💇', '👕',
  '📱', '💻', '✈️', '🏋️', '⚽', '🎨', '📖', '🧾', '🔧', '💊', '🐕', '🌱', '🧴', '🎯', '💸'
];

export const BUCKET_EMOJIS = ['🎯', '🚗', '💻', '🏠', '✈️', '📱', '💍', '🏋️', '📚', '🎮', '🎸', '🌏', '💊', '👔', '🛋️', '🐶'];

/**
 * Built-in categories + this user's custom ones for a type, in one list.
 * Takes `customCats` as a parameter (rather than reading a global) since
 * this app has no global mutable APP object — the caller passes whatever
 * it got from the reactive `customCategories` store.
 */
export function getCatList(type: 'income' | 'expense', customCats: Cat[] = []): Cat[] {
  const builtin = type === 'income' ? INCOME_CATS : EXPENSE_CATS;
  return [...builtin, ...customCats];
}

export function findCat(id: string, type: 'income' | 'expense', customCats: Cat[] = []): Cat | undefined {
  return getCatList(type, customCats).find((c) => c.id === id);
}
