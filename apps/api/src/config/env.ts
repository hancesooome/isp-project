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

function readNonNegativeInteger(name: string, fallback: number): number {
  const value = process.env[name]?.trim()

  if (!value) {
    return fallback
  }

  const parsed = Number(value)

  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 30) {
    throw new Error(`${name} must be an integer between 0 and 30`)
  }

  return parsed
}

function readIntegerInRange(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const value = process.env[name]?.trim()

  if (!value) {
    return fallback
  }

  const parsed = Number(value)

  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`)
  }

  return parsed
}

export const env = {
  supabaseUrl: readUrl('SUPABASE_URL'),
  supabaseServiceRoleKey: readRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  soaStorageBucket: readRequiredEnv('SOA_STORAGE_BUCKET'),
  serviceAreaKeywords: readServiceAreas(process.env.SERVICE_AREA_KEYWORDS),
  stripeSecretKey: readRequiredEnv('STRIPE_SECRET_KEY'),
  stripeWebhookSecret: readRequiredEnv('STRIPE_WEBHOOK_SECRET'),
  resendApiKey: readRequiredEnv('RESEND_API_KEY'),
  emailFrom: readRequiredEnv('EMAIL_FROM'),
  cronSecret: readRequiredEnv('CRON_SECRET'),
  appUrl: readUrl('APP_URL'),
  psgcApiUrl: new URL(
    process.env.PSGC_API_URL?.trim() || 'https://psgc.cloud/api/v2/',
  ).toString(),
  dueReminderDays: readNonNegativeInteger('DUE_REMINDER_DAYS', 3),
  trustProxyHops: readIntegerInRange(
    'TRUST_PROXY_HOPS',
    process.env.VERCEL ? 1 : 0,
    0,
    5,
  ),
  rateLimitWindowMs: readIntegerInRange(
    'RATE_LIMIT_WINDOW_MS',
    15 * 60 * 1000,
    1000,
    24 * 60 * 60 * 1000,
  ),
  rateLimitMax: readIntegerInRange('RATE_LIMIT_MAX', 300, 1, 100_000),
  writeRateLimitMax: readIntegerInRange(
    'WRITE_RATE_LIMIT_MAX',
    60,
    1,
    100_000,
  ),
  availabilityRateLimitMax: readIntegerInRange(
    'AVAILABILITY_RATE_LIMIT_MAX',
    20,
    1,
    100_000,
  ),
}
