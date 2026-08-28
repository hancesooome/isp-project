import { describe, expect, it } from 'vitest'
import { signupSchema } from './signup-schema'

const validSignup = {
  fullName: 'Customer Name',
  email: 'customer@example.com',
  password: 'secure-password',
  confirmPassword: 'secure-password',
}

describe('signupSchema', () => {
  it('accepts and trims valid customer details', () => {
    const result = signupSchema.parse({
      ...validSignup,
      fullName: '  Customer Name  ',
      email: '  customer@example.com  ',
    })

    expect(result.fullName).toBe('Customer Name')
    expect(result.email).toBe('customer@example.com')
  })

  it('rejects an invalid email address', () => {
    const result = signupSchema.safeParse({
      ...validSignup,
      email: 'not-an-email',
    })

    expect(result.success).toBe(false)
  })

  it('rejects a short password', () => {
    const result = signupSchema.safeParse({
      ...validSignup,
      password: 'short',
      confirmPassword: 'short',
    })

    expect(result.success).toBe(false)
  })

  it('rejects mismatched passwords', () => {
    const result = signupSchema.safeParse({
      ...validSignup,
      confirmPassword: 'different-password',
    })

    expect(result.success).toBe(false)
  })
})
