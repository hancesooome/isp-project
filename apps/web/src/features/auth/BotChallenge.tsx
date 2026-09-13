import { useState } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY

interface BotChallengeProps {
  action: 'forgot_password' | 'login' | 'signup'
  error?: string | null
  onError: (message: string) => void
  onToken: (token: string | null) => void
  resetKey: number
}

export function BotChallenge({
  action,
  error,
  onError,
  onToken,
  resetKey,
}: BotChallengeProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'verified'>('loading')

  if (!turnstileSiteKey) {
    return (
      <p className="rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
        Security verification is unavailable. Please contact support.
      </p>
    )
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-700">Security verification</p>
      <div className="min-h-[65px] w-full overflow-hidden rounded-[10px] border border-slate-900/10 bg-slate-50 p-1">
        <Turnstile
          key={resetKey}
          onError={() => {
            setStatus('ready')
            onToken(null)
            onError('Security verification failed. Please try again.')
          }}
          onExpire={() => {
            setStatus('ready')
            onToken(null)
            onError('Security verification expired. Please complete it again.')
          }}
          onSuccess={(token) => {
            setStatus('verified')
            onError('')
            onToken(token)
          }}
          onTimeout={() => {
            setStatus('ready')
            onToken(null)
            onError('Security verification timed out. Please try again.')
          }}
          onUnsupported={() => {
            setStatus('ready')
            onToken(null)
            onError('This browser cannot run security verification. Please use a supported browser.')
          }}
          options={{
            action,
            appearance: 'always',
            refreshExpired: 'auto',
            refreshTimeout: 'auto',
            retry: 'auto',
            size: 'flexible',
            theme: 'light',
          }}
          siteKey={turnstileSiteKey}
          onWidgetLoad={() => setStatus('ready')}
        />
      </div>
      {error ? (
        <p className="mt-1.5 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-slate-500" role="status">
          {status === 'loading'
            ? 'Loading security verification…'
            : status === 'verified'
              ? 'Security verification complete.'
              : 'Complete the check before continuing.'}
        </p>
      )}
    </div>
  )
}
