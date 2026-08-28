import { beforeEach, describe, expect, it, vi } from 'vitest'
import { signUpCustomer } from './signup'

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: mocks.signUp,
    },
  },
}))

describe('signUpCustomer', () => {
  beforeEach(() => {
    mocks.signUp.mockReset()
  })

  it('sends full_name without accepting a role', async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null, user: { id: 'user-id' } },
      error: null,
    })

    const result = await signUpCustomer({
      email: 'customer@example.com',
      fullName: 'Customer Name',
      password: 'secure-password',
      redirectTo: 'http://localhost:5173',
    })

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: 'customer@example.com',
      password: 'secure-password',
      options: {
        data: { full_name: 'Customer Name' },
        emailRedirectTo: 'http://localhost:5173',
      },
    })
    expect(result).toEqual({ requiresEmailConfirmation: true })
  })

  it('does not expose Supabase errors to callers', async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: new Error('internal provider details'),
    })

    await expect(
      signUpCustomer({
        email: 'customer@example.com',
        fullName: 'Customer Name',
        password: 'secure-password',
        redirectTo: 'http://localhost:5173',
      }),
    ).rejects.toThrow('SIGNUP_FAILED')
  })
})
