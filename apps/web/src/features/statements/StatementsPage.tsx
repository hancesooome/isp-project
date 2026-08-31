import { useEffect, useState } from 'react'

import { useAuth } from '../auth/auth-context'

interface Statement {
  id: string
  billing_period_start: string
  billing_period_end: string
  created_at: string
}

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
})

function isStatement(value: unknown): value is Statement {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const statement = value as Record<string, unknown>

  return (
    typeof statement.id === 'string' &&
    typeof statement.billing_period_start === 'string' &&
    typeof statement.billing_period_end === 'string' &&
    typeof statement.created_at === 'string'
  )
}

function formatDatabaseDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T00:00:00`))
}

export function StatementsPage() {
  const { session } = useAuth()
  const [statements, setStatements] = useState<Statement[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    if (!session) {
      return
    }

    const controller = new AbortController()

    async function loadStatements() {
      try {
        const response = await fetch('/api/statements', {
          headers: {
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('STATEMENTS_REQUEST_FAILED')
        }

        const result: unknown = await response.json()

        if (
          typeof result !== 'object' ||
          result === null ||
          !('statements' in result) ||
          !Array.isArray(result.statements) ||
          !result.statements.every(isStatement)
        ) {
          throw new Error('INVALID_STATEMENTS_RESPONSE')
        }

        setStatements(result.statements)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return
        }

        setError('We could not load your statements. Please try again later.')
      }
    }

    void loadStatements()
    return () => controller.abort()
  }, [session])

  async function downloadStatement(statement: Statement) {
    if (!session || downloadingId) {
      return
    }

    setDownloadError(null)
    setDownloadingId(statement.id)

    try {
      const response = await fetch(
        `/api/statements/${encodeURIComponent(statement.id)}/download`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error('STATEMENT_DOWNLOAD_FAILED')
      }

      const pdf = await response.blob()

      if (pdf.type !== 'application/pdf') {
        throw new Error('INVALID_STATEMENT_FILE')
      }

      const downloadUrl = URL.createObjectURL(pdf)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `statement-of-account-${statement.billing_period_start.slice(0, 7)}.pdf`
      link.click()
      URL.revokeObjectURL(downloadUrl)
    } catch {
      setDownloadError(
        'We could not download this statement. Please try again later.',
      )
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <section className="w-full max-w-5xl">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
          Billing
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
          Statements of Account
        </h1>
        <p className="mt-2 text-slate-400">
          View and download your available monthly statements.
        </p>
      </header>

      {error ? (
        <p className="mt-8 rounded-xl border border-red-900 bg-red-950/50 p-5 text-center text-red-200" role="alert">
          {error}
        </p>
      ) : statements === null ? (
        <p className="mt-8 text-slate-300" role="status">
          Loading your statements...
        </p>
      ) : statements.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
          <h2 className="text-xl font-bold text-white">No statements yet</h2>
          <p className="mt-2 text-slate-400">
            Your Statements of Account will appear here when they are generated.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {downloadError ? (
            <p className="rounded-xl border border-red-900 bg-red-950/50 p-4 text-red-200" role="alert">
              {downloadError}
            </p>
          ) : null}

          {statements.map((statement) => (
            <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl sm:p-6" key={statement.id}>
              <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                <div>
                  <p className="text-sm text-slate-400">Billing period</p>
                  <p className="mt-1 font-semibold text-white">
                    {formatDatabaseDate(statement.billing_period_start)} –{' '}
                    {formatDatabaseDate(statement.billing_period_end)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Generated</p>
                  <p className="mt-1 text-white">
                    {dateFormatter.format(new Date(statement.created_at))}
                  </p>
                </div>
                <button
                  className="rounded-lg bg-sky-500 px-4 py-2 font-semibold text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={downloadingId !== null}
                  onClick={() => void downloadStatement(statement)}
                  type="button"
                >
                  {downloadingId === statement.id ? 'Downloading...' : 'Download PDF'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
