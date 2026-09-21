import type { ReactNode } from 'react'

interface AdminPageHeaderProps {
  actions?: ReactNode
  description: string
  eyebrow?: string
  title: string
}

export function AdminPageHeader({ actions, description, eyebrow = 'Admin portal', title }: AdminPageHeaderProps) {
  return (
    <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div className="min-w-0 max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.16em] text-blue-400 uppercase">{eyebrow}</p>
        <h1 className="mt-2 break-words text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400 sm:text-base">{description}</p>
      </div>
      {actions ? <div className="w-full shrink-0 lg:w-auto">{actions}</div> : null}
    </header>
  )
}
