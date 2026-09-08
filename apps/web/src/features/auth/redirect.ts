export const DEFAULT_AUTHENTICATED_PATH = '/account'

const allowedAuthenticatedPaths = new Set([
  DEFAULT_AUTHENTICATED_PATH,
  '/portal',
  '/account/application',
  '/account/change-plan',
  '/account/plan-changes',
  '/account/installation',
  '/account/invoices',
  '/account/statements',
  '/account/support',
  '/account/help',
  '/admin',
  '/admin/applications',
  '/admin/billing',
  '/admin/coverage',
  '/admin/customers',
  '/admin/faqs',
  '/admin/installations',
  '/admin/plan-changes',
  '/admin/plans',
  '/admin/reports',
  '/admin/subscriptions',
  '/admin/support',
  '/admin/technicians',
  '/technician',
  '/apply',
])

const adminApplicationPath =
  /^\/admin\/applications\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const invoicePath =
  /^\/account\/invoices\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const authenticatedDetailPath =
  /^\/(?:account\/support|admin\/(?:customers|subscriptions|support))\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
    invoicePath.test(destination.pathname) ||
    authenticatedDetailPath.test(destination.pathname)

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

export function getRoleLandingPath(destination: string): string {
  return `/portal?${new URLSearchParams({ redirect: destination }).toString()}`
}

export function getDestinationForRole(
  role: 'customer' | 'admin' | 'technician',
  requestedDestination: string,
): string {
  const destination = getSafeRedirect(requestedDestination)

  if (role === 'customer' && (destination.startsWith('/account') || destination.startsWith('/apply'))) {
    return destination
  }

  if (role === 'admin' && destination.startsWith('/admin')) {
    return destination
  }

  if (role === 'technician' && destination === '/technician') {
    return destination
  }

  return role === 'admin' ? '/admin' : role === 'technician' ? '/technician' : '/account'
}
