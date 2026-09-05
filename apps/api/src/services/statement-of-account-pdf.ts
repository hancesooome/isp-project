import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib'

import { formatMoney } from '../lib/money.js'
import {
  generateStatementOfAccount,
  type StatementOfAccount,
} from './statement-of-account.js'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 48

function safePdfText(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, '?')
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))
}

function wrapText(
  value: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = safePdfText(value).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word

    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }

  if (line) lines.push(line)
  return lines.length > 0 ? lines : ['-']
}

export async function renderStatementOfAccountPdf(
  statement: StatementOfAccount,
): Promise<Buffer> {
  const document = await PDFDocument.create()
  const regular = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  const mono = await document.embedFont(StandardFonts.Courier)
  const monoBold = await document.embedFont(StandardFonts.CourierBold)
  const dark = rgb(0.08, 0.12, 0.2)
  const muted = rgb(0.35, 0.4, 0.48)
  const accent = rgb(0.02, 0.55, 0.78)
  let page: PDFPage
  let y: number

  function addPage(): void {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    y = PAGE_HEIGHT - MARGIN
  }

  function ensureSpace(height: number): void {
    if (y - height < MARGIN) addPage()
  }

  function line(
    text: string,
    options: {
      size?: number
      font?: PDFFont
      color?: ReturnType<typeof rgb>
      x?: number
      gap?: number
    } = {},
  ): void {
    const size = options.size ?? 10
    ensureSpace(size + (options.gap ?? 7))
    page.drawText(safePdfText(text), {
      x: options.x ?? MARGIN,
      y,
      size,
      font: options.font ?? regular,
      color: options.color ?? dark,
    })
    y -= size + (options.gap ?? 7)
  }

  function wrappedLine(label: string, value: string): void {
    const labelWidth = 115
    const valueLines = wrapText(value, regular, 10, PAGE_WIDTH - MARGIN * 2 - labelWidth)
    ensureSpace(valueLines.length * 15)
    page.drawText(label, { x: MARGIN, y, size: 10, font: bold, color: muted })

    for (const [index, valueLine] of valueLines.entries()) {
      page.drawText(valueLine, {
        x: MARGIN + labelWidth,
        y: y - index * 15,
        size: 10,
        font: regular,
        color: dark,
      })
    }

    y -= valueLines.length * 15 + 3
  }

  function section(title: string): void {
    ensureSpace(35)
    y -= 8
    line(title, { size: 12, font: bold, color: accent, gap: 8 })
  }

  addPage()
  document.setTitle('Statement of Account')
  document.setAuthor('ISP Platform')
  document.setCreationDate(new Date(statement.generated_at))

  line('ISP PLATFORM', { size: 11, font: bold, color: accent, gap: 8 })
  line('Statement of Account', { size: 24, font: bold, gap: 12 })
  wrappedLine('Generated', formatTimestamp(statement.generated_at))
  wrappedLine(
    'Account reference',
    statement.customer.id.slice(0, 8).toUpperCase(),
  )

  const firstInvoice = statement.invoices[0]
  const lastInvoice = statement.invoices.at(-1)
  wrappedLine(
    'Statement period',
    firstInvoice && lastInvoice
      ? `${formatDate(firstInvoice.billing_period_start)} - ${formatDate(lastInvoice.billing_period_end)}`
      : 'No invoiced period',
  )

  section('Customer')
  wrappedLine('Name', statement.customer.full_name ?? 'Not provided')
  wrappedLine('Email', statement.customer.email)
  wrappedLine('Phone', statement.customer.phone ?? 'Not provided')
  wrappedLine('Address', statement.customer.address ?? 'Not provided')
  wrappedLine(
    'Service address',
    statement.customer.installation_address ?? 'Not provided',
  )

  section('Subscription')
  if (statement.subscription) {
    wrappedLine('Plan', statement.subscription.plan.name)
    wrappedLine('Billing interval', statement.subscription.plan.billing_interval)
    wrappedLine('Status', statement.subscription.status.toUpperCase())
    wrappedLine('Started', formatTimestamp(statement.subscription.started_at))
  } else {
    line('No subscription on record.', { color: muted })
  }

  section('Invoices and charges')
  if (statement.invoices.length === 0) {
    line('No invoices on record.', { color: muted })
  } else {
    line('Reference    Billing period                  Due          Status       Amount', {
      size: 8,
      font: monoBold,
      gap: 5,
    })

    for (const invoice of statement.invoices) {
      const reference = invoice.id.slice(0, 8).toUpperCase().padEnd(12)
      const period = `${invoice.billing_period_start} - ${invoice.billing_period_end}`.padEnd(32)
      const due = invoice.due_date.padEnd(13)
      const status = invoice.status.toUpperCase().padEnd(13)
      line(`${reference}${period}${due}${status}${formatMoney(invoice.amount_cents, 'code')}`, {
        size: 8,
        font: mono,
        gap: 5,
      })
    }
  }

  section('Payments')
  if (statement.payments.length === 0) {
    line('No successful payments on record.', { color: muted })
  } else {
    line('Payment date              Invoice       Amount', {
      size: 8,
      font: monoBold,
      gap: 5,
    })

    for (const payment of statement.payments) {
      const paidAt = formatTimestamp(payment.paid_at).padEnd(26)
      const invoiceReference = payment.invoice_id.slice(0, 8).toUpperCase().padEnd(14)
      line(`${paidAt}${invoiceReference}${formatMoney(payment.amount_cents, 'code')}`, {
        size: 8,
        font: mono,
        gap: 5,
      })
    }
  }

  section('Totals')
  wrappedLine('Total invoiced', formatMoney(statement.totals.invoiced_cents, 'code'))
  wrappedLine('Total paid', formatMoney(statement.totals.paid_cents, 'code'))
  wrappedLine('Balance', formatMoney(statement.totals.balance_cents, 'code'))

  for (const [index, currentPage] of document.getPages().entries()) {
    currentPage.drawText(`Page ${index + 1} of ${document.getPageCount()}`, {
      x: PAGE_WIDTH - MARGIN - 70,
      y: 24,
      size: 8,
      font: regular,
      color: muted,
    })
  }

  return Buffer.from(await document.save())
}

export async function generateStatementOfAccountPdf(
  userId: string,
): Promise<Buffer | null> {
  const statement = await generateStatementOfAccount(userId)
  return statement ? renderStatementOfAccountPdf(statement) : null
}
