import { useEffect, useState } from 'react'

import { useAuth } from '../auth/auth-context'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { Button } from '../../components/ui/Button'
import { CustomerPageHeader } from '../account/CustomerPageHeader'

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
      <CustomerPageHeader description="View and download your available monthly statements." eyebrow="Billing" title="Statements of Account" />

      <div className="mt-8">
        {error ? (
          <ErrorPanel message={error} title="Statements unavailable" />
        ) : statements === null ? (
          <PageSkeleton count={3} type="list" />
        ) : statements.length === 0 ? (
          <EmptyState
            description="Your Statements of Account will appear here when they are generated."
            title="No statements yet"
          />
        ) : (
          <div>
            {downloadError ? (
              <ErrorPanel message={downloadError} title="Download failed" />
            ) : null}

            <div className="overflow-hidden rounded-[18px] border border-slate-900/8 bg-white shadow-[0_18px_50px_rgba(18,25,38,0.05)]">
            {statements.map((statement) => (
              <article
                className="border-b border-slate-900/8 p-5 last:border-b-0 sm:p-6"
                key={statement.id}
              >
                <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                  <div>
                    <p className="text-xs text-slate-500">Billing period</p>
                    <p className="mt-1 font-semibold text-slate-950">
                      {formatDatabaseDate(statement.billing_period_start)} &ndash;{' '}
                      {formatDatabaseDate(statement.billing_period_end)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Generated</p>
                    <p className="mt-1 text-slate-800">
                      {dateFormatter.format(new Date(statement.created_at))}
                    </p>
                  </div>
                  <Button
                    disabled={downloadingId !== null}
                    onClick={() => void downloadStatement(statement)}
                    type="button"
                  >
                    {downloadingId === statement.id ? (
                      <>
                        <LoadingSpinner size="sm" />
                        <span>Downloading...</span>
                      </>
                    ) : (
                      <span>Download PDF</span>
                    )}
                  </Button>
                </div>
              </article>
            ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
