const journeySteps = [
  {
    number: '01',
    title: 'Check your address',
    description: 'Confirm that service is available at your installation address.',
  },
  {
    number: '02',
    title: 'Choose a plan',
    description: 'Compare the internet plans that are currently available.',
  },
  {
    number: '03',
    title: 'Apply online',
    description: 'Send your service application and follow its review status.',
  },
  {
    number: '04',
    title: 'Manage your account',
    description: 'Review invoices, make secure payments, and download statements.',
  },
]

const platformFeatures = [
  {
    title: 'Online applications',
    description:
      'Choose an available plan, submit your details, and follow the review from your account.',
  },
  {
    title: 'Clear account access',
    description:
      'See your current service plan and application status in one customer portal.',
  },
  {
    title: 'Secure online billing',
    description:
      'Review invoice details and use Stripe Checkout when an invoice is ready for payment.',
  },
  {
    title: 'Monthly statements',
    description:
      'Access your available Statements of Account as private downloadable PDF files.',
  },
]

const focusClass =
  'rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950'

export function HomePage() {
  return (
    <div className="w-full max-w-7xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl shadow-sky-950/20">
      <header className="border-b border-slate-800/80 px-5 py-5 sm:px-8 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <a
            className={`flex items-center gap-3 font-bold text-white ${focusClass}`}
            href="/"
          >
            <span
              aria-hidden="true"
              className="grid size-10 place-items-center rounded-xl bg-sky-400 font-black text-slate-950"
            >
              ISP
            </span>
            <span>ISP Platform</span>
          </a>

          <nav
            aria-label="Public navigation"
            className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm font-medium"
          >
            <a className={`text-white ${focusClass}`} href="/">
              Home
            </a>
            <a
              className={`text-slate-300 transition hover:text-white ${focusClass}`}
              href="/plans"
            >
              Plans
            </a>
            <a
              className={`text-slate-300 transition hover:text-white ${focusClass}`}
              href="/availability"
            >
              Check availability
            </a>
            <a
              className={`text-slate-300 transition hover:text-white ${focusClass}`}
              href="/login"
            >
              Log in
            </a>
            <a
              className={`rounded-lg bg-sky-400 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-sky-300 ${focusClass}`}
              href="/signup"
            >
              Sign up
            </a>
          </nav>
        </div>
      </header>

      <div className="relative isolate overflow-hidden px-5 py-16 sm:px-8 sm:py-24 lg:px-10 lg:py-28">
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-32 -z-10 size-96 rounded-full bg-sky-500/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-40 left-1/4 -z-10 size-80 rounded-full bg-cyan-400/10 blur-3xl"
        />

        <section className="mx-auto max-w-4xl text-center" aria-labelledby="home-heading">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-400">
            Internet service made clearer
          </p>
          <h1
            className="mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl"
            id="home-heading"
          >
            Get connected. Stay in control.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
            Check service availability, compare active plans, apply online, and
            manage your ISP account from one secure portal.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              className={`rounded-xl bg-sky-400 px-6 py-3.5 font-bold text-slate-950 transition hover:bg-sky-300 ${focusClass}`}
              href="/availability"
            >
              Check your address
            </a>
            <a
              className={`rounded-xl border border-slate-700 bg-slate-900/70 px-6 py-3.5 font-bold text-white transition hover:border-slate-500 hover:bg-slate-800 ${focusClass}`}
              href="/plans"
            >
              View internet plans
            </a>
          </div>
        </section>
      </div>

      <section
        aria-labelledby="journey-heading"
        className="border-y border-slate-800 bg-slate-900/60 px-5 py-16 sm:px-8 lg:px-10"
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl" id="journey-heading">
              From address check to account access
            </h2>
            <p className="mt-3 leading-7 text-slate-400">
              A straightforward path for choosing service and managing it online.
            </p>
          </div>

          <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {journeySteps.map((step) => (
              <li
                className="rounded-2xl border border-slate-800 bg-slate-950 p-6"
                key={step.number}
              >
                <span className="font-mono text-sm font-bold text-sky-400">
                  {step.number}
                </span>
                <h3 className="mt-5 text-lg font-bold text-white">{step.title}</h3>
                <p className="mt-2 leading-6 text-slate-400">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        aria-labelledby="features-heading"
        className="px-5 py-16 sm:px-8 lg:px-10 lg:py-20"
      >
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
              Your service account
            </p>
            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl" id="features-heading">
              The essentials, available online
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {platformFeatures.map((feature) => (
              <article
                className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6 sm:p-7"
                key={feature.title}
              >
                <div aria-hidden="true" className="size-2 rounded-full bg-sky-400" />
                <h3 className="mt-5 text-xl font-bold text-white">{feature.title}</h3>
                <p className="mt-2 max-w-xl leading-7 text-slate-400">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-sky-900 bg-sky-950/40 p-7 text-center sm:p-10">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Ready to check your location?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-300">
              Start with your installation address, then compare the plans currently
              available to apply for.
            </p>
            <a
              className={`mt-6 inline-block rounded-xl bg-sky-400 px-6 py-3 font-bold text-slate-950 transition hover:bg-sky-300 ${focusClass}`}
              href="/availability"
            >
              Check service availability
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800 bg-slate-900/50 px-5 py-8 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-5 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} ISP Platform</p>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-5">
            <a className={`transition hover:text-white ${focusClass}`} href="/plans">
              Plans
            </a>
            <a className={`transition hover:text-white ${focusClass}`} href="/availability">
              Availability
            </a>
            <a className={`transition hover:text-white ${focusClass}`} href="/login">
              Log in
            </a>
            <a className={`transition hover:text-white ${focusClass}`} href="/signup">
              Sign up
            </a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
