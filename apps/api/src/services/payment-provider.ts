export interface CheckoutRequest {
  invoiceId: string
  amountCents: number
  currency: string
  successUrl: string
  cancelUrl: string
}

export interface PaymentProvider {
  createCheckout(request: CheckoutRequest): Promise<{ url: string }>
}
