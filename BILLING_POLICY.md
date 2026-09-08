# Billing Policy

## V1 activation-based monthly billing

- Billing begins only after an administrator activates a completed installation.
- A newly activated monthly subscription is billed the full monthly plan price in advance. V1 does not prorate.
- The first billing period begins on the Philippine calendar date of activation.
- Later periods begin on the same calendar day each month. When that day does not exist, the period begins on that month's final day.
- A period ends on the day before the next period begins.
- Payment is due 14 calendar days after the period begins.
- The daily billing job creates every period whose start date has arrived. The invoice uniqueness constraint makes retries safe.
- Legacy subscriptions retain their established calendar-month cycle to avoid duplicate charges during migration.

Annual-plan billing is outside the current automated monthly billing scope.
