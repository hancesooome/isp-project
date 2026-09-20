import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import { BrandLogo } from '../../components/ui/BrandLogo'

interface AuthPanelProps {
  backLabel?: string
  backTo?: string
  children: ReactNode
  className?: string
}

export function AuthPanel({ backLabel, backTo, children, className = '' }: AuthPanelProps) {
  return (
    <section className={`w-full max-w-md rounded-[18px] border border-slate-900/8 bg-white p-7 text-slate-950 shadow-[0_18px_50px_rgba(18,25,38,0.1)] sm:p-9 ${className}`}>
      {backTo && backLabel ? (
        <Link className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-slate-600 transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" to={backTo}>
          <ArrowLeft aria-hidden="true" size={16} /> {backLabel}
        </Link>
      ) : null}
      <div className={backTo ? 'mt-5' : ''}>
        <Link aria-label="CONEK ISP home" className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" to="/">
          <BrandLogo className="h-11 w-auto max-w-40" />
        </Link>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  )
}
