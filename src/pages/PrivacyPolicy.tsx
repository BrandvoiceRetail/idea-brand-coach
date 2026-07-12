/**
 * PrivacyPolicy — the public GDPR privacy notice (Art. 13/14), reachable
 * signed-out at /privacy. Content mirrors docs/compliance/ROPA.md — when a
 * processor or purpose changes there, change it here too and bump
 * CONSENT_POLICY_VERSION in src/lib/consent.ts so the banner re-prompts.
 */
import { Link } from 'react-router-dom';
import { CONSENT_POLICY_VERSION } from '@/lib/consent';

interface ProcessorRow {
  name: string;
  purpose: string;
  data: string;
  location: string;
}

const PROCESSORS: ProcessorRow[] = [
  { name: 'Supabase', purpose: 'Database, authentication, file storage, serverless functions', data: 'All account data and content you create', location: 'EU/US (project region)' },
  { name: 'Anthropic (Claude)', purpose: 'AI coaching — generates the coach’s answers', data: 'Your conversations, brand content, and product context', location: 'US' },
  { name: 'OpenAI', purpose: 'Text embeddings for search over your own content', data: 'Brand/diagnostic text you provide', location: 'US' },
  { name: 'PostHog (EU)', purpose: 'Product analytics — only with your consent', data: 'Usage events, device info, IP address', location: 'EU (Frankfurt)' },
  { name: 'Stripe', purpose: 'Payments and subscriptions', data: 'Email, payment details (entered on Stripe’s own page)', location: 'US/EU' },
  { name: 'Resend', purpose: 'Transactional email (reports you request)', data: 'Your email address and the report content', location: 'US' },
  { name: 'Firecrawl', purpose: 'Fetching Amazon listing/review pages you point us at', data: 'Product URLs/ASINs (no account data)', location: 'US' },
  { name: 'DataForSEO', purpose: 'Competitor product research', data: 'Search keywords and ASINs (no account data)', location: 'US' },
  { name: 'Google (Gemini, Custom Search)', purpose: 'Listing-image generation and competitor discovery', data: 'Image prompts, your product photos, search terms', location: 'US' },
  { name: 'fal.ai / Pixii', purpose: 'AI image & video generation you request', data: 'Prompts and product images you submit', location: 'US' },
  { name: 'Slack', purpose: 'Routing your in-app feedback to our team', data: 'The feedback text you submit', location: 'US' },
  { name: 'Figma / Canva', purpose: 'Design imports — only if you connect them', data: 'OAuth connection and the designs you import', location: 'US' },
  { name: 'AWS (Lightsail)', purpose: 'Hosting the app and MCP gateway', data: 'Standard web-server logs (IP, user agent)', location: 'US (us-east-1)' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPolicy(): JSX.Element {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8 text-sm leading-relaxed">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="text-muted-foreground">
          IDEA Brand Coach — last updated {CONSENT_POLICY_VERSION}. This notice explains what
          personal data we process, why, where it goes, and the rights you can exercise yourself
          inside the app.
        </p>
      </header>

      <Section title="Who we are">
        <p>
          IDEA Brand Coach (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is the AI brand-coaching service at{' '}
          ideabrandcoach.com, operated by Brandvoice Retail Ltd (IDEA Brand Consultancy), the data
          controller. For any privacy request or question, contact{' '}
          <a href="mailto:privacy@ideabrandconsultancy.com" className="underline">
            privacy@ideabrandconsultancy.com
          </a>
          . We answer data-subject requests within one month (GDPR Art. 12).
        </p>
      </Section>

      <Section title="What we collect, and why">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <span className="font-medium">Account data</span> — name, email, password hash
            (managed by Supabase Auth). <em>Lawful basis: contract</em> — we cannot provide an
            account without it.
          </li>
          <li>
            <span className="font-medium">Content you create</span> — brand profiles, customer
            avatars, coach conversations, diagnostics and their answers, uploaded documents,
            imported product listings and reviews, generated briefs and workbooks, and the
            coach&rsquo;s working memory about your brand. <em>Lawful basis: contract</em> — this IS
            the service.
          </li>
          <li>
            <span className="font-medium">Billing data</span> — subscription tier, Stripe customer
            and subscription identifiers, usage credits. Card numbers never touch our systems (they
            are entered on Stripe&rsquo;s hosted page). <em>Lawful bases: contract and legal
            obligation</em> (financial record-keeping).
          </li>
          <li>
            <span className="font-medium">Product analytics</span> — usage events via PostHog,
            hosted in the EU, <em>only after you opt in</em> via the consent banner or Settings →
            Privacy. <em>Lawful basis: consent</em>, withdrawable any time with equal ease.
          </li>
          <li>
            <span className="font-medium">Server telemetry</span> — error logs and per-tool usage
            counters our servers record to keep the service secure, debug failures, and prevent
            abuse (rate limiting). <em>Lawful basis: legitimate interest</em> in running a secure,
            working service.
          </li>
          <li>
            <span className="font-medium">Free diagnostic leads</span> — if you use the free Trust
            Gap diagnostic and choose to receive your report by email, we store the name, email,
            and answers you submit, with your consent recorded. <em>Lawful basis: consent.</em>{' '}
            Unsubscribe/erasure: one email to the address above.
          </li>
        </ul>
      </Section>

      <Section title="AI processing — being direct about it">
        <p>
          The coaching itself is performed by large language models. Your conversations, brand
          content, and product context are sent to Anthropic&rsquo;s Claude API to generate the
          coach&rsquo;s responses; embeddings of your content are computed via OpenAI; image/video
          generation you request goes to Google Gemini, fal.ai, or Pixii with the prompts and
          images you supply. Under our API agreements these providers do not use your data to
          train their models. No decision producing legal or similarly significant effects about
          you is made solely by automated means (GDPR Art. 22) — the coach advises; you decide.
        </p>
      </Section>

      <Section title="Who processes your data for us">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3 font-semibold">Provider</th>
                <th className="py-2 pr-3 font-semibold">Purpose</th>
                <th className="py-2 pr-3 font-semibold">Data involved</th>
                <th className="py-2 font-semibold">Location</th>
              </tr>
            </thead>
            <tbody>
              {PROCESSORS.map((p) => (
                <tr key={p.name} className="border-b align-top">
                  <td className="py-2 pr-3 font-medium whitespace-nowrap">{p.name}</td>
                  <td className="py-2 pr-3">{p.purpose}</td>
                  <td className="py-2 pr-3">{p.data}</td>
                  <td className="py-2 whitespace-nowrap">{p.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Where a provider is outside the EU/EEA, transfers rely on the EU–US Data Privacy
          Framework or Standard Contractual Clauses in that provider&rsquo;s data-processing
          agreement. You can request a copy of the safeguards for any transfer by emailing us.
        </p>
      </Section>

      <Section title="Data about other people (Amazon reviews)">
        <p>
          When you analyse a listing, we fetch its public Amazon page, which can include
          reviewer display names and review text — personal data about people who are not our
          users. We process it only to give you the diagnosis you asked for, on the basis of our
          and your legitimate interest in analysing public marketplace feedback, and it is deleted
          when you delete your account. Because this data comes from public listings and not from
          the reviewers directly, notifying each reviewer would involve disproportionate effort
          (GDPR Art. 14(5)(b)); any such person may still contact us to access or erase what we hold
          about them. If you upload this data to us, you are responsible for having a lawful basis
          to share it.
        </p>
      </Section>

      <Section title="Cookies and local storage">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <span className="font-medium">Strictly necessary</span> (no consent needed): your
            sign-in session, theme and version preferences, and locally cached work-in-progress so
            you don&rsquo;t lose typed content.
          </li>
          <li>
            <span className="font-medium">Analytics (optional)</span>: PostHog cookies are set only
            after you accept the consent banner. Declining — or ignoring the banner — means no
            analytics run at all. Withdraw any time in Settings → Privacy.
          </li>
        </ul>
      </Section>

      <Section title="How long we keep data">
        <p>
          Your account data and content are kept while your account exists and are deleted when
          you delete your account (below). Diagnostic leads are kept until you unsubscribe or ask
          for erasure. Server logs rotate on a short cycle. Billing records are retained as long as
          financial law requires, even after account deletion (GDPR Art. 17(3)(b)).
        </p>
      </Section>

      <Section title="Your rights — self-service">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <span className="font-medium">Access &amp; portability (Art. 15/20)</span>: Settings →
            Privacy → &ldquo;Download my data&rdquo; gives you everything as machine-readable JSON,
            instantly.
          </li>
          <li>
            <span className="font-medium">Erasure (Art. 17)</span>: Settings → Privacy →
            &ldquo;Delete my account and data&rdquo; permanently removes your account, content,
            files, and analytics identity.
          </li>
          <li>
            <span className="font-medium">Rectification (Art. 16)</span>: edit your content
            directly in the app, or email us for account fields you cannot edit.
          </li>
          <li>
            <span className="font-medium">Withdraw consent (Art. 7(3))</span>: analytics toggle in
            Settings → Privacy; email unsubscribe via the contact above.
          </li>
          <li>
            <span className="font-medium">Objection &amp; restriction (Art. 18/21)</span>, and
            anything else: email{' '}
            <a href="mailto:privacy@ideabrandconsultancy.com" className="underline">
              privacy@ideabrandconsultancy.com
            </a>
            . You also have the right to complain to your data-protection supervisory authority —
            in the UK the ICO (ico.org.uk), or in the EU the authority in your country of residence.
          </li>
        </ul>
      </Section>

      <Section title="Children">
        <p>This service is for businesses and is not directed at children under 16.</p>
      </Section>

      <Section title="Changes">
        <p>
          When this notice changes materially, the version above changes and the app asks for your
          consent again where consent is the basis.
        </p>
      </Section>

      <footer className="pt-4 border-t text-muted-foreground">
        <Link to="/" className="underline">Back to IDEA Brand Coach</Link>
      </footer>
    </div>
  );
}
