type LogLevel = 'info' | 'warn' | 'error'

type LogContext = Record<string, unknown>

const sensitiveKeyPattern =
  /authorization|cookie|password|secret|token|api[_-]?key|signature|client[_-]?secret|payment[_-]?method|card|request[_-]?body/i

const sensitiveValuePatterns = [
  /Bearer\s+\S+/gi,
  /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9_-]+\b/g,
  /\bwhsec_[A-Za-z0-9_-]+\b/g,
  /\bre_[A-Za-z0-9_-]+\b/g,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
]

function redactString(value: string): string {
  return sensitiveValuePatterns.reduce(
    (redacted, pattern) => redacted.replace(pattern, '[REDACTED]'),
    value,
  )
}

function sanitize(
  value: unknown,
  key: string | undefined,
  seen: WeakSet<object>,
  depth = 0,
): unknown {
  if (key && sensitiveKeyPattern.test(key)) {
    return '[REDACTED]'
  }

  if (typeof value === 'string') {
    return redactString(value)
  }

  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (typeof value === 'bigint') {
    return value.toString()
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: value.stack ? redactString(value.stack) : undefined,
    }
  }

  if (typeof value !== 'object' || depth >= 5) {
    return String(value)
  }

  if (seen.has(value)) {
    return '[Circular]'
  }

  seen.add(value)

  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map((item) => sanitize(item, undefined, seen, depth + 1))
  }

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      sanitize(entryValue, entryKey, seen, depth + 1),
    ]),
  )
}

function write(level: LogLevel, message: string, context: LogContext = {}) {
  const entry = sanitize(
    {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    },
    undefined,
    new WeakSet(),
  )
  const output = `${JSON.stringify(entry)}\n`

  if (level === 'error') {
    process.stderr.write(output)
    return
  }

  process.stdout.write(output)
}

export const logger = {
  info: (message: string, context?: LogContext) =>
    write('info', message, context),
  warn: (message: string, context?: LogContext) =>
    write('warn', message, context),
  error: (message: string, context?: LogContext) =>
    write('error', message, context),
}
