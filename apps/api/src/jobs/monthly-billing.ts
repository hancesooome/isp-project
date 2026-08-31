interface MonthlyBillingResult {
  generatedInvoices: number
}

export async function runMonthlyBillingJob(): Promise<MonthlyBillingResult> {
  // Invoice generation is implemented in the next billing ticket.
  return { generatedInvoices: 0 }
}
