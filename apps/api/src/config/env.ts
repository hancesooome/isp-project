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

function readServiceAreas(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((area) => area.trim().toLowerCase())
    .filter((area) => area.length > 0)
}

export const env = {
  supabaseUrl: readUrl('SUPABASE_URL'),
  supabaseServiceRoleKey: readRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  serviceAreaKeywords: readServiceAreas(process.env.SERVICE_AREA_KEYWORDS),
}
