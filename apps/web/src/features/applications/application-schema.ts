import { z } from 'zod'

export function normalizePhilippineMobile(value: string): string | null {
  const compact = value.trim().replace(/[\s()-]/g, '')

  if (/^09\d{9}$/.test(compact)) return `+63${compact.slice(1)}`
  if (/^\+639\d{9}$/.test(compact)) return compact
  return null
}

export const philippineMobileSchema = z.string().max(
  30,
  'Enter a Philippine mobile number like 0917 123 4567',
).transform((value, context) => {
  const normalized = normalizePhilippineMobile(value)
  if (!normalized) {
    context.addIssue({
      code: 'custom',
      message: 'Enter a Philippine mobile number like 0917 123 4567',
    })
    return z.NEVER
  }

  return normalized
})

export const applicationSchema = z.object({
  planId: z.string().uuid('Select an available plan'),
  phone: philippineMobileSchema,
  address: z
    .string()
    .trim()
    .min(5, 'Enter your current address')
    .max(250, 'Address must be 250 characters or fewer'),
  installationRegionCode: z.string().regex(/^[0-9]{10}$/, 'Select a region'),
  installationProvinceCode: z.string().refine(
    (value) => value === '' || /^[0-9]{10}$/.test(value),
    'Select a province',
  ),
  installationCityMunicipalityCode: z
    .string()
    .regex(/^[0-9]{10}$/, 'Select a city or municipality'),
  installationBarangayCode: z
    .string()
    .regex(/^[0-9]{10}$/, 'Select a barangay'),
  installationStreetAddress: z
    .string()
    .trim()
    .min(3, 'Enter the street, house, building, or unit')
    .max(250, 'Street address must be 250 characters or fewer'),
  installationPostalCode: z
    .string()
    .trim()
    .regex(/^[0-9]{4}$/, 'Enter a valid 4-digit postal code'),
  installationLandmark: z
    .string()
    .trim()
    .max(250, 'Landmark must be 250 characters or fewer'),
  installationLatitude: z.number().min(-90).max(90).nullable(),
  installationLongitude: z.number().min(-180).max(180).nullable(),
}).superRefine((values, context) => {
  if (values.installationLatitude === null || values.installationLongitude === null) {
    context.addIssue({
      code: 'custom',
      message: 'Confirm the requested installation point on the map',
      path: ['installationLatitude'],
    })
  }
})

export type ApplicationFormValues = z.infer<typeof applicationSchema>
