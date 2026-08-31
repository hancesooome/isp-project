import { Link } from 'react-router-dom'

export function AdminOverviewPage() {
  return (
    <section className="w-full max-w-5xl">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
          Admin portal
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
          Admin overview
        </h1>
        <p className="mt-2 text-slate-400">
          Manage service applications and customer billing operations.
        </p>
      </header>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <article className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl transition hover:border-slate-700">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-400">
                <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="20">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <h2 className="text-xl font-bold text-white">Service applications</h2>
            </div>
            <p className="mt-4 leading-6 text-slate-400">
              Review incoming service applications, inspect customer details, and approve or reject applications.
            </p>
          </div>
          <div className="mt-6 border-t border-slate-800/80 pt-4">
            <Link
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-400 hover:text-amber-300"
              to="/admin/applications"
            >
              View applications &rarr;
            </Link>
          </div>
        </article>

        <article className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl transition hover:border-slate-700">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-400">
                <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="20">
                  <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <h2 className="text-xl font-bold text-white">Billing management</h2>
            </div>
            <p className="mt-4 leading-6 text-slate-400">
              Manually create open invoices for active customer subscriptions with billing amounts and due dates.
            </p>
          </div>
          <div className="mt-6 border-t border-slate-800/80 pt-4">
            <Link
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-400 hover:text-amber-300"
              to="/admin/billing"
            >
              Manage billing &rarr;
            </Link>
          </div>
        </article>
      </div>
    </section>
  )
}
