import type { ReactNode, Ref } from 'react'

interface CustomerPageHeaderProps {
  actions?: ReactNode
  description: string
  eyebrow?: string
  title: string
  titleRef?: Ref<HTMLHeadingElement>
  titleTabIndex?: number
}

export function CustomerPageHeader({ actions, description, eyebrow, title, titleRef, titleTabIndex }: CustomerPageHeaderProps) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? <p className="text-xs font-semibold tracking-[0.12em] text-blue-700 uppercase">{eyebrow}</p> : null}
        <h1 className={`${eyebrow ? 'mt-2' : ''} scroll-mt-24 text-3xl font-semibold tracking-[-0.035em] text-slate-950 outline-none sm:text-4xl`} ref={titleRef} tabIndex={titleTabIndex}>{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">{description}</p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  )
}
