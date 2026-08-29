export const DEFAULT_AUTHENTICATED_PATH = '/account'

const allowedAuthenticatedPaths = new Set([
  DEFAULT_AUTHENTICATED_PATH,
  '/apply',
])

export function getSafeRedirect(value: string | null): string {
  if (value && allowedAuthenticatedPaths.has(value)) {
    return value
  }

  return DEFAULT_AUTHENTICATED_PATH
}
