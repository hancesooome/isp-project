export interface PlanChangeHistoryItem {
  id: string
  change_type: 'upgrade' | 'downgrade'
  status: 'pending' | 'approved' | 'rejected' | 'canceled' | 'scheduled' | 'applied'
  reason: string | null
  requested_at: string
  effective_at: string | null
  review_notes: string | null
  current_plan: { id: string; name: string } | null
  requested_plan: { id: string; name: string } | null
}

export interface AdminPlanChangeHistoryItem extends PlanChangeHistoryItem {
  customer: { id: string; full_name: string | null } | null
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}

function isPlan(value: unknown): value is { id: string; name: string } | null {
  return value === null || (typeof value === 'object' && value !== null &&
    'id' in value && typeof value.id === 'string' && 'name' in value && typeof value.name === 'string')
}

export function isPlanChangeHistoryItem(value: unknown): value is PlanChangeHistoryItem {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' &&
    (item.change_type === 'upgrade' || item.change_type === 'downgrade') &&
    ['pending', 'approved', 'rejected', 'canceled', 'scheduled', 'applied'].includes(String(item.status)) &&
    isNullableString(item.reason) && typeof item.requested_at === 'string' &&
    isNullableString(item.effective_at) && isNullableString(item.review_notes) &&
    isPlan(item.current_plan) && isPlan(item.requested_plan)
}

export function isAdminPlanChangeHistoryItem(value: unknown): value is AdminPlanChangeHistoryItem {
  if (!isPlanChangeHistoryItem(value)) return false
  const customer = (value as unknown as Record<string, unknown>).customer
  return customer === null || (typeof customer === 'object' && 'id' in customer &&
    typeof customer.id === 'string' && 'full_name' in customer &&
    (typeof customer.full_name === 'string' || customer.full_name === null))
}
