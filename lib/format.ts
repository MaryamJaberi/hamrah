import type { Currency } from './types';

export function formatPrice(amount: number, currency: Currency) {
  if (!amount) return 'رایگان';
  if (currency === 'irr') return `${Math.round(amount / 10).toLocaleString('fa-IR')} تومان`;
  const sym = currency === 'eur' ? '€' : '$';
  return `${sym}${(amount / 100).toFixed(amount % 100 ? 2 : 0)}`;
}

export function faDate(iso: string) {
  return new Date(iso).toLocaleDateString('fa-IR');
}
