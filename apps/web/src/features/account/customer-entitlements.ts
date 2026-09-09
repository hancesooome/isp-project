export const customerCapabilities = [
  'overview',
  'apply',
  'application',
  'installation',
  'internet',
  'billing',
  'invoices',
  'statements',
  'payments',
  'planChanges',
  'cancellation',
  'serviceHistory',
  'support',
  'account',
] as const

export type CustomerCapability = (typeof customerCapabilities)[number]

export type CustomerAccessLevel =
  | 'account_only'
  | 'applicant'
  | 'previous_applicant'
  | 'awaiting_installation'
  | 'active_subscriber'
  | 'past_due_subscriber'
  | 'suspended_subscriber'
  | 'former_subscriber'

export type CustomerApplicationStatus = 'pending' | 'approved' | 'rejected'

export type CustomerSubscriptionStatus =
  | 'pending_activation'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'canceled'

export interface CustomerLifecycleState {
  applicationStatus: CustomerApplicationStatus | null
  subscriptionStatus: CustomerSubscriptionStatus | null
}

export interface CustomerEntitlements {
  accessLevel: CustomerAccessLevel
  capabilities: ReadonlySet<CustomerCapability>
}

const baseCapabilities = ['overview', 'support', 'account'] as const
const applicationCapabilities = [...baseCapabilities, 'application'] as const
const historicalCapabilities = [
  ...baseCapabilities,
  'billing',
  'invoices',
  'statements',
  'payments',
  'serviceHistory',
] as const
const fullSubscriberCapabilities = [
  ...historicalCapabilities,
  'installation',
  'internet',
  'planChanges',
  'cancellation',
] as const

const capabilitiesByAccessLevel: Record<
  CustomerAccessLevel,
  readonly CustomerCapability[]
> = {
  account_only: [...baseCapabilities, 'apply'],
  applicant: applicationCapabilities,
  previous_applicant: [...applicationCapabilities, 'apply'],
  awaiting_installation: [...applicationCapabilities, 'installation'],
  active_subscriber: fullSubscriberCapabilities,
  past_due_subscriber: [
    ...historicalCapabilities,
    'installation',
    'internet',
    'cancellation',
  ],
  suspended_subscriber: [...historicalCapabilities, 'cancellation'],
  former_subscriber: historicalCapabilities,
}

/**
 * Resolves portal access from authoritative lifecycle facts.
 *
 * Subscription state takes precedence over application state. Unknown runtime
 * values fail closed to account-only access instead of granting subscriber
 * capabilities. Route filtering is implemented in ISP-140; API enforcement is
 * implemented separately in ISP-141.
 */
export function resolveCustomerEntitlements(
  lifecycle: CustomerLifecycleState,
): CustomerEntitlements {
  const accessLevel = resolveAccessLevel(lifecycle)

  return {
    accessLevel,
    capabilities: new Set(capabilitiesByAccessLevel[accessLevel]),
  }
}

export function hasCustomerCapability(
  entitlements: CustomerEntitlements,
  capability: CustomerCapability,
): boolean {
  return entitlements.capabilities.has(capability)
}

function resolveAccessLevel({
  applicationStatus,
  subscriptionStatus,
}: CustomerLifecycleState): CustomerAccessLevel {
  switch (subscriptionStatus as unknown) {
    case 'pending_activation':
      return 'awaiting_installation'
    case 'active':
      return 'active_subscriber'
    case 'past_due':
      return 'past_due_subscriber'
    case 'suspended':
      return 'suspended_subscriber'
    case 'canceled':
      return 'former_subscriber'
    case null:
      break
    default:
      return 'account_only'
  }

  switch (applicationStatus as unknown) {
    case 'approved':
      return 'awaiting_installation'
    case 'pending':
      return 'applicant'
    case 'rejected':
      return 'previous_applicant'
    case null:
    default:
      return 'account_only'
  }
}
