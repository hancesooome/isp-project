import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../auth/auth-context'

interface AdminSupportTicket {
  id: string
  subject: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  created_at: string
  updated_at: string
  customer: { full_name: string | null } | null
}

interface AdminSupportTicketDetail extends AdminSupportTicket {
  description: string
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
    isNullableString(value.resolved_at)
  )
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

      <div className="mt-7 grid gap-5 md:grid-cols-[0.7fr_1.3fr]">
        <article className="rounded-[14px] border border-white/10 bg-[#11161f] p-5 shadow-lg">
          <h2 className="text-sm font-semibold text-white">Ticket information</h2>
          <dl className="mt-5 space-y-5">
            <Detail label="Customer" value={ticket.customer?.full_name ?? 'Name unavailable'} />
            <Detail label="Created" value={dateFormatter.format(new Date(ticket.created_at))} />
            <Detail label="Last updated" value={dateFormatter.format(new Date(ticket.updated_at))} />
            {ticket.resolved_at ? <Detail label="Resolved" value={dateFormatter.format(new Date(ticket.resolved_at))} /> : null}
          </dl>
        </article>

        <article className="rounded-[14px] border border-white/10 bg-[#11161f] p-5 shadow-lg sm:p-6">
          <h2 className="text-sm font-semibold text-white">Customer description</h2>
          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">{ticket.description}</p>
        </article>
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
