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
  installationRegion: z
    .string()
    .trim()
    .min(2, 'Enter the region')
    .max(100, 'Region must be 100 characters or fewer'),
  installationProvince: z
    .string()
    .trim()
    .min(2, 'Enter the province')
    .max(100, 'Province must be 100 characters or fewer'),
  installationCityMunicipality: z
    .string()
    .trim()
    .min(2, 'Enter the city or municipality')
    .max(100, 'City or municipality must be 100 characters or fewer'),
  installationBarangay: z
    .string()
    .trim()
    .min(2, 'Enter the barangay')
    .max(100, 'Barangay must be 100 characters or fewer'),
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
