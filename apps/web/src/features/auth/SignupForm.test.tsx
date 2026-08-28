import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SignupForm } from './SignupForm'

const mocks = vi.hoisted(() => ({
  signUpCustomer: vi.fn(),
}))

vi.mock('./signup', () => ({
  signUpCustomer: mocks.signUpCustomer,
}))

afterEach(cleanup)

async function completeForm() {
  const user = userEvent.setup()

  await user.type(screen.getByLabelText('Full name'), 'Customer Name')
  await user.type(screen.getByLabelText('Email address'), 'customer@example.com')
  await user.type(screen.getByLabelText('Password'), 'secure-password')
  await user.type(screen.getByLabelText('Confirm password'), 'secure-password')

  return user
}

describe('SignupForm', () => {
  beforeEach(() => {
    mocks.signUpCustomer.mockReset()
  })

  it('shows validation errors without submitting invalid details', async () => {
    render(<SignupForm />)

    fireEvent.submit(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findAllByRole('alert')).not.toHaveLength(0)
    expect(mocks.signUpCustomer).not.toHaveBeenCalled()
  })

  it('submits valid details and shows the email verification message', async () => {
    mocks.signUpCustomer.mockResolvedValue({
      requiresEmailConfirmation: true,
    })
    render(<SignupForm />)
    const user = await completeForm()

    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(
      await screen.findByText(
        'Check your email to verify your account before signing in.',
      ),
    ).toBeTruthy()
    expect(mocks.signUpCustomer).toHaveBeenCalledOnce()
  })

  it('shows a safe message when signup fails', async () => {
    mocks.signUpCustomer.mockRejectedValue(new Error('provider details'))
    render(<SignupForm />)
    const user = await completeForm()

    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(
      await screen.findByText(
        'We could not create your account. Please check your details and try again.',
      ),
    ).toBeTruthy()
  })
})
