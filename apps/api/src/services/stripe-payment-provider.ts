import { stripe } from '../lib/stripe.js'
import type { PaymentProvider } from './payment-provider.js'

export const stripePaymentProvider: PaymentProvider = {
  async createCheckout(request) {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', success_url: request.successUrl, cancel_url: request.cancelUrl,
      client_reference_id: request.invoiceId,
      metadata: { invoice_id: request.invoiceId },
      payment_intent_data: { metadata: { invoice_id: request.invoiceId } },
      line_items: [{ quantity: 1, price_data: {
        currency: request.currency, unit_amount: request.amountCents,
        product_data: { name: `ISP invoice #${request.invoiceId.slice(0, 8).toUpperCase()}` },
      } }],
    })
    if (!session.url) throw new Error('CHECKOUT_URL_MISSING')
    return { url: session.url }
  },
}
