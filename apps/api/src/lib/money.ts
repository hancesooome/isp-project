export const BILLING_CURRENCY = 'PHP' as const
export const PAYMENT_CURRENCY = BILLING_CURRENCY.toLowerCase()

export function formatMoney(
  amountCents: number,
  currencyDisplay: 'symbol' | 'code' = 'symbol',
): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: BILLING_CURRENCY,
    currencyDisplay,
  }).format(amountCents / 100)
}
