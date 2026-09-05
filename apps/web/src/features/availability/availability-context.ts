export interface AvailabilityContext {
  regionCode: string
  provinceCode: string
  cityMunicipalityCode: string
  barangayCode: string
  streetAddress: string
  postalCode: string
  landmark: string
  latitude: number
  longitude: number
  eligiblePlanIds: string[]
}

const storageKey = 'isp-verified-availability'

export function saveAvailabilityContext(value: AvailabilityContext) {
  sessionStorage.setItem(storageKey, JSON.stringify(value))
}

export function loadAvailabilityContext(): AvailabilityContext | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null')
    if (typeof value !== 'object' || value === null) return null
    const context = value as Record<string, unknown>
    if (
      typeof context.regionCode !== 'string' || typeof context.provinceCode !== 'string' ||
      typeof context.cityMunicipalityCode !== 'string' || typeof context.barangayCode !== 'string' ||
      typeof context.streetAddress !== 'string' || typeof context.postalCode !== 'string' ||
      typeof context.landmark !== 'string' || typeof context.latitude !== 'number' ||
      !Number.isFinite(context.latitude) || typeof context.longitude !== 'number' ||
      !Number.isFinite(context.longitude) || !Array.isArray(context.eligiblePlanIds) ||
      !context.eligiblePlanIds.every((id) => typeof id === 'string')
    ) return null
    return context as unknown as AvailabilityContext
  } catch {
    return null
  }
}
