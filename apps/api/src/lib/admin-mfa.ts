import { supabase } from './supabase.js'

export type AuthenticatorAssuranceLevel = 'aal1' | 'aal2' | null
export type AdminMfaRequirement =
  | 'enrollment_required'
  | 'challenge_required'
  | 'verified'

export interface AdminMfaStatus {
  requirement: AdminMfaRequirement
  currentLevel: AuthenticatorAssuranceLevel
  nextLevel: AuthenticatorAssuranceLevel
  hasVerifiedTotp: boolean
}

export async function getAdminMfaStatus(
  userId: string,
  accessToken: string,
): Promise<AdminMfaStatus> {
  const [factorsResult, assuranceResult] = await Promise.all([
    supabase.auth.admin.mfa.listFactors({ userId }),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(accessToken),
  ])

  if (factorsResult.error || assuranceResult.error) {
    throw new Error('ADMIN_MFA_STATUS_FAILED')
  }

  const hasVerifiedTotp = factorsResult.data.factors.some(
    (factor) => factor.factor_type === 'totp' && factor.status === 'verified',
  )
  const currentLevel = normalizeAssuranceLevel(assuranceResult.data.currentLevel)
  const nextLevel = normalizeAssuranceLevel(assuranceResult.data.nextLevel)

  return {
    requirement: !hasVerifiedTotp
      ? 'enrollment_required'
      : currentLevel === 'aal2'
        ? 'verified'
        : 'challenge_required',
    currentLevel,
    nextLevel,
    hasVerifiedTotp,
  }
}

export function isAdminMfaVerified(status: AdminMfaStatus): boolean {
  return status.hasVerifiedTotp && status.currentLevel === 'aal2'
}

function normalizeAssuranceLevel(value: string | null): AuthenticatorAssuranceLevel {
  return value === 'aal1' || value === 'aal2' ? value : null
}
