import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { PASSWORD_MIN_LENGTH } from './password-policy'

interface PasswordFieldProps {
  error?: string
  helpText?: string
  id: string
  label: string
  onChange: (value: string) => void
  value: string
}

export function PasswordField({
  error,
  helpText,
  id,
  label,
  onChange,
  value,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false)
  const errorId = `${id}-error`
  const helpId = `${id}-help`

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          aria-describedby={error ? errorId : helpText ? helpId : undefined}
          aria-invalid={error ? true : undefined}
          autoComplete="new-password"
          className="min-h-12 w-full rounded-[10px] border border-slate-900/14 bg-white px-3.5 py-2.5 pr-12 text-slate-950 shadow-inner shadow-slate-950/3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          id={id}
          minLength={PASSWORD_MIN_LENGTH}
          name={id}
          onChange={(event) => onChange(event.target.value)}
          type={isVisible ? 'text' : 'password'}
          value={value}
        />
        <button
          aria-label={isVisible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={isVisible}
          className="absolute inset-y-0 right-0 grid min-w-12 place-items-center rounded-r-[10px] text-slate-500 transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
          onClick={() => setIsVisible((current) => !current)}
          type="button"
        >
          {isVisible ? <EyeOff aria-hidden="true" size={19} /> : <Eye aria-hidden="true" size={19} />}
        </button>
      </div>
      {helpText && !error ? (
        <p className="mt-1.5 text-sm text-slate-500" id={helpId}>
          {helpText}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1.5 text-sm text-red-700" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
