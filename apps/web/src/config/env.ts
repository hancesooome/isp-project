function readRequiredEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function readUrl(name: keyof ImportMetaEnv): string {
  const value = readRequiredEnv(name)

  try {
    const url = new URL(value)

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Unsupported URL protocol')
    }
  } catch {
    throw new Error(`${name} must be a valid HTTP(S) URL`)
  }

  return value
}

export const env = Object.freeze({
  supabaseUrl: readUrl('VITE_SUPABASE_URL'),
  supabasePublishableKey: readRequiredEnv(
    'VITE_SUPABASE_PUBLISHABLE_KEY',
  ),
})
