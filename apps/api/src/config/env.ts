function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is required`)
  }

  return value
}

function readUrl(name: string): string {
  const value = readRequiredEnv(name)

  try {
    return new URL(value).toString()
  } catch {
    throw new Error(`${name} must be a valid URL`)
  }
}

export const env = {
  supabaseUrl: readUrl('SUPABASE_URL'),
  supabaseServiceRoleKey: readRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
}
