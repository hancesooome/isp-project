import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'

import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { useAuth } from '../auth/auth-context'

interface FaqArticle {
  id: string
  category: string
  question: string
  answer: string
  slug: string | null
  sort_order: number
  is_published: boolean
  created_at: string
  updated_at: string
}

interface FaqFormState {
  category: string
  question: string
  answer: string
  slug: string
  sortOrder: string
}

const suggestedCategories = [
  'Getting connected',
  'Installation',
  'Plans',
  'Billing',
  'Payments',
  'Troubleshooting',
  'Router',
  'Plan changes',
  'Account',
]

const emptyForm: FaqFormState = {
  category: '',
  question: '',
  answer: '',
  slug: '',
  sortOrder: '0',
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
    typeof faq.is_published === 'boolean' &&
    typeof faq.created_at === 'string' &&
    typeof faq.updated_at === 'string'
  )
}

function sortFaqs(faqs: FaqArticle[]) {
  return [...faqs].sort(
    (first, second) =>
      first.category.localeCompare(second.category) ||
      first.sort_order - second.sort_order ||
      first.created_at.localeCompare(second.created_at) ||
      first.id.localeCompare(second.id),
  )
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '')
}

async function getResponseError(response: Response, fallback: string) {
  const result: unknown = await response.json().catch(() => null)
  return typeof result === 'object' &&
    result !== null &&
    'error' in result &&
    typeof result.error === 'string'
    ? result.error
    : fallback
}

export function AdminFaqPage() {
  const { session } = useAuth()
  const [faqs, setFaqs] = useState<FaqArticle[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [form, setForm] = useState<FaqFormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [publicationId, setPublicationId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [showDraftPreview, setShowDraftPreview] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all')

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()

    async function loadFaqs() {
      try {
        const response = await fetch('/api/admin/faqs', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          signal: controller.signal,
        })
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

        setFaqs(sortFaqs(result.faqs))
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        setLoadError('We could not load FAQ articles. Please try again later.')
      }
    }

    void loadFaqs()
    return () => controller.abort()
  }, [session])

  const visibleFaqs = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (faqs ?? []).filter((faq) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'published' ? faq.is_published : !faq.is_published)
      const matchesSearch =
        !term ||
        faq.question.toLowerCase().includes(term) ||
        faq.category.toLowerCase().includes(term)
      return matchesStatus && matchesSearch
    })
  }, [faqs, search, statusFilter])

  function startEditing(faq: FaqArticle) {
    setEditingId(faq.id)
    setForm({
      category: faq.category,
      question: faq.question,
      answer: faq.answer,
      slug: faq.slug ?? '',
      sortOrder: faq.sort_order.toString(),
    })
    setFormError(null)
    setMessage(null)
    setShowDraftPreview(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
    setShowDraftPreview(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session || isSaving) return

    const sortOrder = Number(form.sortOrder)
    const slug = form.slug.trim()
    if (
      !form.category.trim() ||
      !form.question.trim() ||
      !form.answer.trim() ||
      !Number.isInteger(sortOrder) ||
      sortOrder < 0 ||
      sortOrder > 1_000_000 ||
      (slug !== '' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    ) {
      setFormError('Enter a category, question, answer, valid slug, and non-negative order.')
      return
    }

    setIsSaving(true)
    setFormError(null)
    setMessage(null)

    try {
      const response = await fetch(
        editingId ? `/api/admin/faqs/${encodeURIComponent(editingId)}` : '/api/admin/faqs',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            category: form.category,
            question: form.question,
            answer: form.answer,
            slug: slug || null,
            sort_order: sortOrder,
          }),
        },
      )

      if (!response.ok) {
        setFormError(await getResponseError(response, 'We could not save this FAQ.'))
        return
      }

      const result: unknown = await response.json()
      if (
        typeof result !== 'object' ||
        result === null ||
        !('faq' in result) ||
        !isFaqArticle(result.faq)
      ) {
        throw new Error('INVALID_FAQ_RESPONSE')
      }

      const savedFaq = result.faq
      setFaqs((current) =>
        sortFaqs(
          current?.some((faq) => faq.id === savedFaq.id)
            ? current.map((faq) => (faq.id === savedFaq.id ? savedFaq : faq))
            : [...(current ?? []), savedFaq],
        ),
      )
      setMessage(editingId ? 'FAQ updated.' : 'Draft FAQ created.')
      resetForm()
    } catch {
      setFormError('We could not save this FAQ. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handlePublication(faq: FaqArticle) {
    if (!session || publicationId) return
    setPublicationId(faq.id)
    setFormError(null)
    setMessage(null)

    try {
      const response = await fetch(
        `/api/admin/faqs/${encodeURIComponent(faq.id)}/publication`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ is_published: !faq.is_published }),
        },
      )

      if (!response.ok) {
        setFormError(await getResponseError(response, 'We could not update publication.'))
        return
      }

      const result: unknown = await response.json()
      if (
        typeof result !== 'object' ||
        result === null ||
        !('faq' in result) ||
        !isFaqArticle(result.faq)
      ) {
        throw new Error('INVALID_FAQ_RESPONSE')
      }

      const savedFaq = result.faq
      setFaqs((current) =>
        sortFaqs((current ?? []).map((item) => (item.id === savedFaq.id ? savedFaq : item))),
      )
      setMessage(savedFaq.is_published ? 'FAQ published.' : 'FAQ returned to drafts.')
    } catch {
      setFormError('We could not update publication. Please try again.')
    } finally {
      setPublicationId(null)
    }
  }

  const publishedCount = faqs?.filter((faq) => faq.is_published).length ?? 0

  return (
    <section className="w-full max-w-7xl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-blue-400 uppercase">Knowledge base</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.02em] text-white">FAQ management</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Write, preview, order, and publish customer help articles.</p>
        </div>
        <div className="flex gap-5 text-sm text-slate-400" aria-label="FAQ totals">
          <p><strong className="block text-xl text-white">{faqs?.length ?? 0}</strong>Total</p>
          <p><strong className="block text-xl text-emerald-300">{publishedCount}</strong>Published</p>
        </div>
      </header>

      {(formError || message) ? (
        <div className="mt-5" aria-live="polite">
          {formError ? <p className="text-sm text-red-300" role="alert">{formError}</p> : null}
          {message ? <p className="text-sm text-emerald-300" role="status">{message}</p> : null}
        </div>
      ) : null}

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="order-2 min-w-0 xl:order-1">
          <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <label className="sr-only" htmlFor="faq-search">Search FAQs</label>
            <input id="faq-search" className={inputClass} onChange={(event) => setSearch(event.target.value)} placeholder="Search questions or categories" type="search" value={search} />
            <label className="sr-only" htmlFor="faq-status">Filter publication status</label>
            <select id="faq-status" className={inputClass} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} value={statusFilter}>
              <option value="all">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Drafts</option>
            </select>
          </div>

          {loadError ? (
            <ErrorPanel message={loadError} title="FAQs unavailable" />
          ) : faqs === null ? (
            <PageSkeleton count={5} type="list" />
          ) : visibleFaqs.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-white/10 bg-[#11161f] p-8 text-center text-sm text-slate-400">
              {faqs.length === 0 ? 'No FAQ articles have been created yet.' : 'No articles match these filters.'}
            </div>
          ) : (
            <div className="divide-y divide-white/8 overflow-hidden rounded-[12px] border border-white/8 bg-[#11161f]">
              {visibleFaqs.map((faq) => {
                const previewOpen = previewId === faq.id
                return (
                  <article className="p-5" key={faq.id}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-blue-300">{faq.category}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${faq.is_published ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/7 text-slate-400'}`}>
                            {faq.is_published ? 'Published' : 'Draft'}
                          </span>
                          <span className="text-[11px] text-slate-600">Order {faq.sort_order}</span>
                        </div>
                        <h2 className="mt-2 text-[15px] font-semibold leading-6 text-white">{faq.question}</h2>
                        {faq.slug ? <p className="mt-1 truncate font-mono text-[11px] text-slate-500">/{faq.slug}</p> : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <ActionButton onClick={() => setPreviewId(previewOpen ? null : faq.id)}>{previewOpen ? 'Hide preview' : 'Preview'}</ActionButton>
                        <ActionButton onClick={() => startEditing(faq)}>Edit</ActionButton>
                        <ActionButton disabled={publicationId !== null} onClick={() => void handlePublication(faq)}>
                          {publicationId === faq.id ? 'Updating…' : faq.is_published ? 'Unpublish' : 'Publish'}
                        </ActionButton>
                      </div>
                    </div>
                    {previewOpen ? (
                      <div className="mt-4 border-t border-white/8 pt-4">
                        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{faq.answer}</p>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
        </div>

        <aside className="order-1 xl:order-2">
          <form className="rounded-[12px] border border-white/8 bg-[#11161f] p-5 xl:sticky xl:top-8" onSubmit={(event) => void handleSubmit(event)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-white">{editingId ? 'Edit FAQ' : 'Create FAQ'}</h2>
                <p className="mt-1 text-xs text-slate-500">New articles remain drafts until published.</p>
              </div>
              {editingId ? <button className="text-xs font-medium text-slate-400 hover:text-white" onClick={resetForm} type="button">Cancel</button> : null}
            </div>

            <div className="mt-5 space-y-4">
              <Field label="Category">
                <input className={inputClass} list="faq-category-options" maxLength={100} onChange={(event) => setForm({ ...form, category: event.target.value })} required value={form.category} />
                <datalist id="faq-category-options">{suggestedCategories.map((category) => <option key={category} value={category} />)}</datalist>
              </Field>
              <Field label="Question">
                <textarea className={`${inputClass} min-h-20 resize-y`} maxLength={300} onBlur={() => { if (!form.slug) setForm((current) => ({ ...current, slug: slugify(current.question) })) }} onChange={(event) => setForm({ ...form, question: event.target.value })} required value={form.question} />
              </Field>
              <Field label="Answer">
                <textarea className={`${inputClass} min-h-40 resize-y`} maxLength={20000} onChange={(event) => setForm({ ...form, answer: event.target.value })} required value={form.answer} />
              </Field>
              <Field hint="Optional; generated from the question when left blank." label="Slug">
                <input className={inputClass} maxLength={120} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase() })} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="how-to-pay-my-invoice" value={form.slug} />
              </Field>
              <Field label="Display order">
                <input className={inputClass} max={1000000} min={0} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} required type="number" value={form.sortOrder} />
              </Field>
            </div>

            {showDraftPreview ? (
              <section aria-label="FAQ draft preview" className="mt-5 border-t border-white/8 pt-5">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-blue-300 uppercase">Preview</p>
                <h3 className="mt-2 text-sm font-semibold leading-6 text-white">{form.question.trim() || 'Your question will appear here'}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">{form.answer.trim() || 'Your answer will appear here.'}</p>
              </section>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <button className="min-h-11 flex-1 rounded-[9px] bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50" disabled={isSaving} type="submit">
                {isSaving ? 'Saving…' : editingId ? 'Save changes' : 'Create draft'}
              </button>
              <button className="min-h-11 rounded-[9px] border border-white/10 px-4 text-sm font-semibold text-slate-300 hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" onClick={() => setShowDraftPreview((current) => !current)} type="button">
                {showDraftPreview ? 'Hide preview' : 'Preview'}
              </button>
            </div>
          </form>
        </aside>
      </div>
    </section>
  )
}

const inputClass =
  'min-h-11 w-full rounded-[9px] border border-white/10 bg-[#0a0d12] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25'

function Field({ children, hint, label }: { children: ReactNode; hint?: string; label: string }) {
  return (
    <label className="block text-xs font-medium text-slate-400">
      <span>{label}</span>
      {hint ? <span className="ml-1 font-normal text-slate-600">{hint}</span> : null}
      <span className="mt-1.5 block">{children}</span>
    </label>
  )
}

function ActionButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button className="min-h-10 rounded-[9px] border border-white/10 px-3 text-xs font-semibold text-slate-300 hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled} onClick={onClick} type="button">
      {children}
    </button>
  )
}
