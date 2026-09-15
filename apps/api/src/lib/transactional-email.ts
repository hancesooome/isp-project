import { env } from '../config/env.js'

interface TransactionalEmailContent {
  preheader: string
  headline: string
  greeting?: string
  paragraphs: string[]
  action?: { label: string; url: string }
  details?: Array<{ label: string; value: string }>
  notice?: string
}

export function buildTransactionalEmail(content: TransactionalEmailContent): {
  html: string
  text: string
} {
  const actionUrl = content.action ? requireAbsoluteHttpUrl(content.action.url) : null
  const supportUrl = new URL('/account/support', env.appUrl).toString()
  const logoUrl = new URL('/assets/conek-white-C20S-eS4.png', env.appUrl).toString()
  const greeting = content.greeting ?? 'Hello,'
  const detailsText = content.details?.map(({ label, value }) => `${label}: ${value}`).join('\n')
  const text = [
    content.headline,
    greeting,
    ...content.paragraphs,
    detailsText,
    content.notice,
    content.action && actionUrl ? `${content.action.label}: ${actionUrl}` : undefined,
    `Need help? Contact support: ${supportUrl}`,
    'This is an automated service message from Conek. Please do not send passwords or payment details by email.',
  ].filter((value): value is string => Boolean(value)).join('\n\n')

  const detailsHtml = content.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-collapse:collapse;border:1px solid #e4e7ec;border-radius:10px;overflow:hidden">${content.details.map(({ label, value }) => `<tr><td style="padding:10px 14px;border-bottom:1px solid #eef0f3;color:#667085;font-size:13px;width:40%">${escapeHtml(label)}</td><td style="padding:10px 14px;border-bottom:1px solid #eef0f3;color:#111318;font-size:13px;font-weight:600">${escapeHtml(value)}</td></tr>`).join('')}</table>`
    : ''
  const actionHtml = content.action && actionUrl
    ? `<p style="margin:26px 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#245eea;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px">${escapeHtml(content.action.label)}</a></p>`
    : ''
  const noticeHtml = content.notice
    ? `<p style="margin:22px 0 0;padding:14px;border-left:3px solid #4776ff;background:#f5f8ff;color:#475467;font-size:13px;line-height:1.6">${escapeHtml(content.notice)}</p>`
    : ''

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(content.headline)}</title></head><body style="margin:0;background:#f4f6f9;color:#111318;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(content.preheader)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f6f9" style="background:#f4f6f9"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:620px;background:#ffffff;border:1px solid #e4e7ec;border-radius:14px;overflow:hidden"><tr><td bgcolor="#0A0D12" style="padding:24px 30px;background-color:#0A0D12;background-image:linear-gradient(#0A0D12,#0A0D12);border-bottom:1px solid #202631"><img src="${escapeHtml(logoUrl)}" width="174" alt="CONEK" style="display:block;width:174px;max-width:100%;height:auto;border:0"></td></tr><tr><td bgcolor="#ffffff" style="padding:34px 30px;background:#ffffff"><h1 style="margin:0 0 22px;color:#111318;font-size:26px;line-height:1.25;letter-spacing:-0.5px">${escapeHtml(content.headline)}</h1><p style="margin:0 0 16px;color:#344054;font-size:15px;line-height:1.7">${escapeHtml(greeting)}</p>${content.paragraphs.map((paragraph) => `<p style="margin:0 0 16px;color:#475467;font-size:15px;line-height:1.7">${escapeHtml(paragraph)}</p>`).join('')}${detailsHtml}${noticeHtml}${actionHtml}</td></tr><tr><td bgcolor="#fafbfc" style="padding:22px 30px;border-top:1px solid #e4e7ec;background:#fafbfc;color:#667085;font-size:12px;line-height:1.6"><p style="margin:0 0 8px">Need help? <a href="${escapeHtml(supportUrl)}" style="color:#245eea;text-decoration:none">Contact Conek support</a>.</p><p style="margin:0">This automated service message was sent by Conek. Never send passwords or payment details by email.</p></td></tr></table></td></tr></table></body></html>`

  return { html, text }
}

function requireAbsoluteHttpUrl(value: string): string {
  const url = new URL(value)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Transactional email action URL must use HTTP or HTTPS')
  }
  return url.toString()
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
