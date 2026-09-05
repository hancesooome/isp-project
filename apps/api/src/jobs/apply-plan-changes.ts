import { supabase } from '../lib/supabase.js'

export interface ApplyPlanChangesResult {
  appliedCount: number
  rejectedCount: number
}

export async function applyScheduledPlanChanges(
  now = new Date(),
): Promise<ApplyPlanChangesResult> {
  const { data, error } = await supabase
    .rpc('apply_scheduled_plan_changes', { p_now: now.toISOString() })
    .single<{ applied_count: number; rejected_count: number }>()

  if (error || !data) {
    console.error('Failed to apply scheduled plan changes', { code: error?.code })
    throw new Error('APPLY_SCHEDULED_PLAN_CHANGES_FAILED')
  }

  return {
    appliedCount: data.applied_count,
    rejectedCount: data.rejected_count,
  }
}
