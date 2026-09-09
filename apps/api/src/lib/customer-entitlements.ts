import { supabase } from './supabase.js'

export const customerCapabilities = [
  'overview', 'apply', 'application', 'installation', 'internet', 'billing',
  'invoices', 'statements', 'payments', 'planChanges', 'cancellation',
  'serviceHistory', 'support', 'account',
] as const

export type CustomerCapability = (typeof customerCapabilities)[number]
export type CustomerAccessLevel = 'account_only' | 'applicant' | 'previous_applicant' |
  'awaiting_installation' | 'active_subscriber' | 'past_due_subscriber' |
  'suspended_subscriber' | 'former_subscriber'

interface LifecycleState {
  applicationStatus: 'pending' | 'approved' | 'rejected' | null
  subscriptionStatus: 'pending_activation' | 'active' | 'past_due' | 'suspended' | 'canceled' | null
}

export interface CustomerEntitlements {
  accessLevel: CustomerAccessLevel
  capabilities: CustomerCapability[]
}

const base = ['overview', 'support', 'account'] as const
const historical = [...base, 'billing', 'invoices', 'statements', 'payments', 'serviceHistory'] as const
const policy: Record<CustomerAccessLevel, readonly CustomerCapability[]> = {
  account_only: [...base, 'apply'],
  applicant: [...base, 'application'],
  previous_applicant: [...base, 'application', 'apply'],
  awaiting_installation: [...base, 'application', 'installation'],
  active_subscriber: [...historical, 'installation', 'internet', 'planChanges', 'cancellation'],
  past_due_subscriber: [...historical, 'installation', 'internet', 'cancellation'],
  suspended_subscriber: [...historical, 'cancellation'],
  former_subscriber: historical,
}

export function resolveCustomerEntitlements(state: LifecycleState): CustomerEntitlements {
  const accessLevel = resolveAccessLevel(state)
  return { accessLevel, capabilities: [...policy[accessLevel]] }
}

export async function loadCustomerEntitlements(userId: string): Promise<CustomerEntitlements> {
  const [subscriptionResult, applicationResult] = await Promise.all([
    supabase.from('subscriptions').select('status').eq('user_id', userId)
      .in('status', ['pending_activation', 'active', 'past_due', 'suspended', 'canceled'])
      .order('started_at', { ascending: false }).limit(1).maybeSingle<{ status: LifecycleState['subscriptionStatus'] }>(),
    supabase.from('applications').select('status').eq('user_id', userId)
      .order('submitted_at', { ascending: false }).limit(1).maybeSingle<{ status: LifecycleState['applicationStatus'] }>(),
  ])

  if (subscriptionResult.error || applicationResult.error) throw new Error('CUSTOMER_ENTITLEMENTS_LOOKUP_FAILED')
  return resolveCustomerEntitlements({
    subscriptionStatus: subscriptionResult.data?.status ?? null,
    applicationStatus: applicationResult.data?.status ?? null,
  })
}

export async function customerHasCapability(userId: string, capability: CustomerCapability): Promise<boolean> {
  const entitlements = await loadCustomerEntitlements(userId)
  return entitlements.capabilities.includes(capability)
}

function resolveAccessLevel(state: LifecycleState): CustomerAccessLevel {
  switch (state.subscriptionStatus) {
    case 'pending_activation': return 'awaiting_installation'
    case 'active': return 'active_subscriber'
    case 'past_due': return 'past_due_subscriber'
    case 'suspended': return 'suspended_subscriber'
    case 'canceled': return 'former_subscriber'
    case null: break
  }
  switch (state.applicationStatus) {
    case 'approved': return 'awaiting_installation'
    case 'pending': return 'applicant'
    case 'rejected': return 'previous_applicant'
    case null: return 'account_only'
  }
}
