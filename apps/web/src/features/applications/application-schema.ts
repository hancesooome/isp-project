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
  installationAddress: z
    .string()
    .trim()
    .min(5, 'Enter the installation address')
    .max(250, 'Installation address must be 250 characters or fewer'),
})

export type ApplicationFormValues = z.infer<typeof applicationSchema>
