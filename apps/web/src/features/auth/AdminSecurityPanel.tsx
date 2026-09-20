import type { ReactNode } from 'react'
import { LogOut } from 'lucide-react'
import { Link } from 'react-router-dom'

import { BrandLogo } from '../../components/ui/BrandLogo'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'

export function AdminSecurityPanel({ children }: { children: ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-lg rounded-[18px] border border-white/10 bg-[#11161f] p-7 text-slate-100 shadow-2xl sm:p-9">
      <Link aria-label="CONEK admin home" className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" to="/admin">
        <BrandLogo className="h-11 w-auto max-w-40" inverse />
      </Link>
      <div className="mt-7">{children}</div>
    </section>
  )
}

export function AdminSecurityLoading({ label }: { label: string }) {
  return <div className="flex items-center justify-center gap-3 text-slate-300" role="status"><LoadingSpinner className="text-blue-400" size="md" /><span>{label}</span></div>
}

export function AdminSecuritySignOut({ onClick }: { onClick: () => void }) {
  return <button className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" onClick={onClick} type="button"><LogOut aria-hidden="true" size={17} /> Sign out</button>
}
