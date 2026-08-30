export const DEFAULT_AUTHENTICATED_PATH = '/account'

const allowedAuthenticatedPaths = new Set([
  DEFAULT_AUTHENTICATED_PATH,
  '/account/application',
  '/account/invoices',
  '/admin',
  '/admin/applications',
  '/apply',
])

const adminApplicationPath =
  /^\/admin\/applications\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const invoicePath =
  /^\/account\/invoices\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function getSafeRedirect(value: string | null): string {
  if (
    value &&
    (allowedAuthenticatedPaths.has(value) ||
      adminApplicationPath.test(value) ||
      invoicePath.test(value))
  ) {
    return value
  }

  return DEFAULT_AUTHENTICATED_PATH
}
