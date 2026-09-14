export type CustomerAccessLevel =
  | 'account_only'
  | 'applicant'
  | 'previous_applicant'
  | 'awaiting_installation'
  | 'active_subscriber'
  | 'past_due_subscriber'
  | 'suspended_subscriber'
  | 'former_subscriber'

export interface CustomerPortalOutletContext {
  customerAccessLevel: CustomerAccessLevel
}

export function getCustomerPrimaryDestination(accessLevel: CustomerAccessLevel): string {
  switch (accessLevel) {
    case 'account_only':
    case 'previous_applicant':
      return '/account/apply'
    case 'applicant':
      return '/account/application'
    case 'awaiting_installation':
      return '/account/installation'
    case 'active_subscriber':
      return '/account'
    case 'past_due_subscriber':
    case 'suspended_subscriber':
      return '/account/invoices'
    case 'former_subscriber':
      return '/account/service-history'
  }
}

export function getCustomerPrimaryActionLabel(accessLevel: CustomerAccessLevel): string {
  switch (accessLevel) {
    case 'account_only': return 'Apply for internet'
    case 'previous_applicant': return 'Apply again'
    case 'applicant': return 'View application'
    case 'awaiting_installation': return 'View installation'
    case 'active_subscriber': return 'View internet service'
    case 'past_due_subscriber':
    case 'suspended_subscriber': return 'Review billing'
    case 'former_subscriber': return 'View service history'
  }
}
