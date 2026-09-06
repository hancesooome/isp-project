const sections = [
  {
    title: 'Information this platform handles',
    content: (
      <div className="space-y-5">
        <PolicyItem
          title="Account and contact information"
          text="Name, email address, phone number, authentication identifiers, and information needed to maintain your customer profile. Password authentication is handled by Supabase Auth; this application does not store your password in its customer tables."
        />
        <PolicyItem
          title="Service and installation information"
          text="Current address, requested installation address, Philippine geographic codes, coverage results, and the latitude and longitude of an installation pin. Browser location is requested only after you choose to use your location and grant browser permission."
        />
        <PolicyItem
          title="Applications and service records"
          text="Selected plan, application status, subscription details, plan-change requests, administrative review notes, and related timestamps."
        />
        <PolicyItem
          title="Billing and payment metadata"
          text="Invoices, amounts, currency, payment provider, payment method, provider references, status, and payment timestamps. Card numbers, security codes, and e-wallet credentials are handled by the selected payment provider and are not stored by this platform."
        />
        <PolicyItem
          title="Support interactions"
          text="Support subjects, descriptions, replies, status history, and the account associated with each request."
        />
        <PolicyItem
          title="Technical information"
          text="Session information, request identifiers, security and error logs, approximate network information, browser details, and other data produced when operating and protecting the service."
        />
      </div>
    ),
  },
  {
    title: 'How information is used',
    content: (
      <ul className="list-disc space-y-2 pl-5 text-slate-600">
        <li>Create and secure accounts and provide authenticated access.</li>
        <li>Check coverage, process applications, and coordinate installation.</li>
        <li>Manage subscriptions, invoices, payments, statements, and plan changes.</li>
        <li>Respond to support requests and send service-related communications.</li>
        <li>Prevent misuse, troubleshoot failures, and maintain audit records.</li>
        <li>Meet applicable accounting, regulatory, and legal obligations.</li>
      </ul>
    ),
  },
  {
    title: 'Service providers and disclosures',
    content: (
      <div className="overflow-hidden rounded-xl border border-slate-900/10">
        <dl className="divide-y divide-slate-900/10">
          <Processor name="Supabase" purpose="Authentication, database, and private statement storage." />
          <Processor name="Vercel" purpose="Application hosting, delivery, and infrastructure logs." />
          <Processor name="Stripe" purpose="Hosted card checkout and payment status processing." />
          <Processor name="PayMongo" purpose="GCash, Maya, QR Ph, and associated payment processing." />
          <Processor name="Resend" purpose="Transactional account, billing, and support email delivery." />
          <Processor name="PSGC Cloud" purpose="Philippine geographic reference names and codes used in address forms." />
          <Processor name="OpenStreetMap tile services" purpose="Map display; loading map tiles may disclose technical request data and the viewed map area to the tile provider." />
        </dl>
      </div>
    ),
  },
  {
    title: 'Browser storage and cookies',
    content: (
      <div className="space-y-5 text-slate-600">
        <p>Supabase uses browser storage to maintain your authenticated session. The availability journey uses session storage to carry coverage and selected-plan details between pages in the same browser session.</p>
        <p>The application does not currently include advertising or behavioral-tracking cookies. Hosting, authentication, payment, and map providers may use necessary cookies or receive technical request information when their services are loaded.</p>
        <dl className="overflow-hidden rounded-xl border border-slate-900/10 bg-white">
          <StorageCategory
            description="Authentication and the verified service-availability journey. These are required for the features you request."
            name="Necessary"
            status="Active"
          />
          <StorageCategory
            description="No preference storage or integrations are currently installed."
            name="Preferences"
            status="Not in use"
          />
          <StorageCategory
            description="No analytics or session-replay integrations are currently installed."
            name="Analytics"
            status="Not in use"
          />
          <StorageCategory
            description="No advertising or behavioral-marketing integrations are currently installed."
            name="Marketing"
            status="Not in use"
          />
        </dl>
        <p className="text-sm">There are currently no optional categories to accept, reject, or configure, so the platform does not display a consent banner. Controls must be added before any optional integration is enabled.</p>
      </div>
    ),
  },
  {
    title: 'Retention, access, and deletion',
    content: (
      <div className="space-y-3 text-slate-600">
        <p>Customer, application, billing, payment, support, security, and audit records may require different retention periods. A final retention schedule has not yet been approved for commercial operation.</p>
        <p>Depending on applicable law, you may have rights concerning access, correction, objection, portability, or deletion. Some records may need to be retained for billing, fraud prevention, dispute handling, or legal compliance. The operator must publish a verified privacy-contact process before launch.</p>
      </div>
    ),
  },
  {
    title: 'Security and international processing',
    content: (
      <div className="space-y-3 text-slate-600">
        <p>The platform uses access controls, provider signature verification, and database ownership rules intended to reduce unauthorized access. No internet service or storage system can guarantee absolute security.</p>
        <p>Some service providers may process or store information outside the Philippines. The operator must review provider locations, contracts, safeguards, and any applicable cross-border requirements before commercial deployment.</p>
      </div>
    ),
  },
]

export function PrivacyPolicyPage() {
  return (
    <article className="mx-auto max-w-4xl">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Legal information</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">Privacy policy</h1>
        <p className="mt-5 text-lg leading-8 text-slate-600">How the ISP Platform handles information across coverage checks, applications, customer accounts, billing, payments, and support.</p>
        <p className="mt-3 text-sm text-slate-500">Product draft updated September 6, 2026</p>
      </header>

      <aside className="mt-10 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-950" role="note">
        <strong className="block font-semibold">Legal review required before commercial deployment</strong>
        This product draft is not legal advice. The operating ISP must add its legal identity, contact details, privacy contact or data protection officer, approved retention schedule, lawful-processing analysis, and jurisdiction-specific notices after review by qualified Philippine privacy counsel.
      </aside>

      <section className="mt-12 border-t border-slate-900/10 pt-8" aria-labelledby="controller-heading">
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-slate-950" id="controller-heading">Who is responsible</h2>
        <p className="mt-4 leading-7 text-slate-600">The ISP business operating this platform will be responsible for deciding how customer information is used. Its verified legal name, business address, and privacy contact have not yet been configured and must be added before public commercial use.</p>
      </section>

      {sections.map((section) => (
        <section className="mt-12 border-t border-slate-900/10 pt-8" key={section.title}>
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-slate-950">{section.title}</h2>
          <div className="mt-5 leading-7">{section.content}</div>
        </section>
      ))}

      <section className="mt-12 border-t border-slate-900/10 pt-8">
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-slate-950">Policy changes and contact</h2>
        <div className="mt-5 space-y-3 leading-7 text-slate-600">
          <p>This page may be updated as the product, providers, and legal requirements change. Material operational changes should be reflected here before they take effect.</p>
          <p>A verified privacy email and postal address are not yet available. Do not commercially launch this platform until those contact channels are published and monitored.</p>
        </div>
      </section>
    </article>
  )
}

function PolicyItem({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-slate-600">{text}</p>
    </div>
  )
}

function Processor({ name, purpose }: { name: string; purpose: string }) {
  return (
    <div className="grid gap-1 bg-white p-4 sm:grid-cols-[12rem_1fr] sm:gap-5">
      <dt className="font-semibold text-slate-900">{name}</dt>
      <dd className="text-slate-600">{purpose}</dd>
    </div>
  )
}

function StorageCategory({
  description,
  name,
  status,
}: {
  description: string
  name: string
  status: 'Active' | 'Not in use'
}) {
  return (
    <div className="grid gap-2 border-b border-slate-900/10 p-4 last:border-b-0 sm:grid-cols-[9rem_1fr_auto] sm:items-center sm:gap-5">
      <dt className="font-semibold text-slate-900">{name}</dt>
      <dd className="text-sm leading-6 text-slate-600">{description}</dd>
      <dd
        className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
          status === 'Active'
            ? 'bg-blue-50 text-blue-700'
            : 'bg-slate-100 text-slate-600'
        }`}
      >
        {status}
      </dd>
    </div>
  )
}
