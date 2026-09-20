import type { InputHTMLAttributes } from 'react'

interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  error?: string
  helpText?: string
  label: string
}

export function AuthField({ error, helpText, id, label, ...inputProps }: AuthFieldProps) {
  if (!id) throw new Error('AuthField requires an id')
  const errorId = `${id}-error`
  const helpId = `${id}-help`

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor={id}>{label}</label>
      <input
        aria-describedby={error ? errorId : helpText ? helpId : undefined}
        aria-invalid={error ? true : undefined}
        className="min-h-12 w-full rounded-[10px] border border-slate-900/14 bg-white px-3.5 py-2.5 text-slate-950 shadow-inner shadow-slate-950/3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
        id={id}
        {...inputProps}
      />
      {helpText && !error ? <p className="mt-1.5 text-sm text-slate-500" id={helpId}>{helpText}</p> : null}
      {error ? <p className="mt-1.5 text-sm text-red-700" id={errorId} role="alert">{error}</p> : null}
    </div>
  )
}
