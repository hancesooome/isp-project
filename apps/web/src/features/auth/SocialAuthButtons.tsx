import { useState } from 'react'

import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import {
  loginWithSocialProvider,
  type SocialProvider,
} from './social-login'

interface SocialAuthButtonsProps {
  disabled?: boolean
  redirectTo: string
}

const providers: Array<{ label: string; provider: SocialProvider }> = [
  { label: 'Continue with Google', provider: 'google' },
  { label: 'Continue with Facebook', provider: 'facebook' },
]

export function SocialAuthButtons({
  disabled = false,
  redirectTo,
}: SocialAuthButtonsProps) {
  const [activeProvider, setActiveProvider] = useState<SocialProvider | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function continueWith(provider: SocialProvider) {
    if (disabled || activeProvider) return

    setActiveProvider(provider)
    setError(null)

    try {
      await loginWithSocialProvider(provider, redirectTo)
    } catch {
      setError(`We could not connect to ${provider === 'google' ? 'Google' : 'Facebook'}. Please try again.`)
      setActiveProvider(null)
    }
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {providers.map(({ label, provider }) => (
          <button
            className="flex min-h-12 items-center justify-center gap-2.5 rounded-[10px] border border-slate-900/14 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-900/25 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled || activeProvider !== null}
            key={provider}
            onClick={() => void continueWith(provider)}
            type="button"
          >
            {activeProvider === provider ? (
              <LoadingSpinner size="sm" />
            ) : provider === 'google' ? (
              <GoogleMark />
            ) : (
              <FacebookMark />
            )}
            <span>{activeProvider === provider ? 'Connecting…' : label}</span>
          </button>
        ))}
      </div>
      {error ? (
        <p className="mt-3 rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" height="18" viewBox="0 0 18 18" width="18">
      <path d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.797 2.716v2.258h2.909c1.702-1.567 2.684-3.874 2.684-6.614z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.468-.806 5.956-2.181l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.715H.956v2.332A9 9 0 009 18z" fill="#34A853" />
      <path d="M3.963 10.705A5.41 5.41 0 013.681 9c0-.592.102-1.167.282-1.705V4.963H.956A9 9 0 000 9c0 1.452.347 2.827.956 4.037l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.322 0 2.508.454 3.441 1.346l2.581-2.581C13.464.892 11.426 0 9 0A9 9 0 00.956 4.963l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  )
}

function FacebookMark() {
  return (
    <svg aria-hidden="true" height="18" viewBox="0 0 18 18" width="18">
      <circle cx="9" cy="9" fill="#1877F2" r="9" />
      <path d="M12.5 11.6l.4-2.6h-2.5V7.3c0-.7.4-1.4 1.5-1.4H13V3.7c-.7-.1-1.4-.2-2-.2-2.1 0-3.5 1.3-3.5 3.6V9H5.2v2.6h2.3V18c.5.1 1 .1 1.5.1s1 0 1.5-.1v-6.4h2z" fill="#fff" />
    </svg>
  )
}
