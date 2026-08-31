export const DEFAULT_AUTHENTICATED_PATH = '/account'

const allowedAuthenticatedPaths = new Set([
  DEFAULT_AUTHENTICATED_PATH,
  '/account/application',
  '/account/invoices',
  '/account/statements',
  '/admin',
  '/admin/applications',
  '/admin/billing',
  '/apply',
])

const adminApplicationPath =
  /^\/admin\/applications\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const invoicePath =
  /^\/account\/invoices\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function getSafeRedirect(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return DEFAULT_AUTHENTICATED_PATH
  }

  const destination = new URL(value, 'https://isp.local')
  const isAllowedPath =
    allowedAuthenticatedPaths.has(destination.pathname) ||
    adminApplicationPath.test(destination.pathname) ||
    invoicePath.test(destination.pathname)

  if (!isAllowedPath) {
    return DEFAULT_AUTHENTICATED_PATH
  }

  if (!destination.search) {
    return destination.pathname
  }

  const planId = destination.searchParams.get('plan')

  if (
    destination.pathname === '/apply' &&
    destination.searchParams.size === 1 &&
    planId &&
    uuidPattern.test(planId)
  ) {
    return `${destination.pathname}?${destination.searchParams.toString()}`
  }

  return destination.pathname
}
