import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'

import { useAuth } from '../auth/auth-context'

interface FaqArticle {
  id: string
  category: string
  question: string
  answer: string
  slug: string | null
  sort_order: number
  updated_at: string
}

function isFaqArticle(value: unknown): value is FaqArticle {
  if (typeof value !== 'object' || value === null) return false
  const faq = value as Record<string, unknown>

  return (
    typeof faq.id === 'string' &&
    typeof faq.category === 'string' &&
    typeof faq.question === 'string' &&
    typeof faq.answer === 'string' &&
    (typeof faq.slug === 'string' || faq.slug === null) &&
    typeof faq.sort_order === 'number' &&
    typeof faq.updated_at === 'string'
  )
}

export function FaqPage({ customerView = false }: { customerView?: boolean }) {
  const { session } = useAuth()
  const [faqs, setFaqs] = useState<FaqArticle[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadFaqs() {
      setLoadError(null)
      try {
        const response = await fetch('/api/faqs', { signal: controller.signal })
        if (!response.ok) throw new Error('FAQ_REQUEST_FAILED')

        const result: unknown = await response.json()
        if (
          typeof result !== 'object' ||
          result === null ||
          !('faqs' in result) ||
          !Array.isArray(result.faqs) ||
          !result.faqs.every(isFaqArticle)
        ) {
          throw new Error('INVALID_FAQ_RESPONSE')
        }

        setFaqs(result.faqs)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        setLoadError('We could not load the help articles. Please try again.')
      }
    }

    void loadFaqs()
    return () => controller.abort()
  }, [reloadKey])

  const categories = useMemo(
    () => Array.from(new Set((faqs ?? []).map((faq) => faq.category))),
    [faqs],
  )

  const visibleFaqs = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    return (faqs ?? []).filter(
      (faq) =>
        (!category || faq.category === category) &&
        (!term ||
          faq.question.toLocaleLowerCase().includes(term) ||
          faq.answer.toLocaleLowerCase().includes(term) ||
          faq.category.toLocaleLowerCase().includes(term)),
    )
  }, [category, faqs, search])

  const hasFilters = Boolean(category || search.trim())
  const supportPath = session ? '/account/support' : '/login?redirect=%2Faccount%2Fsupport'

  return (
    <section className={customerView ? 'w-full' : 'mx-auto max-w-5xl'}>
      <header className={customerView ? 'max-w-3xl' : 'mx-auto max-w-3xl text-center'}>
        <p className="text-xs font-semibold tracking-[0.16em] text-blue-600 uppercase">Help center</p>
        <h1 className={`${customerView ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl'} mt-3 font-semibold tracking-[-0.04em] text-slate-950`}>
          How can we help?
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
          Find clear answers about getting connected, managing your plan, billing, payments, and your account.
        </p>
      </header>

      <div className={`${customerView ? '' : 'mx-auto'} mt-8 max-w-3xl`}>
        <label className="block" htmlFor={customerView ? 'customer-faq-search' : 'public-faq-search'}>
          <span className="sr-only">Search help articles</span>
          <span className="relative block">
            <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
            <input
              className="min-h-14 w-full rounded-[12px] border border-slate-900/10 bg-white py-3 pl-12 pr-4 text-base text-slate-950 shadow-[0_8px_24px_rgba(16,24,40,0.05)] outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              id={customerView ? 'customer-faq-search' : 'public-faq-search'}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by question or topic"
              type="search"
              value={search}
            />
          </span>
        </label>
      </div>

      {categories.length > 0 ? (
        <nav aria-label="FAQ categories" className="mt-6 flex flex-wrap gap-2">
          <CategoryButton active={category === null} onClick={() => setCategory(null)}>All topics</CategoryButton>
          {categories.map((item) => (
            <CategoryButton active={category === item} key={item} onClick={() => setCategory(item)}>{item}</CategoryButton>
          ))}
        </nav>
      ) : null}

      <div className="mt-8">
        {loadError ? (
          <div className="rounded-[14px] border border-red-200 bg-red-50 p-6 text-center" role="alert">
            <h2 className="font-semibold text-red-900">Help articles unavailable</h2>
            <p className="mt-2 text-sm text-red-700">{loadError}</p>
            <button className="mt-4 min-h-11 rounded-[10px] border border-red-300 bg-white px-4 text-sm font-semibold text-red-800 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500" onClick={() => setReloadKey((value) => value + 1)} type="button">Try again</button>
          </div>
        ) : faqs === null ? (
          <FaqSkeleton />
        ) : visibleFaqs.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-slate-900/15 bg-white/60 px-6 py-12 text-center">
            <h2 className="text-lg font-semibold text-slate-950">{hasFilters ? 'No matching answers' : 'Help articles are coming soon'}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              {hasFilters ? 'Try another search or view all topics.' : 'There are no published FAQ articles yet.'}
            </p>
            {hasFilters ? <button className="mt-4 min-h-11 rounded-[10px] border border-slate-900/10 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" onClick={() => { setCategory(null); setSearch('') }} type="button">Clear filters</button> : null}
          </div>
        ) : (
          <>
            <p aria-live="polite" className="mb-3 text-sm text-slate-500">
              {visibleFaqs.length} {visibleFaqs.length === 1 ? 'answer' : 'answers'} found
            </p>
            <div className="divide-y divide-slate-900/10 overflow-hidden rounded-[14px] border border-slate-900/10 bg-white shadow-[0_8px_24px_rgba(16,24,40,0.04)]">
              {visibleFaqs.map((faq) => (
                <details className="group" id={faq.slug ?? undefined} key={faq.id}>
                  <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 px-5 py-4 text-left font-semibold text-slate-950 outline-none transition hover:bg-slate-50 focus-visible:bg-blue-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:px-6 [&::-webkit-details-marker]:hidden">
                    <span>
                      <span className="mb-1 block text-xs font-medium text-blue-600">{faq.category}</span>
                      {faq.question}
                    </span>
                    <Plus aria-hidden="true" className="shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-45" size={20} />
                  </summary>
                  <div className="px-5 pb-6 sm:px-6">
                    <p className="max-w-3xl whitespace-pre-wrap border-t border-slate-900/8 pt-4 text-[15px] leading-7 text-slate-600">{faq.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </>
        )}
      </div>

      <footer className="mt-10 flex flex-col gap-4 border-t border-slate-900/10 pt-7 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-950">Still need help?</h2>
          <p className="mt-1 text-sm text-slate-600">Send a support request and track the response from your account.</p>
        </div>
        <Link className="inline-flex min-h-11 w-fit items-center rounded-[10px] bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" to={supportPath}>
          {session ? 'Contact support' : 'Sign in for support'}
        </Link>
      </footer>
    </section>
  )
}

function CategoryButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button aria-pressed={active} className={`min-h-11 rounded-[10px] border px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${active ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-900/10 bg-white text-slate-600 hover:border-slate-900/20 hover:text-slate-950'}`} onClick={onClick} type="button">
      {children}
    </button>
  )
}

function FaqSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading help articles" className="divide-y divide-slate-900/8 overflow-hidden rounded-[14px] border border-slate-900/10 bg-white" role="status">
      <span className="sr-only">Loading help articles…</span>
      {[0, 1, 2, 3].map((item) => (
        <div className="animate-pulse px-6 py-5 motion-reduce:animate-none" key={item}>
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="mt-3 h-5 max-w-lg rounded bg-slate-200" />
        </div>
      ))}
    </div>
  )
}
