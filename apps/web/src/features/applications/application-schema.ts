import { z } from 'zod'

export const applicationSchema = z.object({
  planId: z.string().uuid('Select an available plan'),
  phone: z
    .string()
    .trim()
    .min(7, 'Enter a valid phone number')
    .max(30, 'Phone number must be 30 characters or fewer')
    .regex(/^[0-9+() -]+$/, 'Enter a valid phone number'),
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
})

export type ApplicationFormValues = z.infer<typeof applicationSchema>
