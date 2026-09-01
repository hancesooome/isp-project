import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../auth/auth-context'

interface AdminCustomerSummary {
  id: string
  full_name: string | null
  customer_profile: { phone: string | null } | null
}

interface CustomerApplication {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  installation_address: string
  submitted_at: string
  reviewed_at: string | null
  plan: { name: string } | null
}

interface CustomerSubscription {
  id: string
  status: 'active' | 'past_due' | 'canceled'
  started_at: string
  ended_at: string | null
  plan: {
    name: string
    price_cents: number
    billing_interval: 'monthly' | 'yearly'
  } | null
}

interface AdminCustomerDetail {
  id: string
  full_name: string | null
  email: string | null
  customer_profile: {
    phone: string | null
    address: string | null
    installation_address: string | null
  } | null
  applications: CustomerApplication[]
  subscriptions: CustomerSubscription[]
  billing: {
    total_invoices: number
    open_invoices: number
    overdue_invoices: number
    outstanding_cents: number
    next_due_date: string | null
  }
}

const dateFormatter = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' })
const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
})

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}

function isCustomerSummary(value: unknown): value is AdminCustomerSummary {
  if (typeof value !== 'object' || value === null) return false

  const customer = value as Record<string, unknown>
  const profile = customer.customer_profile

  return (
    typeof customer.id === 'string' &&
    isNullableString(customer.full_name) &&
    (profile === null ||
      (typeof profile === 'object' &&
        'phone' in profile &&
        isNullableString(profile.phone)))
  )
}

function isApplication(value: unknown): value is CustomerApplication {
  if (typeof value !== 'object' || value === null) return false

  const application = value as Record<string, unknown>
  const plan = application.plan

  return (
    typeof application.id === 'string' &&
    (application.status === 'pending' ||
      application.status === 'approved' ||
      application.status === 'rejected') &&
    typeof application.installation_address === 'string' &&
    typeof application.submitted_at === 'string' &&
    isNullableString(application.reviewed_at) &&
    (plan === null ||
      (typeof plan === 'object' &&
        'name' in plan &&
        typeof plan.name === 'string'))
  )
}

function isSubscription(value: unknown): value is CustomerSubscription {
  if (typeof value !== 'object' || value === null) return false

  const subscription = value as Record<string, unknown>
  const plan = subscription.plan

  return (
    typeof subscription.id === 'string' &&
    (subscription.status === 'active' ||
      subscription.status === 'past_due' ||
      subscription.status === 'canceled') &&
    typeof subscription.started_at === 'string' &&
    isNullableString(subscription.ended_at) &&
    (plan === null ||
      (typeof plan === 'object' &&
        'name' in plan &&
        typeof plan.name === 'string' &&
        'price_cents' in plan &&
        typeof plan.price_cents === 'number' &&
        'billing_interval' in plan &&
        (plan.billing_interval === 'monthly' ||
          plan.billing_interval === 'yearly')))
  )
}

function isCustomerDetail(value: unknown): value is AdminCustomerDetail {
  if (!isCustomerSummary(value)) return false

  const customer = value as unknown as Record<string, unknown>
  const profile = customer.customer_profile
  const billing = customer.billing

  return (
    isNullableString(customer.email) &&
    (profile === null ||
      (typeof profile === 'object' &&
        'phone' in profile &&
        isNullableString(profile.phone) &&
        'address' in profile &&
        isNullableString(profile.address) &&
        'installation_address' in profile &&
        isNullableString(profile.installation_address))) &&
    Array.isArray(customer.applications) &&
    customer.applications.every(isApplication) &&
    Array.isArray(customer.subscriptions) &&
    customer.subscriptions.every(isSubscription) &&
    typeof billing === 'object' &&
    billing !== null &&
    'total_invoices' in billing &&
    typeof billing.total_invoices === 'number' &&
    'open_invoices' in billing &&
    typeof billing.open_invoices === 'number' &&
    'overdue_invoices' in billing &&
    typeof billing.overdue_invoices === 'number' &&
    'outstanding_cents' in billing &&
    typeof billing.outstanding_cents === 'number' &&
    'next_due_date' in billing &&
    isNullableString(billing.next_due_date)
  )
}

export function AdminCustomersPage() {
  const { session } = useAuth()
  const [customers, setCustomers] = useState<AdminCustomerSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return

    const controller = new AbortController()

    async function loadCustomers() {
      try {
        const response = await fetch('/api/admin/customers', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          signal: controller.signal,
        })

        if (!response.ok) throw new Error('ADMIN_CUSTOMERS_REQUEST_FAILED')

        const result: unknown = await response.json()
        if (
          typeof result !== 'object' ||
          result === null ||
          !('customers' in result) ||
          !Array.isArray(result.customers) ||
          !result.customers.every(isCustomerSummary)
        ) {
          throw new Error('INVALID_ADMIN_CUSTOMERS_RESPONSE')
        }

        setCustomers(result.customers)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return
        setError('We could not load customers. Please try again later.')
      }
    }

    void loadCustomers()
    return () => controller.abort()
  }, [session])

  return (
    <section className="w-full max-w-6xl">
      <PageHeader
        description="View customer contact and account information."
        title="Customers"
      />

      <div className="mt-7">
        {error ? (
          <ErrorPanel message={error} title="Customers unavailable" />
        ) : customers === null ? (
          <PageSkeleton count={4} type="list" />
        ) : customers.length === 0 ? (
          <EmptyState
            description="Customer accounts will appear here after signup."
            title="No customers found"
          />
        ) : (
          <div className="overflow-hidden rounded-[12px] border border-white/8 bg-[#11161f]">
            <div className="hidden grid-cols-[1.4fr_1fr_auto] gap-4 border-b border-white/8 px-5 py-3 text-[10px] font-semibold tracking-[0.12em] text-slate-500 uppercase sm:grid">
              <span>Customer</span><span>Phone</span><span>Account</span>
            </div>
            <ul className="divide-y divide-white/8" role="list">
              {customers.map((customer) => (
                <li className="grid gap-3 px-5 py-4 sm:grid-cols-[1.4fr_1fr_auto] sm:items-center" key={customer.id}>
                  <div>
                    <p className="font-semibold text-white">{customer.full_name ?? 'Name unavailable'}</p>
                    <p className="mt-1 text-xs text-slate-500">Customer account</p>
                  </div>
                  <p className="text-sm text-slate-300">{customer.customer_profile?.phone ?? 'Not provided'}</p>
                  <Link
                    className="text-sm font-semibold text-blue-300 hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    to={`/admin/customers/${encodeURIComponent(customer.id)}`}
                  >
                    View details →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

export function AdminCustomerDetailsPage({ customerId }: { customerId: string }) {
  const { session } = useAuth()
  const [customer, setCustomer] = useState<AdminCustomerDetail | null>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return

    const controller = new AbortController()

    async function loadCustomer() {
      try {
        const response = await fetch(
          `/api/admin/customers/${encodeURIComponent(customerId)}`,
          {
            headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
            signal: controller.signal,
          },
        )

        if (response.status === 404) {
          setCustomer(null)
          return
        }
        if (!response.ok) throw new Error('ADMIN_CUSTOMER_REQUEST_FAILED')

        const result: unknown = await response.json()
        if (
          typeof result !== 'object' ||
          result === null ||
          !('customer' in result) ||
          !isCustomerDetail(result.customer)
        ) {
          throw new Error('INVALID_ADMIN_CUSTOMER_RESPONSE')
        }

        setCustomer(result.customer)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return
        setError('We could not load this customer. Please try again later.')
      }
    }

    void loadCustomer()
    return () => controller.abort()
  }, [customerId, session])

  if (error) return <ErrorPanel message={error} title="Customer unavailable" />
  if (customer === undefined) return <PageSkeleton type="detail" />
  if (customer === null) {
    return <EmptyState description="This customer account does not exist." title="Customer not found" />
  }

  return (
    <section className="w-full max-w-6xl">
      <Link className="text-sm font-semibold text-blue-300 hover:text-blue-200" to="/admin/customers">← Back to customers</Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          description={customer.email ?? 'No email address available'}
          title={customer.full_name ?? 'Unnamed customer'}
        />
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-5">
          <section className="rounded-[12px] border border-white/8 bg-[#11161f] p-5" aria-labelledby="contact-heading">
            <h2 className="text-sm font-semibold text-white" id="contact-heading">Contact information</h2>
            <dl className="mt-5 grid gap-4 text-sm">
              <Detail label="Email" value={customer.email} />
              <Detail label="Phone" value={customer.customer_profile?.phone} />
              <Detail label="Address" value={customer.customer_profile?.address} />
              <Detail label="Installation address" value={customer.customer_profile?.installation_address} />
            </dl>
          </section>

          <section className="rounded-[12px] border border-white/8 bg-[#11161f] p-5" aria-labelledby="billing-heading">
            <h2 className="text-sm font-semibold text-white" id="billing-heading">Billing summary</h2>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <Detail label="Outstanding" value={currencyFormatter.format(customer.billing.outstanding_cents / 100)} />
              <Detail label="Total invoices" value={String(customer.billing.total_invoices)} />
              <Detail label="Open" value={String(customer.billing.open_invoices)} />
              <Detail label="Overdue" value={String(customer.billing.overdue_invoices)} />
              <Detail label="Next due date" value={formatDatabaseDate(customer.billing.next_due_date)} />
            </dl>
          </section>
        </div>

        <div className="space-y-5">
          <AccountSection title="Subscriptions">
            {customer.subscriptions.length === 0 ? (
              <p className="text-sm text-slate-500">No subscriptions found.</p>
            ) : (
              <ul className="divide-y divide-white/8" role="list">
                {customer.subscriptions.map((subscription) => (
                  <li className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0" key={subscription.id}>
                    <div>
                      <p className="font-semibold text-white">{subscription.plan?.name ?? 'Plan unavailable'}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Started {dateFormatter.format(new Date(subscription.started_at))}
                        {subscription.plan ? ` · ${currencyFormatter.format(subscription.plan.price_cents / 100)} ${subscription.plan.billing_interval}` : ''}
                      </p>
                    </div>
                    <StatusBadge status={subscription.status} />
                  </li>
                ))}
              </ul>
            )}
          </AccountSection>

          <AccountSection title="Applications">
            {customer.applications.length === 0 ? (
              <p className="text-sm text-slate-500">No service applications found.</p>
            ) : (
              <ul className="divide-y divide-white/8" role="list">
                {customer.applications.map((application) => (
                  <li className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0" key={application.id}>
                    <div>
                      <Link className="font-semibold text-white hover:text-blue-200" to={`/admin/applications/${encodeURIComponent(application.id)}`}>
                        {application.plan?.name ?? 'Plan unavailable'}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">Submitted {dateFormatter.format(new Date(application.submitted_at))}</p>
                    </div>
                    <StatusBadge status={application.status} />
                  </li>
                ))}
              </ul>
            )}
          </AccountSection>
        </div>
      </div>
    </section>
  )
}

function PageHeader({ description, title }: { description: string; title: string }) {
  return (
    <header>
      <p className="text-xs font-semibold tracking-[0.18em] text-blue-400 uppercase">Admin portal</p>
      <h1 className="mt-2 text-3xl font-bold tracking-[-0.02em] text-white">{title}</h1>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </header>
  )
}

function AccountSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-[12px] border border-white/8 bg-[#11161f] p-5">
      <h2 className="mb-5 text-sm font-semibold text-white">{title}</h2>
      {children}
    </section>
  )
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 break-words font-medium text-slate-200">{value ?? 'Not provided'}</dd>
    </div>
  )
}

function formatDatabaseDate(value: string | null): string {
  return value ? dateFormatter.format(new Date(`${value}T00:00:00`)) : 'None'
}
