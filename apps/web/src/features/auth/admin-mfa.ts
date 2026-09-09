export type AdminMfaRequirement =
  | 'enrollment_required'
  | 'challenge_required'
  | 'verified'

export interface AdminMfaStatus {
  requirement: AdminMfaRequirement
  currentLevel: 'aal1' | 'aal2' | null
  nextLevel: 'aal1' | 'aal2' | null
  hasVerifiedTotp: boolean
}

export async function fetchAdminMfaStatus(
  accessToken: string,
  signal?: AbortSignal,
): Promise<AdminMfaStatus> {
  const response = await fetch('/api/admin/mfa-status', {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
  })
  const result: unknown = await response.json()

  if (!response.ok || !isAdminMfaResponse(result)) {
    throw new Error('ADMIN_MFA_STATUS_FAILED')
  }

  return result.mfa
}

function isAdminMfaResponse(value: unknown): value is { mfa: AdminMfaStatus } {
  if (!value || typeof value !== 'object' || !('mfa' in value)) return false
  const mfa = value.mfa
  if (!mfa || typeof mfa !== 'object') return false
  return 'requirement' in mfa &&
    (mfa.requirement === 'enrollment_required' || mfa.requirement === 'challenge_required' || mfa.requirement === 'verified') &&
    'currentLevel' in mfa && (mfa.currentLevel === null || mfa.currentLevel === 'aal1' || mfa.currentLevel === 'aal2') &&
    'nextLevel' in mfa && (mfa.nextLevel === null || mfa.nextLevel === 'aal1' || mfa.nextLevel === 'aal2') &&
    'hasVerifiedTotp' in mfa && typeof mfa.hasVerifiedTotp === 'boolean'
}
