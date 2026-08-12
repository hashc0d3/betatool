export const PAYMENT_METHODS = ['cash', 'cashless'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const DEFAULT_PAYMENT_METHOD: PaymentMethod = 'cashless';

export function paymentMethodLabel(method: PaymentMethod | null | undefined): string {
  if (method === 'cash') return 'Наличный';
  if (method === 'cashless') return 'Безналичный';
  return '';
}
