export const BILLING_CURRENCY = 'PHP' as const

export const moneyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: BILLING_CURRENCY,
})

export function formatMoney(amountCents: number) {
  return moneyFormatter.format(amountCents / 100)
}
