import type { ReactNode } from 'react'

interface PublicPageHeaderProps {
  align?: 'left' | 'center'
  children?: ReactNode
  description: string
  eyebrow: string
  title: string
}

export function PublicPageHeader({
  align = 'left',
  children,
  description,
  eyebrow,
  title,
}: PublicPageHeaderProps) {
  const centered = align === 'center'

  return (
    <header className={centered ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">{eyebrow}</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">{title}</h1>
      <p className={`mt-4 text-base leading-7 text-slate-600 sm:text-lg ${centered ? 'mx-auto max-w-2xl' : ''}`}>
        {description}
      </p>
      {children}
    </header>
  )
}
