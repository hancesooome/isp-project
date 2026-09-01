import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../auth/auth-context'

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

interface AdminSupportTicket {
  id: string
  subject: string
  status: TicketStatus
  created_at: string
  updated_at: string
  customer: { full_name: string | null } | null
}

interface AdminSupportTicketDetail extends AdminSupportTicket {
  description: string
  resolved_at: string | null
  responses: SupportResponse[]
}

interface SupportResponse {
  id: string
  body: string
  created_at: string
  author: { full_name: string | null } | null
}

interface StatusUpdate {
  id: string
  status: TicketStatus
  updated_at: string
  resolved_at: string | null
}

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}

function isAdminSupportTicket(value: unknown): value is AdminSupportTicket {
  if (typeof value !== 'object' || value === null) return false

  const ticket = value as Record<string, unknown>
  const customer = ticket.customer
  const validCustomer =
    customer === null ||
    (typeof customer === 'object' &&
      'full_name' in customer &&
      isNullableString(customer.full_name))

  return (
    typeof ticket.id === 'string' &&
    typeof ticket.subject === 'string' &&
    (ticket.status === 'open' ||
      ticket.status === 'in_progress' ||
      ticket.status === 'resolved' ||
      ticket.status === 'closed') &&
    typeof ticket.created_at === 'string' &&
    typeof ticket.updated_at === 'string' &&
    validCustomer
  )
}

function isAdminSupportTicketDetail(
  value: unknown,
): value is AdminSupportTicketDetail {
  return (
    isAdminSupportTicket(value) &&
    'description' in value &&
    typeof value.description === 'string' &&
    'resolved_at' in value &&
    isNullableString(value.resolved_at) &&
    'responses' in value &&
    Array.isArray(value.responses) &&
    value.responses.every(isSupportResponse)
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
        isNullableString(author.full_name)))
  )
}

function isStatusUpdate(value: unknown): value is StatusUpdate {
  if (typeof value !== 'object' || value === null) return false

  const ticket = value as Record<string, unknown>
  return (
    typeof ticket.id === 'string' &&
    (ticket.status === 'open' ||
      ticket.status === 'in_progress' ||
      ticket.status === 'resolved' ||
      ticket.status === 'closed') &&
    typeof ticket.updated_at === 'string' &&
    isNullableString(ticket.resolved_at)
  )
}

const statusActions: Record<
  TicketStatus,
  Array<{ label: string; status: TicketStatus }>
> = {
  open: [{ label: 'Start progress', status: 'in_progress' }],
  in_progress: [{ label: 'Mark resolved', status: 'resolved' }],
  resolved: [
    { label: 'Reopen ticket', status: 'in_progress' },
    { label: 'Close ticket', status: 'closed' },
  ],
  closed: [],
}

export function AdminSupportTicketsPage() {
  const { session } = useAuth()
  const [tickets, setTickets] = useState<AdminSupportTicket[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()

    async function loadTickets() {
      try {
        const response = await fetch('/api/admin/support-tickets', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          signal: controller.signal,
        })

        if (!response.ok) throw new Error('ADMIN_SUPPORT_TICKETS_REQUEST_FAILED')

        const result: unknown = await response.json()
        if (
          typeof result !== 'object' ||
          result === null ||
          !('tickets' in result) ||
          !Array.isArray(result.tickets) ||
          !result.tickets.every(isAdminSupportTicket)
        ) {
          throw new Error('INVALID_ADMIN_SUPPORT_TICKETS_RESPONSE')
        }

        setTickets(result.tickets)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return
        setError('We could not load support tickets. Please try again later.')
      }
    }

    void loadTickets()
    return () => controller.abort()
  }, [session])

  return (
    <section className="w-full">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-amber-400 uppercase">Operations</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">Support tickets</h1>
          <p className="mt-2 text-sm text-slate-400">Review customer requests requiring staff attention.</p>
        </div>
        {tickets ? <p className="text-xs font-medium text-slate-500">{tickets.length} total</p> : null}
      </header>

      <div className="mt-7">
        {error ? (
          <ErrorPanel message={error} title="Support tickets unavailable" />
        ) : tickets === null ? (
          <PageSkeleton count={4} type="list" />
        ) : tickets.length === 0 ? (
          <EmptyState
            description="Customer support requests will appear here when submitted."
            title="No support tickets"
          />
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-white/10 bg-[#11161f] shadow-xl">
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full border-collapse text-left text-sm">
                <thead className="border-b border-white/8 bg-white/[0.025] text-[10px] font-semibold tracking-[0.12em] text-slate-500 uppercase">
                  <tr>
                    <th className="px-5 py-3" scope="col">Ticket</th>
                    <th className="px-5 py-3" scope="col">Customer</th>
                    <th className="px-5 py-3" scope="col">Created</th>
                    <th className="px-5 py-3" scope="col">Status</th>
                    <th className="px-5 py-3 text-right" scope="col"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {tickets.map((ticket) => (
                    <tr className="transition hover:bg-white/[0.025]" key={ticket.id}>
                      <td className="max-w-sm px-5 py-4">
                        <p className="truncate font-semibold text-slate-100">{ticket.subject}</p>
                        <p className="mt-1 font-mono text-[11px] text-slate-500">#{ticket.id.slice(0, 8).toUpperCase()}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-300">{ticket.customer?.full_name ?? 'Name unavailable'}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-400">{dateFormatter.format(new Date(ticket.created_at))}</td>
                      <td className="px-5 py-4"><StatusBadge status={ticket.status} /></td>
                      <td className="px-5 py-4 text-right">
                        <Link className="font-semibold text-blue-400 transition hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" to={`/admin/support/${encodeURIComponent(ticket.id)}`}>
                          Inspect &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export function AdminSupportTicketDetailsPage({ ticketId }: { ticketId: string }) {
  const { session } = useAuth()
  const [ticket, setTicket] = useState<AdminSupportTicketDetail | null>()
  const [error, setError] = useState<string | null>(null)
  const [responseBody, setResponseBody] = useState('')
  const [responseError, setResponseError] = useState<string | null>(null)
  const [responseSuccess, setResponseSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()

    async function loadTicket() {
      try {
        const response = await fetch(`/api/admin/support-tickets/${encodeURIComponent(ticketId)}`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          signal: controller.signal,
        })

        if (response.status === 404) {
          setTicket(null)
          return
        }
        if (!response.ok) throw new Error('ADMIN_SUPPORT_TICKET_REQUEST_FAILED')

        const result: unknown = await response.json()
        if (
          typeof result !== 'object' ||
          result === null ||
          !('ticket' in result) ||
          !isAdminSupportTicketDetail(result.ticket)
        ) {
          throw new Error('INVALID_ADMIN_SUPPORT_TICKET_RESPONSE')
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session || !ticket || isSubmitting) return

    const body = responseBody.trim()
    if (!body) {
      setResponseError('Enter a response before sending.')
      return
    }
    if (body.length > 5000) {
      setResponseError('Response must be 5,000 characters or fewer.')
      return
    }

    setResponseError(null)
    setResponseSuccess(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(
        `/api/admin/support-tickets/${encodeURIComponent(ticket.id)}/responses`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body }),
        },
      )

      if (!response.ok) throw new Error('SUPPORT_RESPONSE_REQUEST_FAILED')

      const result: unknown = await response.json()
      if (
        typeof result !== 'object' ||
        result === null ||
        !('response' in result) ||
        !isSupportResponse(result.response)
      ) {
        throw new Error('INVALID_SUPPORT_RESPONSE')
      }

      const createdResponse = result.response
      setTicket((current) =>
        current
          ? { ...current, responses: [...current.responses, createdResponse] }
          : current,
      )
      setResponseBody('')
      setResponseSuccess('Response sent successfully.')
    } catch {
      setResponseError('We could not send this response. Please try again later.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleStatusUpdate(status: TicketStatus) {
    if (!session || !ticket || isUpdatingStatus) return

    setStatusError(null)
    setStatusSuccess(null)
    setIsUpdatingStatus(true)

    try {
      const response = await fetch(
        `/api/admin/support-tickets/${encodeURIComponent(ticket.id)}/status`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
        },
      )

      if (!response.ok) throw new Error('SUPPORT_STATUS_REQUEST_FAILED')

      const result: unknown = await response.json()
      if (
        typeof result !== 'object' ||
        result === null ||
        !('ticket' in result) ||
        !isStatusUpdate(result.ticket)
      ) {
        throw new Error('INVALID_SUPPORT_STATUS_RESPONSE')
      }

      const updatedTicket = result.ticket
      setTicket((current) =>
        current
          ? {
              ...current,
              status: updatedTicket.status,
              updated_at: updatedTicket.updated_at,
              resolved_at: updatedTicket.resolved_at,
            }
          : current,
      )
      setStatusSuccess(`Ticket marked ${updatedTicket.status.replace('_', ' ')}.`)
    } catch {
      setStatusError('We could not update this ticket status. Refresh and try again.')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  if (error) return <ErrorPanel message={error} title="Support ticket unavailable" />
  if (ticket === undefined) return <PageSkeleton type="detail" />
  if (ticket === null) {
    return (
      <EmptyState
        action={<BackLink />}
        description="This support ticket does not exist or is no longer available."
        title="Support ticket not found"
      />
    )
  }

  return (
    <section className="w-full max-w-4xl">
      <BackLink />
      <header className="mt-6">
        <p className="text-xs font-semibold tracking-[0.18em] text-amber-400 uppercase">Support review</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="break-words text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">{ticket.subject}</h1>
            <p className="mt-2 font-mono text-xs text-slate-500">Ticket #{ticket.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <StatusBadge status={ticket.status} />
        </div>
      </header>

      <div className="mt-7 grid items-start gap-5 md:grid-cols-[0.7fr_1.3fr]">
        <article className="rounded-[14px] border border-white/10 bg-[#11161f] p-5 shadow-lg">
          <h2 className="text-sm font-semibold text-white">Ticket information</h2>
          <dl className="mt-5 space-y-5">
            <Detail label="Customer" value={ticket.customer?.full_name ?? 'Name unavailable'} />
            <Detail label="Created" value={dateFormatter.format(new Date(ticket.created_at))} />
            <Detail label="Last updated" value={dateFormatter.format(new Date(ticket.updated_at))} />
            {ticket.resolved_at ? <Detail label="Resolved" value={dateFormatter.format(new Date(ticket.resolved_at))} /> : null}
          </dl>
          <div className="mt-6 border-t border-white/8 pt-5">
            <p className="text-xs font-semibold tracking-[0.1em] text-slate-500 uppercase">Status actions</p>
            {statusActions[ticket.status].length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">This ticket is closed.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {statusActions[ticket.status].map((action) => (
                  <button
                    className="min-h-10 rounded-[9px] border border-white/10 bg-white/6 px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isUpdatingStatus}
                    key={action.status}
                    onClick={() => void handleStatusUpdate(action.status)}
                    type="button"
                  >
                    {isUpdatingStatus ? 'Updating...' : action.label}
                  </button>
                ))}
              </div>
            )}
            {statusError ? <p className="mt-3 text-xs text-red-300" role="alert">{statusError}</p> : null}
            {statusSuccess ? <p className="mt-3 text-xs text-emerald-300" role="status">{statusSuccess}</p> : null}
          </div>
        </article>

        <div className="space-y-5">
          <article className="rounded-[14px] border border-white/10 bg-[#11161f] p-5 shadow-lg sm:p-6">
            <h2 className="text-sm font-semibold text-white">Conversation</h2>
            <div className="mt-5 rounded-[12px] border border-white/8 bg-white/[0.025] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-200">{ticket.customer?.full_name ?? 'Customer'}</p>
                <time className="text-[11px] text-slate-500" dateTime={ticket.created_at}>{dateFormatter.format(new Date(ticket.created_at))}</time>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">{ticket.description}</p>
            </div>

            {ticket.responses.length === 0 ? (
              <p className="mt-4 rounded-[10px] border border-dashed border-white/10 p-4 text-sm text-slate-500">No staff responses yet.</p>
            ) : (
              <ol className="mt-4 space-y-3" aria-label="Staff responses">
                {ticket.responses.map((response) => (
                  <li className="ml-auto max-w-[94%] rounded-[12px] border border-blue-400/20 bg-blue-500/8 p-4" key={response.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-blue-200">{response.author?.full_name ?? 'Administrator'}</p>
                      <time className="text-[11px] text-blue-300/60" dateTime={response.created_at}>{dateFormatter.format(new Date(response.created_at))}</time>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{response.body}</p>
                  </li>
                ))}
              </ol>
            )}
          </article>

          <form className="rounded-[14px] border border-white/10 bg-[#11161f] p-5 shadow-lg sm:p-6" noValidate onSubmit={handleSubmit}>
            <label className="text-sm font-semibold text-white" htmlFor="support-response">Add staff response</label>
            <p className="mt-1 text-xs text-slate-500">The customer will see this response in their ticket conversation.</p>
            <textarea
              aria-describedby={responseError ? 'support-response-error' : 'support-response-help'}
              aria-invalid={Boolean(responseError)}
              className="mt-4 min-h-32 w-full resize-y rounded-[10px] border border-white/10 bg-[#0a0d12] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/15"
              id="support-response"
              maxLength={5000}
              onChange={(event) => {
                setResponseBody(event.target.value)
                setResponseError(null)
                setResponseSuccess(null)
              }}
              placeholder="Write a clear response to the customer"
              value={responseBody}
            />
            {responseError ? (
              <p className="mt-2 text-sm text-red-300" id="support-response-error" role="alert">{responseError}</p>
            ) : (
              <p className="mt-2 text-xs text-slate-500" id="support-response-help">Up to 5,000 characters.</p>
            )}
            {responseSuccess ? <p className="mt-3 text-sm text-emerald-300" role="status">{responseSuccess}</p> : null}
            <button
              className="mt-4 flex min-h-10 items-center justify-center gap-2 rounded-[9px] bg-blue-500 px-4 text-sm font-semibold text-white transition hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? <><LoadingSpinner /><span>Sending...</span></> : 'Send response'}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}

function BackLink() {
  return (
    <Link className="text-sm font-semibold text-blue-400 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" to="/admin/support">
      &larr; Back to support tickets
    </Link>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-200">{value}</dd></div>
}
