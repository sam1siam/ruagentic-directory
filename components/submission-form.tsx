'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  LoaderCircle,
  Link2,
  Server,
  Monitor,
  Workflow,
  ExternalLink,
  FileJson,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  categories,
  emptyListing,
  listingSchema,
  type ListingInput,
} from '@/lib/listing';
import { api } from '@/lib/client-api';
type Audit = {
  id: string;
  eligible: boolean;
  checked_at: string;
  revision: number;
  report: {
    publication?: { status: string; summary?: string };
    checks?: {
      id: string;
      label: string;
      status: string;
      detail: string;
      remedy?: string;
      helpUrl?: string;
    }[];
    readme?: {
      checks?: {
        id: string;
        label: string;
        status: string;
        detail: string;
        remedy?: string;
        helpUrl?: string;
      }[];
    };
    errors?: string[];
  };
};
type Saved = {
  id: string;
  revision: number;
  state: string;
  slug: string | null;
  payload: ListingInput;
};
const steps = [
  'Account',
  'Project link',
  'Details',
  'Listing option',
  'Review',
];
export default function SubmissionForm({
  id,
  email,
}: {
  id?: string;
  email: string;
}) {
  const [step, setStep] = useState(id ? 2 : 1),
    [listing, setListing] = useState<ListingInput>({ ...emptyListing }),
    [saved, setSaved] = useState<Saved | null>(null),
    [sourceType, setSourceType] = useState<
      'homepage' | 'repository' | 'endpoint'
    >('repository'),
    [url, setUrl] = useState(''),
    [path, setPath] = useState<'agentic' | 'payment'>('agentic'),
    [audit, setAudit] = useState<Audit | null>(null),
    [paid, setPaid] = useState<string | null>(null),
    [checkoutOpen, setCheckoutOpen] = useState(false),
    [busy, setBusy] = useState(id ? 'Loading your listing' : ''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [fields, setFields] = useState<Record<string, string[]>>({}),
    [consent, setConsent] = useState(false),
    [published, setPublished] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const dirty = Boolean(
    saved && JSON.stringify(saved.payload) !== JSON.stringify(listing),
  );
  useEffect(() => {
    if (!id) return;
    let active = true;
    void api('/api/submissions/' + id, undefined, 'GET')
      .then((data) => {
        if (!active) return;
        setListing(data.submission.payload);
        setSaved(data.submission);
        setAudit(data.audit);
        setPaid(
          data.payments.find((p: { state: string }) => p.state === 'paid')
            ?.id ?? null,
        );
        setCheckoutOpen(
          data.payments.some(
            (p: { state: string }) =>
              p.state === 'open' || p.state === 'creating',
          ),
        );
        if (
          data.submission.state === 'published' &&
          data.submission.slug &&
          data.currentRevisionPublished
        ) {
          setPublished(data.submission.slug);
        }
        if (['withdrawn', 'suspended'].includes(data.submission.state))
          setError(
            'This listing is ' +
              data.submission.state +
              '. Contact support to restore it.',
          );
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy('');
      });
    return () => {
      active = false;
    };
  }, [id]);
  function update<K extends keyof ListingInput>(
    key: K,
    value: ListingInput[K],
  ) {
    setListing((p) => ({ ...p, [key]: value }));
    setAudit(null);
    setConsent(false);
    setFields((p) => ({ ...p, [key]: [] }));
  }
  async function run(task: () => Promise<void>, label: string) {
    if (busy) return;
    setError('');
    setNotice('');
    setBusy(label);
    try {
      await task();
    } catch (e) {
      const err = e as Error & { fields?: Record<string, string[]> };
      setError(err.message);
      if (err.fields) setFields(err.fields);
    } finally {
      setBusy('');
    }
  }
  async function save() {
    const parsed = listingSchema.safeParse({
      ...listing,
      tags: listing.tags.map((v) => v.trim()).filter(Boolean),
      platforms: listing.platforms.map((v) => v.trim()).filter(Boolean),
      capabilities: listing.capabilities.map((v) => v.trim()).filter(Boolean),
    });
    if (!parsed.success) {
      setFields(z.flattenError(parsed.error).fieldErrors);
      throw new Error('Check the fields below before continuing.');
    }
    if (saved && !dirty) return saved;
    const data = await api('/api/submissions', {
      id: saved?.id ?? null,
      revision: saved?.revision ?? null,
      listing: parsed.data,
    });
    setSaved(data.submission);
    setListing(data.submission.payload);
    setAudit(null);
    window.history.replaceState(null, '', '/submit?id=' + data.submission.id);
    return data.submission as Saved;
  }
  async function checkFiles() {
    const current = await save();
    const data = await api('/api/submissions/audit', {
      id: current.id,
      revision: current.revision,
    });
    setAudit(data.audit);
    if (data.audit.eligible)
      setNotice(
        'Your Agentic files qualify this listing for free publication.',
      );
  }
  const eligible = Boolean(
    audit?.eligible &&
    !dirty &&
    audit.revision === saved?.revision &&
    now - Date.parse(audit.checked_at) < 15 * 60000,
  );
  const errorsFor = (key: string) =>
    fields[key]?.length ? (
      <small className="field-error" role="alert">
        {fields[key].join(' ')}
      </small>
    ) : null;
  function textField(
    key: keyof ListingInput,
    label: string,
    hint = '',
    placeholder = '',
  ) {
    return (
      <label>
        {label}
        <Input
          disabled={Boolean(busy)}
          value={String(listing[key])}
          onChange={(e) => update(key, e.target.value as never)}
          aria-invalid={Boolean(fields[key]?.length)}
          placeholder={placeholder}
        />
        {hint && <small>{hint}</small>}
        {errorsFor(key)}
      </label>
    );
  }
  const checks = [
    ...(audit?.report.checks ?? []),
    ...(audit?.report.readme?.checks ?? []),
  ].filter(
    (check, index, all) => all.findIndex((c) => c.id === check.id) === index,
  );
  if (published)
    return (
      <main className="content-page narrow">
        <div className="confirmation-card">
          <CheckCircle2 size={44} />
          <span className="eyebrow">LISTING PUBLISHED</span>
          <h1>{listing.name} is on RUAGENTIC.</h1>
          <p>
            Your listing has a permanent public URL. Its confirmation email is
            queued for {email}.
          </p>
          <div className="copy-url">
            https://ruagentic.com/tools/{published}
          </div>
          <div className="actions">
            <Link href={'/tools/' + published} className="button primary">
              View your listing
              <ArrowUpRight size={17} />
            </Link>
            <Link href="/dashboard" className="button secondary">
              Your dashboard
            </Link>
            <Button
              variant="outline"
              onClick={() => {
                setPublished(null);
                setStep(2);
              }}
            >
              Edit listing
            </Button>
          </div>
        </div>
      </main>
    );
  return (
    <main className="content-page submission-page">
      <div className="page-heading">
        <span className="eyebrow">JOIN THE DIRECTORY</span>
        <h1>Submit your project.</h1>
        <p>Share what it does. Help people find their next connection.</p>
      </div>
      <ol className="stepper" aria-label="Submission progress">
        {steps.map((label, index) => (
          <li
            key={label}
            className={
              index === step ? 'current' : index < step ? 'complete' : ''
            }
            aria-current={index === step ? 'step' : undefined}
          >
            <span>{index < step ? <Check size={14} /> : index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <div className="submission-layout">
        <section className="form-panel" aria-busy={Boolean(busy)}>
          {error && (
            <div className="notice error" role="alert">
              <AlertCircle size={18} />
              {error}
            </div>
          )}
          {notice && <output className="notice success">{notice}</output>}
          {busy && (
            <output className="busy-status">
              <LoaderCircle size={17} className="spin" />
              {busy}…
            </output>
          )}
          {step === 1 && (
            <>
              <h2>Start with a link.</h2>
              <p>
                Import public project details, then review and complete your
                listing.
              </p>
              <div className="type-options">
                {[
                  { id: 'server', name: 'MCP server', icon: Server },
                  { id: 'client', name: 'MCP client', icon: Monitor },
                  { id: 'product', name: 'Agentic product', icon: Workflow },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={listing.kind === item.id ? 'selected' : ''}
                    onClick={() =>
                      update('kind', item.id as ListingInput['kind'])
                    }
                  >
                    <item.icon size={19} />
                    {item.name}
                  </button>
                ))}
              </div>
              <div className="stack-form">
                <label>
                  Link type
                  <select
                    value={sourceType}
                    onChange={(e) =>
                      setSourceType(e.target.value as typeof sourceType)
                    }
                  >
                    <option value="repository">Repository URL</option>
                    <option value="homepage">
                      Homepage or documentation URL
                    </option>
                    <option value="endpoint">Remote MCP endpoint</option>
                  </select>
                </label>
                <label htmlFor="import-url">
                  Public URL
                  <Input
                    type="url"
                    id="import-url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={
                      sourceType === 'repository'
                        ? 'https://github.com/owner/project'
                        : sourceType === 'endpoint'
                          ? 'https://api.yoursite.com/mcp'
                          : 'https://yoursite.com'
                    }
                  />
                  <small>
                    Public HTTPS links only. Keep API keys and private
                    credentials out of your listing.
                  </small>
                </label>
              </div>
              <div className="actions">
                <Button
                  disabled={Boolean(busy) || !url.trim()}
                  onClick={() =>
                    run(async () => {
                      const result = await api('/api/import', {
                        url,
                        kind: listing.kind,
                        sourceType,
                      });
                      setListing(result.listing);
                      setNotice(result.notice);
                      setStep(2);
                    }, 'Importing details')
                  }
                >
                  <Link2 size={16} />
                  Import details
                  <ArrowRight size={16} />
                </Button>
                <Button
                  variant="ghost"
                  disabled={Boolean(busy)}
                  onClick={() => setStep(2)}
                >
                  Enter details manually
                </Button>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h2>Tell people what it does.</h2>
              <p>
                Make the description useful and specific. Every field can be
                reviewed before publication.
              </p>
              {checkoutOpen && (
                <div className="notice warning">
                  A checkout is open for this version.{' '}
                  <button
                    className="text-link"
                    onClick={() =>
                      run(async () => {
                        await api('/api/checkout', { id: saved!.id }, 'DELETE');
                        setCheckoutOpen(false);
                      }, 'Cancelling checkout')
                    }
                  >
                    Cancel checkout to edit
                  </button>
                </div>
              )}
              <fieldset disabled={Boolean(busy) || checkoutOpen}>
                <div className="form-grid">
                  <label>
                    Project type
                    <select
                      value={listing.kind}
                      onChange={(e) =>
                        update('kind', e.target.value as ListingInput['kind'])
                      }
                    >
                      <option value="server">MCP server</option>
                      <option value="client">MCP client</option>
                      <option value="product">Agentic product</option>
                    </select>
                  </label>
                  {textField('name', 'Project name', '', 'Your project name')}
                  <label className="full">
                    Short description
                    <Textarea
                      value={listing.summary}
                      onChange={(e) => update('summary', e.target.value)}
                      maxLength={240}
                      rows={2}
                      placeholder="What can people do with your project?"
                    />
                    <small>
                      20–240 characters. {listing.summary.length}/240
                    </small>
                    {errorsFor('summary')}
                  </label>
                  <label className="full">
                    About the project
                    <Textarea
                      value={listing.description}
                      onChange={(e) => update('description', e.target.value)}
                      maxLength={6000}
                      rows={5}
                      placeholder="Explain its capabilities, who it helps, and a practical use case."
                    />
                    <small>
                      At least 60 characters. Plain text; links have dedicated
                      fields below.
                    </small>
                    {errorsFor('description')}
                  </label>
                  {textField(
                    'homepage',
                    'Project homepage',
                    'A website or repository that identifies this project.',
                    'https://yoursite.com',
                  )}
                  {textField(
                    'repository',
                    'Source repository',
                    'Optional, unless this server has no remote endpoint.',
                    'https://github.com/owner/project',
                  )}
                  {textField(
                    'documentation',
                    'Documentation URL',
                    '',
                    'https://yoursite.com/docs',
                  )}
                  {textField(
                    'endpoint',
                    'Remote MCP endpoint',
                    'Optional for local servers and clients.',
                    'https://api.yoursite.com/mcp',
                  )}
                  <label>
                    Category
                    <select
                      value={listing.category}
                      onChange={(e) =>
                        update(
                          'category',
                          e.target.value as ListingInput['category'],
                        )
                      }
                    >
                      {categories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Tags
                    <Input
                      value={listing.tags.join(', ')}
                      onChange={(e) =>
                        update(
                          'tags',
                          e.target.value.split(',').map((v) => v.trimStart()),
                        )
                      }
                    />
                    <small>Up to 8 tags, separated by commas.</small>
                    {errorsFor('tags')}
                  </label>
                  <label>
                    Product pricing
                    <select
                      value={listing.pricing}
                      onChange={(e) =>
                        update(
                          'pricing',
                          e.target.value as ListingInput['pricing'],
                        )
                      }
                    >
                      {[
                        'unknown',
                        'free',
                        'freemium',
                        'paid',
                        'open-source',
                        'contact',
                      ].map((c) => (
                        <option key={c} value={c}>
                          {c === 'unknown' ? 'Not specified' : c}
                        </option>
                      ))}
                    </select>
                    <small>
                      Your product’s price model, separate from the directory
                      fee.
                    </small>
                  </label>
                  <label>
                    Authentication
                    <select
                      value={listing.authentication}
                      onChange={(e) =>
                        update(
                          'authentication',
                          e.target.value as ListingInput['authentication'],
                        )
                      }
                    >
                      {[
                        'unknown',
                        'none',
                        'api-key',
                        'oauth',
                        'account',
                        'other',
                        'not-applicable',
                      ].map((c) => (
                        <option key={c} value={c}>
                          {c === 'unknown' ? 'Not specified' : c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Connection transport
                    <select
                      value={listing.transport}
                      onChange={(e) =>
                        update(
                          'transport',
                          e.target.value as ListingInput['transport'],
                        )
                      }
                    >
                      {[
                        'unknown',
                        'streamable-http',
                        'sse',
                        'stdio',
                        'multiple',
                        'not-applicable',
                      ].map((c) => (
                        <option key={c} value={c}>
                          {c === 'unknown' ? 'Not specified' : c}
                        </option>
                      ))}
                    </select>
                  </label>
                  {textField(
                    'license',
                    'License',
                    'Use the project’s published license, if available.',
                  )}
                  <label className="full">
                    Capabilities
                    <Textarea
                      value={listing.capabilities.join('\n')}
                      onChange={(e) =>
                        update('capabilities', e.target.value.split('\n'))
                      }
                      rows={3}
                    />
                    <small>One capability per line, up to 20.</small>
                    {errorsFor('capabilities')}
                  </label>
                  <label className="full">
                    Connection or setup instructions
                    <Textarea
                      value={listing.setup}
                      onChange={(e) => update('setup', e.target.value)}
                      rows={4}
                      placeholder="Describe the setup steps or configuration. Use placeholders for credentials."
                    />
                    {errorsFor('setup')}
                  </label>
                  <label className="full">
                    Supported platforms or clients
                    <Input
                      value={listing.platforms.join(', ')}
                      onChange={(e) =>
                        update(
                          'platforms',
                          e.target.value.split(',').map((v) => v.trimStart()),
                        )
                      }
                    />
                    <small>
                      For example: Claude Desktop, Cursor, Linux. Include only
                      support you have documented.
                    </small>
                    {errorsFor('platforms')}
                  </label>
                </div>
              </fieldset>
              <div className="actions split">
                <Button
                  variant="ghost"
                  disabled={Boolean(busy)}
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft size={16} />
                  Back
                </Button>
                <Button
                  disabled={Boolean(busy) || checkoutOpen}
                  onClick={() =>
                    run(async () => {
                      await save();
                      setStep(3);
                    }, 'Saving your listing')
                  }
                >
                  Save and continue
                  <ArrowRight size={16} />
                </Button>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h2>Choose how to publish.</h2>
              <p>
                Both options include your public listing page, documentation
                links, and account management.
              </p>
              <div className="payment-options">
                <button
                  className={path === 'agentic' ? 'selected' : ''}
                  onClick={() => {
                    setPath('agentic');
                    setConsent(false);
                  }}
                >
                  <FileJson size={22} />
                  <strong>Free with Agentic</strong>
                  <span className="price">US$0</span>
                  <p>
                    Publish your Agentic JSON, TXT, and README additions, then
                    pass the checker.
                  </p>
                </button>
                <button
                  className={path === 'payment' ? 'selected' : ''}
                  onClick={() => {
                    setPath('payment');
                    setConsent(false);
                  }}
                >
                  <ArrowUpRight size={22} />
                  <strong>One-time listing</strong>
                  <span className="price">US$49.99</span>
                  <p>
                    Pay once. No recurring directory subscription and no Agentic
                    file requirement.
                  </p>
                </button>
              </div>
              {path === 'agentic' ? (
                <div className="checker-panel">
                  <h3>Check your Agentic files</h3>
                  <ol className="instruction-list">
                    <li>
                      <a
                        href="https://ruagentic.org/generate/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Generate the files at ruagentic.org{' '}
                        <ExternalLink size={13} />
                      </a>
                    </li>
                    <li>
                      Publish agentic.json and agentic.txt on your project’s
                      homepage origin.
                    </li>
                    <li>
                      Add the generated README section to a public README.md,
                      including the links to both Agentic sites and your files.
                    </li>
                  </ol>
                  <div className="stack-form">
                    {textField(
                      'profileUrl',
                      'Agentic JSON URL',
                      'Leave blank to check /agentic.json on your project website.',
                      new URL(listing.homepage || 'https://yoursite.com')
                        .origin + '/agentic.json',
                    )}
                    {textField(
                      'readmeUrl',
                      'Public raw README URL',
                      'Optional. By default we check README.md beside your profile.',
                      'https://yoursite.com/README.md',
                    )}
                  </div>
                  <div className="actions">
                    <Button
                      disabled={Boolean(busy) || checkoutOpen}
                      variant="outline"
                      onClick={() =>
                        run(checkFiles, 'Checking JSON, TXT and README')
                      }
                    >
                      <CheckCircle2 size={16} />
                      Run file check
                    </Button>
                    <span className="muted">
                      The check reads public files; it does not run your tools.
                    </span>
                  </div>
                  {audit && (
                    <div
                      className={
                        'audit-result ' + (eligible ? 'passed' : 'needs-work')
                      }
                    >
                      <h3>
                        {eligible
                          ? 'Your files passed'
                          : audit.report.publication?.status === 'partial'
                            ? 'Some files need attention'
                            : 'Publication check needs fixes'}
                      </h3>
                      {!eligible && (
                        <p>
                          Complete the fixes below and run the check again. A
                          partial result does not qualify for free publication.
                        </p>
                      )}
                      <ul>
                        {checks.map((check) => (
                          <li key={check.id} className={check.status}>
                            <span>
                              {check.status === 'pass' ? (
                                <Check size={16} />
                              ) : (
                                <AlertCircle size={16} />
                              )}
                            </span>
                            <div>
                              <strong>{check.label}</strong>
                              <p>{check.detail}</p>
                              {check.remedy && (
                                <p className="remedy">
                                  How to fix: {check.remedy}
                                </p>
                              )}
                              {check.helpUrl?.startsWith(
                                'https://ruagentic.org/',
                              ) && (
                                <a
                                  href={check.helpUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Instructions ↗
                                </a>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                      {!checks.length && (
                        <p>
                          {audit.report.errors?.join(' ') ||
                            'Open the Agentic auditor for the full report and publication guidance.'}
                        </p>
                      )}
                      <small>
                        Checked {new Date(audit.checked_at).toLocaleString()}.
                        Recheck after changing your files.
                      </small>
                    </div>
                  )}
                </div>
              ) : (
                <div className="notice">
                  {paid
                    ? 'Your completed payment covers updates to this same project.'
                    : 'You will review the listing next, then complete secure payment with Stripe.'}
                </div>
              )}
              <div className="actions split">
                <Button
                  variant="ghost"
                  disabled={Boolean(busy)}
                  onClick={() => setStep(2)}
                >
                  <ArrowLeft size={16} />
                  Back
                </Button>
                <Button
                  disabled={Boolean(busy) || (path === 'agentic' && !eligible)}
                  onClick={() =>
                    run(async () => {
                      await save();
                      setStep(4);
                    }, 'Saving your listing')
                  }
                >
                  Review listing
                  <ArrowRight size={16} />
                </Button>
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <h2>Ready to publish.</h2>
              <p>
                These are the details people will see. You can update the
                listing from your dashboard.
              </p>
              <div className="review-card">
                <span className="eyebrow">
                  {listing.kind === 'server'
                    ? 'MCP SERVER'
                    : listing.kind === 'client'
                      ? 'MCP CLIENT'
                      : 'AGENTIC PRODUCT'}
                </span>
                <h3>{listing.name}</h3>
                <p>{listing.summary}</p>
                <p className="preserve-lines">{listing.description}</p>
                <dl className="facts">
                  <div>
                    <dt>Homepage</dt>
                    <dd>{listing.homepage}</dd>
                  </div>
                  <div>
                    <dt>Category</dt>
                    <dd>{listing.category}</dd>
                  </div>
                  <div>
                    <dt>Listing option</dt>
                    <dd>
                      {path === 'agentic'
                        ? 'Free — Agentic files checked'
                        : paid
                          ? 'Paid — payment already confirmed'
                          : 'US$49.99 once'}
                    </dd>
                  </div>
                </dl>
              </div>
              <label className="check-label review-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  I am authorized to submit this project, confirm these details
                  are accurate, and agree to the{' '}
                  <Link href="/guidelines">listing guidelines</Link> and{' '}
                  <Link href="/terms">terms</Link>.
                </span>
              </label>
              <div className="actions split">
                <Button
                  variant="ghost"
                  disabled={Boolean(busy)}
                  onClick={() => setStep(3)}
                >
                  <ArrowLeft size={16} />
                  Back
                </Button>
                <Button
                  disabled={
                    Boolean(busy) ||
                    !consent ||
                    (path === 'agentic' && !eligible)
                  }
                  onClick={() =>
                    run(
                      async () => {
                        if (!saved) throw new Error('Save your listing first.');
                        if (path === 'payment' && !paid) {
                          const result = await api('/api/checkout', {
                            id: saved.id,
                            revision: saved.revision,
                            acceptedTerms: true,
                          });
                          if (result.url) {
                            window.location.assign(result.url);
                            return;
                          }
                          if (result.paid) {
                            const publication = await api(
                              '/api/submissions/publish',
                              {
                                id: saved.id,
                                revision: saved.revision,
                                method: 'payment',
                                evidenceId: result.evidenceId,
                                acceptedTerms: true,
                              },
                            );
                            setPublished(publication.slug);
                          } else
                            setNotice(
                              'Payment is being confirmed. Your listing is saved.',
                            );
                        } else {
                          const result = await api('/api/submissions/publish', {
                            id: saved.id,
                            revision: saved.revision,
                            method: path,
                            evidenceId: path === 'agentic' ? audit!.id : paid,
                            acceptedTerms: true,
                          });
                          setPublished(result.slug);
                        }
                      },
                      path === 'payment' && !paid
                        ? 'Opening secure checkout'
                        : 'Publishing your listing',
                    )
                  }
                >
                  {path === 'payment' && !paid
                    ? 'Pay US$49.99 and publish'
                    : 'Publish listing'}
                  <ArrowUpRight size={16} />
                </Button>
              </div>
            </>
          )}
        </section>
        <aside className="submission-aside">
          <span className="eyebrow">A GOOD LISTING OPENS DOORS</span>
          <h3>Make the next step clear.</h3>
          <p>
            Tell people what your project can do, how to connect, and where to
            find the documentation.
          </p>
          <ul>
            <li>
              <Check size={16} />A public page for your project
            </li>
            <li>
              <Check size={16} />
              Search and category discovery
            </li>
            <li>
              <Check size={16} />
              Setup and endpoint details
            </li>
            <li>
              <Check size={16} />
              Edit from your account
            </li>
          </ul>
          <div className="aside-account">
            <span>Signed in as</span>
            <strong>{email}</strong>
            <Link href="/dashboard">Your dashboard ↗</Link>
          </div>
          <Link href="/guidelines" className="text-link">
            Read the listing guidelines ↗
          </Link>
        </aside>
      </div>
    </main>
  );
}
