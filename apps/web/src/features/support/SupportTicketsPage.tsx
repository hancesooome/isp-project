import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { z, type ZodError } from 'zod'

import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../auth/auth-context'

interface SupportTicket {
  id: string
  subject: string
  description: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  created_at: string
  updated_at: string
  resolved_at: string | null
}

interface SupportResponse {
  id: string
  body: string
  created_at: string
  author: { full_name: string | null } | null
}

interface SupportTicketDetail extends SupportTicket {
  responses: SupportResponse[]
}

const ticketSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, 'Subject must be at least 3 characters')
    .max(200, 'Subject must be 200 characters or fewer'),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must be 5,000 characters or fewer'),
})

type TicketFormValues = z.infer<typeof ticketSchema>
type FieldErrors = Partial<Record<keyof TicketFormValues, string>>

const initialValues: TicketFormValues = { subject: '', description: '' }
const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function isSupportTicket(value: unknown): value is SupportTicket {
  if (typeof value !== 'object' || value === null) return false

  const ticket = value as Record<string, unknown>
  const validStatus =
    ticket.status === 'open' ||
    ticket.status === 'in_progress' ||
    ticket.status === 'resolved' ||
    ticket.status === 'closed'

  return (
    typeof ticket.id === 'string' &&
    typeof ticket.subject === 'string' &&
    typeof ticket.description === 'string' &&
    validStatus &&
    typeof ticket.created_at === 'string' &&
    typeof ticket.updated_at === 'string' &&
    (ticket.resolved_at === null || typeof ticket.resolved_at === 'string')
  )
}

function isSupportResponse(value: unknown): value is SupportResponse {
  if (typeof value !== 'object' || value === null) return false

  const response = value as Record<string, unknown>
  const author = response.author

  return (
    typeof response.id === 'string' &&
    typeof response.body === 'string' &&
    typeof response.created_at === 'string' &&
    (author === null ||
      (typeof author === 'object' &&
        'full_name' in author &&
        (typeof author.full_name === 'string' || author.full_name === null)))
  )
}

function isSupportTicketDetail(value: unknown): value is SupportTicketDetail {
  return (
    isSupportTicket(value) &&
    'responses' in value &&
    Array.isArray(value.responses) &&
    value.responses.every(isSupportResponse)
  )
}

function getFieldErrors(error: ZodError<TicketFormValues>): FieldErrors {
  const errors: FieldErrors = {}

  for (const issue of error.issues) {
    const field = issue.path[0]
    if (typeof field === 'string' && !(field in errors)) {
      errors[field as keyof TicketFormValues] = issue.message
    }
  }

  return errors
}

export function SupportTicketsPage() {
  const { session } = useAuth()
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null)
  const [values, setValues] = useState(initialValues)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!session) return

    const controller = new AbortController()

    async function loadTickets() {
      try {
        const response = await fetch('/api/support-tickets', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          signal: controller.signal,
        })

        if (!response.ok) throw new Error('SUPPORT_TICKETS_REQUEST_FAILED')

        const result: unknown = await response.json()
        if (
          typeof result !== 'object' ||
          result === null ||
          !('tickets' in result) ||
          !Array.isArray(result.tickets) ||
          !result.tickets.every(isSupportTicket)
        ) {
          throw new Error('INVALID_SUPPORT_TICKETS_RESPONSE')
        }

        setTickets(result.tickets)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        setLoadError('We could not load your support tickets. Please try again later.')
      }
    }

    void loadTickets()
    return () => controller.abort()
  }, [session])

  function updateField(field: keyof TicketFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setSubmissionError(null)
    setSuccessMessage(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    const parsed = ticketSchema.safeParse(values)
    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error))
      return
    }

    if (!session) {
      setSubmissionError('Your session has expired. Please sign in again.')
      return
    }

    setFieldErrors({})
    setSubmissionError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/support-tickets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsed.data),
      })

      if (!response.ok) throw new Error('SUPPORT_TICKET_SUBMISSION_FAILED')

      const result: unknown = await response.json()
      if (
        typeof result !== 'object' ||
        result === null ||
        !('ticket' in result) ||
        !isSupportTicket(result.ticket)
      ) {
        throw new Error('INVALID_SUPPORT_TICKET_RESPONSE')
      }

      const createdTicket = result.ticket
      setTickets((current) => [createdTicket, ...(current ?? [])])
      setLoadError(null)
      setValues(initialValues)
      setSuccessMessage(`Ticket #${createdTicket.id.slice(0, 8).toUpperCase()} was created.`)
    } catch {
      setSubmissionError('We could not create your ticket. Please try again later.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="w-full max-w-6xl">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
          Customer support
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-slate-950 sm:text-4xl">
          How can we help?
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Send us the details and track your support requests from one place.
        </p>
      </header>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
        <form
          className="rounded-[18px] border border-slate-900/10 bg-white/85 p-5 shadow-[0_16px_45px_rgba(15,23,42,0.07)] backdrop-blur-xl sm:p-6"
          noValidate
          onSubmit={handleSubmit}
        >
          <h2 className="text-xl font-bold text-slate-950">Create a ticket</h2>
          <p className="mt-1 text-sm text-slate-600">
            Describe the issue clearly so our team can investigate.
          </p>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="support-subject">
              Subject
            </label>
            <input
              aria-describedby={fieldErrors.subject ? 'support-subject-error' : undefined}
              aria-invalid={Boolean(fieldErrors.subject)}
              autoComplete="off"
              className="min-h-11 w-full rounded-[10px] border border-slate-900/15 bg-white px-3.5 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              id="support-subject"
              maxLength={200}
              onChange={(event) => updateField('subject', event.target.value)}
              placeholder="Briefly describe the issue"
              value={values.subject}
            />
            {fieldErrors.subject ? (
              <p className="mt-1.5 text-sm text-red-600" id="support-subject-error" role="alert">
                {fieldErrors.subject}
              </p>
            ) : null}
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="support-description">
              Description
            </label>
            <textarea
              aria-describedby={fieldErrors.description ? 'support-description-error' : 'support-description-help'}
              aria-invalid={Boolean(fieldErrors.description)}
              className="min-h-36 w-full resize-y rounded-[10px] border border-slate-900/15 bg-white px-3.5 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              id="support-description"
              maxLength={5000}
              onChange={(event) => updateField('description', event.target.value)}
              placeholder="Include what happened and any steps you already tried"
              value={values.description}
            />
            {fieldErrors.description ? (
              <p className="mt-1.5 text-sm text-red-600" id="support-description-error" role="alert">
                {fieldErrors.description}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-slate-500" id="support-description-help">
                Minimum 10 characters.
              </p>
            )}
          </div>

          {submissionError ? (
            <p className="mt-5 rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
              {submissionError}
            </p>
          ) : null}
          {successMessage ? (
            <p className="mt-5 rounded-[10px] border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700" role="status">
              {successMessage}
            </p>
          ) : null}

          <button
            className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[linear-gradient(90deg,#172033,#315fca)] px-4 font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? <><LoadingSpinner /><span>Creating ticket...</span></> : 'Submit ticket'}
          </button>
        </form>

        <div>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Your tickets</h2>
              <p className="mt-1 text-sm text-slate-600">Newest requests appear first.</p>
            </div>
            {tickets ? <span className="text-sm font-medium text-slate-500">{tickets.length} total</span> : null}
          </div>

          {loadError ? (
            <ErrorPanel message={loadError} title="Tickets unavailable" />
          ) : tickets === null ? (
            <PageSkeleton count={3} type="list" />
          ) : tickets.length === 0 ? (
            <EmptyState
              description="When you contact support, your requests and their latest status will appear here."
              title="No support tickets yet"
            />
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <article className="rounded-[16px] border border-slate-900/10 bg-white/85 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]" key={ticket.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
                        #{ticket.id.slice(0, 8).toUpperCase()}
                      </p>
                      <h3 className="mt-1 break-words text-lg font-bold text-slate-950">{ticket.subject}</h3>
                      <p className="mt-1 text-sm text-slate-500">Created {dateFormatter.format(new Date(ticket.created_at))}</p>
                    </div>
                    <StatusBadge status={ticket.status} />
                  </div>
                  <p className="mt-4 line-clamp-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{ticket.description}</p>
                  <div className="mt-4 border-t border-slate-900/8 pt-4">
                    <Link className="font-semibold text-blue-600 transition hover:text-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" to={`/account/support/${encodeURIComponent(ticket.id)}`}>
                      Open ticket &rarr;
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export function SupportTicketDetailsPage({ ticketId }: { ticketId: string }) {
  const { session } = useAuth()
  const [ticket, setTicket] = useState<SupportTicketDetail | null>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()

    async function loadTicket() {
      try {
        const response = await fetch(`/api/support-tickets/${encodeURIComponent(ticketId)}`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          signal: controller.signal,
        })

        if (response.status === 404) {
          setTicket(null)
          return
        }
        if (!response.ok) throw new Error('SUPPORT_TICKET_REQUEST_FAILED')

        const result: unknown = await response.json()
        if (
          typeof result !== 'object' ||
          result === null ||
          !('ticket' in result) ||
          !isSupportTicketDetail(result.ticket)
        ) {
          throw new Error('INVALID_SUPPORT_TICKET_RESPONSE')
        }
        setTicket(result.ticket)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return
        setError('We could not load this support ticket. Please try again later.')
      }
    }

    void loadTicket()
    return () => controller.abort()
  }, [session, ticketId])

  if (error) return <ErrorPanel message={error} title="Ticket unavailable" />
  if (ticket === undefined) return <PageSkeleton type="detail" />
  if (ticket === null) {
    return (
      <EmptyState
        action={<Link className="font-semibold text-blue-600 hover:text-blue-500" to="/account/support">&larr; Back to support</Link>}
        description="This ticket does not exist or is not available to your account."
        title="Ticket not found"
      />
    )
  }

  return (
    <section className="w-full max-w-3xl">
      <Link className="text-sm font-semibold text-blue-600 hover:text-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" to="/account/support">
        &larr; Back to support
      </Link>
      <article className="mt-6 rounded-[18px] border border-slate-900/10 bg-white/85 p-6 shadow-[0_16px_45px_rgba(15,23,42,0.07)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-blue-600 uppercase">Support ticket #{ticket.id.slice(0, 8).toUpperCase()}</p>
            <h1 className="mt-3 break-words text-3xl font-bold tracking-[-0.03em] text-slate-950">{ticket.subject}</h1>
          </div>
          <StatusBadge status={ticket.status} />
        </div>
        <dl className="mt-7 grid gap-4 border-y border-slate-900/8 py-5 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Created</dt><dd className="mt-1 font-semibold text-slate-950">{dateFormatter.format(new Date(ticket.created_at))}</dd></div>
          <div><dt className="text-slate-500">Last updated</dt><dd className="mt-1 font-semibold text-slate-950">{dateFormatter.format(new Date(ticket.updated_at))}</dd></div>
        </dl>
        <section className="mt-7 border-t border-slate-900/8 pt-7">
          <h2 className="text-lg font-bold text-slate-950">Conversation</h2>
          <div className="mt-4 rounded-[14px] border border-slate-900/8 bg-slate-50 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-950">You</p>
              <time className="text-xs text-slate-500" dateTime={ticket.created_at}>
                {dateFormatter.format(new Date(ticket.created_at))}
              </time>
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{ticket.description}</p>
          </div>

          {ticket.responses.length === 0 ? (
            <p className="mt-4 rounded-[12px] border border-dashed border-slate-900/12 p-4 text-sm text-slate-500">
              No staff responses yet. Updates from our support team will appear here.
            </p>
          ) : (
            <ol className="mt-4 space-y-4" aria-label="Staff responses">
              {ticket.responses.map((response) => (
                <li className="ml-auto max-w-[92%] rounded-[14px] border border-blue-200 bg-blue-50 p-4 sm:p-5" key={response.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-blue-950">
                      {response.author?.full_name ?? 'Support team'}
                    </p>
                    <time className="text-xs text-blue-700/70" dateTime={response.created_at}>
                      {dateFormatter.format(new Date(response.created_at))}
                    </time>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-blue-950/80">{response.body}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </article>
    </section>
  )
}
